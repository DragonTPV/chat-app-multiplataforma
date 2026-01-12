const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Usar PostgreSQL en producción, SQLite en desarrollo
const db = process.env.NODE_ENV === 'production' 
  ? require('./database-pg') 
  : require('./database');

const app = express();
const server = http.createServer(app);

// Configurar CORS para permitir conexiones desde cualquier origen
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  path: '/socket.io',
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors());
app.use(express.json());

// Almacenamiento temporal de salas y mensajes (en producción usarías una BD)
let rooms = {};
let users = {};
let connectedUsernames = new Set();
let privateMessages = {}; // Almacenar mensajes privados por usuario

const MAX_CONNECTIONS = 100; // Límite máximo de conexiones simultáneas

// Eventos de Socket.io
io.on('connection', (socket) => {
  console.log('Nuevo usuario conectado:', socket.id);

  // Usuario se une a una sala
  socket.on('join-room', async (data) => {
    const { username, roomName, email } = data;

    try {
      // Verificar límite de conexiones
      if (Object.keys(users).length >= MAX_CONNECTIONS) {
        socket.emit('join-error', { message: 'Servidor lleno, intenta más tarde' });
        return;
      }

      // Verificar nombre de usuario único en sesión actual
      if (connectedUsernames.has(username)) {
        socket.emit('join-error', { message: 'Nombre de usuario ya en uso' });
        return;
      }

      // Crear o actualizar usuario en base de datos
      await db.createOrUpdateUser(username, email);

      // Crear sala si no existe en base de datos
      await db.createRoom(roomName, username);

      // Crear sala si no existe en memoria
      if (!rooms[roomName]) {
        rooms[roomName] = {
          id: uuidv4(),
          name: roomName,
          users: [],
          messages: []
        };
      }

      // Agregar usuario a la sala
      socket.join(roomName);
      users[socket.id] = { username, roomName };

      // Agregar usuario a la lista de la sala
      if (!rooms[roomName].users.includes(username)) {
        rooms[roomName].users.push(username);
      }

      connectedUsernames.add(username);

      // Obtener usuarios online de la base de datos
      const onlineUsers = await db.getOnlineUsers();
      const onlineUsernames = onlineUsers.map(u => u.username);

      // Notificar a todos en la sala
      socket.to(roomName).emit('user-joined', {
        username,
        message: `${username} se unió al chat`,
        allUsers: onlineUsernames
      });

      // Obtener historial de mensajes de la base de datos
      const messageHistory = await db.getPublicMessages(roomName);

      // Enviar historial y lista de usuarios al usuario nuevo
      socket.emit('room-joined', {
        roomName,
        users: rooms[roomName].users,
        messages: messageHistory,
        allUsers: onlineUsernames
      });

      console.log(`${username} se unió a la sala: ${roomName}`);
    } catch (error) {
      console.error('Error al unirse a la sala:', error);
      socket.emit('join-error', { message: 'Error al conectar al servidor' });
    }
  });

  // Mensaje de chat
  socket.on('chat-message', async (data) => {
    const { message, roomName } = data;
    const user = users[socket.id];

    if (user && user.roomName === roomName) {
      try {
        // Guardar mensaje en base de datos
        await db.savePublicMessage(roomName, user.username, message);

        const messageData = {
          id: uuidv4(),
          username: user.username,
          message,
          timestamp: new Date().toISOString(),
          roomName
        };

        // Guardar mensaje en memoria (para compatibilidad)
        rooms[roomName].messages.push(messageData);

        // Limitar historial a 100 mensajes por sala en memoria
        if (rooms[roomName].messages.length > 100) {
          rooms[roomName].messages = rooms[roomName].messages.slice(-100);
        }

        // Enviar mensaje a todos en la sala
        io.to(roomName).emit('new-message', messageData);
      } catch (error) {
        console.error('Error al guardar mensaje público:', error);
      }
    }
  });

  // Mensaje privado
  socket.on('private-message', async (data) => {
    const { message, targetUsername } = data;
    const sender = users[socket.id];

    if (!sender) return;

    try {
      // Encontrar el socket del destinatario
      const targetSocketId = Object.keys(users).find(id => users[id].username === targetUsername);
      
      if (targetSocketId) {
        // Guardar mensaje privado en base de datos
        await db.savePrivateMessage(sender.username, targetUsername, message);

        const messageData = {
          id: uuidv4(),
          username: sender.username,
          message,
          timestamp: new Date().toISOString(),
          isPrivate: true
        };

        // Guardar mensaje privado en memoria (para compatibilidad)
        const senderKey = `${sender.username}_${targetUsername}`;
        const targetKey = `${targetUsername}_${sender.username}`;
        
        if (!privateMessages[senderKey]) privateMessages[senderKey] = [];
        if (!privateMessages[targetKey]) privateMessages[targetKey] = [];
        
        privateMessages[senderKey].push(messageData);
        privateMessages[targetKey].push(messageData);

        // Limitar historial de mensajes privados en memoria
        if (privateMessages[senderKey].length > 100) {
          privateMessages[senderKey] = privateMessages[senderKey].slice(-100);
        }
        if (privateMessages[targetKey].length > 100) {
          privateMessages[targetKey] = privateMessages[targetKey].slice(-100);
        }

        // Enviar mensaje al destinatario
        io.to(targetSocketId).emit('private-message', messageData);
        
        // Enviar confirmación al remitente
        socket.emit('message-sent', messageData);
      } else {
        socket.emit('user-not-found', { message: `Usuario ${targetUsername} no encontrado` });
      }
    } catch (error) {
      console.error('Error al enviar mensaje privado:', error);
      socket.emit('message-error', { message: 'Error al enviar mensaje privado' });
    }
  });

  // Obtener historial de mensajes privados
  socket.on('get-private-history', async (data) => {
    const { targetUsername } = data;
    const user = users[socket.id];

    if (!user) return;

    try {
      const history = await db.getPrivateMessages(user.username, targetUsername);
      
      socket.emit('private-history', {
        targetUsername,
        messages: history
      });
    } catch (error) {
      console.error('Error al obtener historial privado:', error);
    }
  });

  // Usuario abandona la sala
  socket.on('leave-room', async () => {
    const user = users[socket.id];
    if (user) {
      const { username, roomName } = user;

      try {
        // Marcar usuario como offline en base de datos
        await db.markUserOffline(username);

        socket.leave(roomName);

        // Remover usuario de la sala
        if (rooms[roomName]) {
          rooms[roomName].users = rooms[roomName].users.filter(u => u !== username);
        }

        // Obtener usuarios online actualizados
        const onlineUsers = await db.getOnlineUsers();
        const onlineUsernames = onlineUsers.map(u => u.username);

        // Notificar a otros usuarios
        socket.to(roomName).emit('user-left', {
          username,
          message: `${username} abandonó el chat`,
          allUsers: onlineUsernames
        });

        delete users[socket.id];
        connectedUsernames.delete(username);
        console.log(`${username} abandonó la sala: ${roomName}`);
      } catch (error) {
        console.error('Error al abandonar sala:', error);
      }
    }
  });

  // Desconexión
  socket.on('disconnect', async () => {
    const user = users[socket.id];
    if (user) {
      const { username, roomName } = user;

      try {
        // Marcar usuario como offline en base de datos
        await db.markUserOffline(username);

        // Remover usuario de la sala
        if (rooms[roomName]) {
          rooms[roomName].users = rooms[roomName].users.filter(u => u !== username);
        }

        // Obtener usuarios online actualizados
        const onlineUsers = await db.getOnlineUsers();
        const onlineUsernames = onlineUsers.map(u => u.username);

        // Notificar a otros usuarios
        socket.to(roomName).emit('user-left', {
          username,
          message: `${username} se desconectó`,
          allUsers: onlineUsernames
        });

        delete users[socket.id];
        connectedUsernames.delete(username);
        console.log(`${username} se desconectó de la sala: ${roomName}`);
      } catch (error) {
        console.error('Error en desconexión:', error);
      }
    }
  });
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Ruta para el generador automático de usuarios
app.get('/auto-users.html', (req, res) => {
  res.sendFile(__dirname + '/auto-users.html');
});

// Ruta para favicon (evitar error 404)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Ruta para obtener información de salas
app.get('/rooms', (req, res) => {
  const roomInfo = Object.keys(rooms).map(roomName => ({
    name: roomName,
    users: rooms[roomName].users.length,
    messages: rooms[roomName].messages.length
  }));

  res.json(roomInfo);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor de chat corriendo en puerto ${PORT}`);
  console.log(`📱 Cliente web: http://localhost:${PORT}`);
});
