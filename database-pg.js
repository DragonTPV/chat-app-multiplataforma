const { Pool } = require('pg');

// Configuración para producción (Railway/Render) o desarrollo local
const connectionString = process.env.DATABASE_URL || 'postgresql://chat_db_3tme_user:MQrcqJxAIjYFX2Y40ntn3aY6XADDW4ha@dpg-d5ilr7dactks73e5v8pg-a.virginia-postgres.render.com/chat_db_3tme';
console.log('🔗 DATABASE_URL:', connectionString);
console.log('🌍 NODE_ENV:', process.env.NODE_ENV || 'development');

const pool = new Pool({
  connectionString,
ssl: { rejectUnauthorized: false }
});

// Inicializar base de datos
async function initDatabase() {
  try {
    console.log('🔄 Inicializando base de datos PostgreSQL...');

    // Tabla de usuarios
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_online INTEGER DEFAULT 0
      )
    `);

    // Tabla de salas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255)
      )
    `);

    // Tabla de mensajes públicos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        room_name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de mensajes privados
    await pool.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id SERIAL PRIMARY KEY,
        sender_username VARCHAR(255) NOT NULL,
        receiver_username VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de contactos (sistema WhatsApp-like)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_username VARCHAR(255) NOT NULL,
        contact_username VARCHAR(255) NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_username, device_id)
      )
    `);

    console.log('✅ Base de datos PostgreSQL inicializada correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error.message);
    // No lanzamos error para evitar que el despliegue falle
    console.log('⚠️ Continuando sin base de datos - modo offline');
  }
}

// Inicializar al iniciar
initDatabase();

// Funciones de base de datos
module.exports = {
  // Crear o actualizar usuario
  createOrUpdateUser: async (username, email = null) => {
    try {
      const result = await pool.query(
        `INSERT INTO users (username, email, last_seen, is_online)
         VALUES ($1, $2, CURRENT_TIMESTAMP, 1)
         ON CONFLICT (username) 
         DO UPDATE SET email = $2, last_seen = CURRENT_TIMESTAMP, is_online = 1
         RETURNING id, username`,
        [username, email]
      );
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // Marcar usuario como desconectado
  markUserOffline: async (username) => {
    try {
      const result = await pool.query(
        'UPDATE users SET is_online = 0 WHERE username = $1',
        [username]
      );
      return result.rowCount;
    } catch (error) {
      throw error;
    }
  },

  // Obtener usuarios online
  getOnlineUsers: async () => {
    try {
      const result = await pool.query(
        'SELECT username, email, last_seen FROM users WHERE is_online = 1'
      );
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // Crear sala si no existe
  createRoom: async (roomName, createdBy) => {
    try {
      const result = await pool.query(
        `INSERT INTO rooms (name, created_by)
         VALUES ($1, $2)
         ON CONFLICT (name) DO NOTHING
         RETURNING id, name`,
        [roomName, createdBy]
      );
      return result.rows[0] || { id: null, name: roomName };
    } catch (error) {
      throw error;
    }
  },

  // Guardar mensaje público
  savePublicMessage: async (roomName, username, message) => {
    try {
      const result = await pool.query(
        'INSERT INTO messages (room_name, username, message) VALUES ($1, $2, $3) RETURNING id',
        [roomName, username, message]
      );
      return { id: result.rows[0].id };
    } catch (error) {
      throw error;
    }
  },

  // Guardar mensaje privado
  savePrivateMessage: async (sender, receiver, message) => {
    try {
      const result = await pool.query(
        'INSERT INTO private_messages (sender_username, receiver_username, message) VALUES ($1, $2, $3) RETURNING id',
        [sender, receiver, message]
      );
      return { id: result.rows[0].id };
    } catch (error) {
      throw error;
    }
  },

  // Obtener historial de mensajes públicos
  getPublicMessages: async (roomName, limit = 100) => {
    try {
      const result = await pool.query(
        'SELECT * FROM messages WHERE room_name = $1 ORDER BY timestamp DESC LIMIT $2',
        [roomName, limit]
      );
      return result.rows.reverse();
    } catch (error) {
      throw error;
    }
  },

  // Obtener historial de mensajes privados
  getPrivateMessages: async (user1, user2, limit = 100) => {
    try {
      const result = await pool.query(
        `SELECT * FROM private_messages 
         WHERE (sender_username = $1 AND receiver_username = $2) 
            OR (sender_username = $2 AND receiver_username = $1)
         ORDER BY timestamp DESC LIMIT $3`,
        [user1, user2, limit]
      );
      return result.rows.reverse();
    } catch (error) {
      throw error;
    }
  },

  // Funciones de contactos (WhatsApp-like)
  addContact: async (userUsername, contactUsername, deviceId, phoneNumber = null) => {
    try {
      // Verificar que el usuario existe
      const userExists = await pool.query('SELECT id FROM users WHERE username = $1', [userUsername]);
      
      if (userExists.rows.length === 0) {
        throw new Error('Usuario no encontrado');
      }

      const result = await pool.query(
        `INSERT INTO contacts (user_username, contact_username, device_id, phone_number)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_username, device_id) DO NOTHING
         RETURNING id`,
        [userUsername, contactUsername, deviceId, phoneNumber]
      );
      return result.rows[0] || { id: null }; // Si ya existe, retorna null
    } catch (error) {
      throw error;
    }
  },

  removeContact: async (userUsername, contactUsername) => {
    try {
      const result = await pool.query(
        'DELETE FROM contacts WHERE user_username = $1 AND contact_username = $2',
        [userUsername, contactUsername]
      );
      return result.rowCount;
    } catch (error) {
      throw error;
    }

getContacts: async (userUsername) => {
try {
const result = await pool.query(
`SELECT c.contact_username as username, c.device_id, c.phone_number, u.email, u.is_online, u.last_seen, c.added_at
FROM contacts c
LEFT JOIN users u ON c.contact_username = u.username
WHERE c.user_username = $1
ORDER BY u.is_online DESC, u.last_seen DESC`,
[userUsername]
);
return result.rows;
} catch (error) {
throw error;
}
},

// Cerrar conexión
close: async () => {
await pool.end();
}
};
