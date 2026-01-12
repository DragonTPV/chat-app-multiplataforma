const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Crear base de datos
const dbPath = path.join(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath);

// Inicializar base de datos
db.serialize(() => {
    // Tabla de usuarios
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_online INTEGER DEFAULT 0
    )`);

    // Tabla de salas
    db.run(`CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by TEXT
    )`);

    // Tabla de mensajes públicos
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_name TEXT NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (username) REFERENCES users(username),
        FOREIGN KEY (room_name) REFERENCES rooms(name)
    )`);

    // Tabla de mensajes privados
    db.run(`CREATE TABLE IF NOT EXISTS private_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_username TEXT NOT NULL,
        receiver_username TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_username) REFERENCES users(username),
        FOREIGN KEY (receiver_username) REFERENCES users(username)
    )`);

    console.log('Base de datos inicializada correctamente');
});

// Funciones de base de datos
module.exports = {
    // Crear o actualizar usuario
    createOrUpdateUser: (username, email = null) => {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR REPLACE INTO users (username, email, last_seen, is_online)
                VALUES (?, ?, CURRENT_TIMESTAMP, 1)
            `);
            
            stmt.run([username, email], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, username });
                }
            });
            
            stmt.finalize();
        });
    },

    // Marcar usuario como desconectado
    markUserOffline: (username) => {
        return new Promise((resolve, reject) => {
            db.run(
                'UPDATE users SET is_online = 0 WHERE username = ?',
                [username],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    // Obtener usuarios online
    getOnlineUsers: () => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT username, email, last_seen FROM users WHERE is_online = 1',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    },

    // Crear sala si no existe
    createRoom: (roomName, createdBy) => {
        return new Promise((resolve, reject) => {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO rooms (name, created_by)
                VALUES (?, ?)
            `);
            
            stmt.run([roomName, createdBy], function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, roomName });
            });
            
            stmt.finalize();
        });
    },

    // Guardar mensaje público
    savePublicMessage: (roomName, username, message) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO messages (room_name, username, message) VALUES (?, ?, ?)',
                [roomName, username, message],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    },

    // Guardar mensaje privado
    savePrivateMessage: (sender, receiver, message) => {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO private_messages (sender_username, receiver_username, message) VALUES (?, ?, ?)',
                [sender, receiver, message],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });
    },

    // Obtener historial de mensajes públicos
    getPublicMessages: (roomName, limit = 100) => {
        return new Promise((resolve, reject) => {
            db.all(
                'SELECT * FROM messages WHERE room_name = ? ORDER BY timestamp DESC LIMIT ?',
                [roomName, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.reverse());
                }
            );
        });
    },

    // Obtener historial de mensajes privados
    getPrivateMessages: (user1, user2, limit = 100) => {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM private_messages 
                 WHERE (sender_username = ? AND receiver_username = ?) 
                    OR (sender_username = ? AND receiver_username = ?)
                 ORDER BY timestamp DESC LIMIT ?`,
                [user1, user2, user2, user1, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.reverse());
                }
            );
        });
    },

    // Cerrar conexión
    close: () => {
        db.close();
    }
};
