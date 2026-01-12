const { Pool } = require('pg');

// Configuración para producción (Railway/Render) o desarrollo local
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/chat',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Función para probar conexión
async function testConnection() {
  try {
    console.log('🔍 Probando conexión a PostgreSQL...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Configurada' : 'No configurada');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'development');

    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Conexión exitosa!');
    console.log('⏰ Hora del servidor:', result.rows[0].current_time);
    console.log('📊 Versión PostgreSQL:', result.rows[0].pg_version.substring(0, 50) + '...');

    // Probar creación de tablas
    console.log('🔧 Creando/verificando tablas...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla de prueba creada');

    // Insertar dato de prueba
    await pool.query('INSERT INTO test_users (username) VALUES ($1) ON CONFLICT DO NOTHING', ['test_user']);
    console.log('✅ Dato de prueba insertado');

    // Leer datos
    const users = await pool.query('SELECT * FROM test_users LIMIT 5');
    console.log('✅ Datos leídos:', users.rows.length, 'registros');

    console.log('🎉 ¡Base de datos PostgreSQL funcionando correctamente!');

  } catch (error) {
    console.error('❌ Error de conexión a PostgreSQL:', error.message);
    console.error('🔍 Detalles del error:', error);

    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Posible causa: La base de datos no está corriendo o la URL es incorrecta');
    } else if (error.code === '42P01') {
      console.error('💡 Posible causa: Base de datos existe pero hay problemas de permisos');
    } else if (error.code === '08003') {
      console.error('💡 Posible causa: Conexión cerrada inesperadamente');
    }
  } finally {
    await pool.end();
  }
}

testConnection();
