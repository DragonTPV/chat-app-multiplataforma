# 🚀 Despliegue en la Nube - Sin Depender de Equipo Local

## Opciones 100% Gratuitas (Sin Periodo de Prueba)

### Render (Recomendado)

#### Ventajas de Render

- ✅ 100% gratis sin límite de tiempo.
- ✅ 750 horas/mes (permite 24/7).
- ✅ Base de datos PostgreSQL incluida.
- ✅ CI/CD desde GitHub.
- ✅ SSL y dominio *.onrender.com.

#### Límites gratuitos en Render

- 750 horas/mes.
- 512 MB de RAM.
- 100 GB de ancho de banda.

#### Pasos rápidos en Render

1. Crea cuenta en [Render](https://render.com).
2. Conecta tu repositorio de GitHub.
3. Crea un “Web Service”.
4. Agrega una base “PostgreSQL Database”.
5. Configura variables de entorno y despliega.

### Vercel

#### Ventajas de Vercel

- ✅ CDN global y serverless functions.
- ✅ Dominio *.vercel.app.
- ✅ Excelente para frontends React/Next.

#### Límites gratuitos en Vercel

- 100 GB de ancho de banda/mes.
- Funciones serverless gratuitas (con límites).
- Necesita DB externa (Railway/Neon/etc.).

### Netlify

#### Ventajas de Netlify

- ✅ CDN global.
- ✅ Functions y Scheduled functions.
- ✅ Dominio *.netlify.app.

#### Límites gratuitos

- 100 GB de ancho de banda/mes.
- 125 k invocaciones/mes en functions.
- Sin base de datos integrada.

### Glitch

#### Ventajas de Glitch

- ✅ Editor web muy sencillo.
- ✅ Deploy instantáneo.

#### Límites de Glitch

- Apps se “duermen” tras 5 min inactivas.
- 4000 horas/mes (no 24/7).

### Heroku (Plan Eco)

#### Ventajas de Heroku

- ✅ Plataforma veterana y estable.
- ✅ PostgreSQL integrado.

#### Consideración sobre Heroku

- 💲 Plan Eco cuesta 5 USD/mes (ya no es gratuito, pero es económico).

## Opciones con Periodo de Prueba (evitar si buscas gratis permanente)

### Railway

- ❌ Solo 30 días gratis.
- ❌ Pide tarjeta y luego cobra.
- ❌ No recomendable para proyectos permanentes sin presupuesto.

## Recomendación General

Render ofrece el mejor balance gratis: ejecuta 24/7, trae PostgreSQL y se
integra con GitHub. Usa Render para backend + DB y, si lo deseas,
Vercel/Netlify para frontends estáticos.

## Pasos para Render (100 % Gratis)

1. **Preparar repositorio:** `https://github.com/DragonTPV/chat-app-multiplataforma`.
2. **Crear Web Service:** Sign up → conectar GitHub → “New → Web Service”.
3. **Configurar build:** `npm install`, start `npm start`, instancia Free.
4. **Agregar base:** “New → PostgreSQL” (plan Free).
5. **Conectar base:** copiar `DATABASE_URL`, pegarla en Environment, desplegar cambios.
6. **Probar:** esperar 2‑3 min y visitar `https://chat-app-multiplataforma.onrender.com`.

## 💰 Costos Reales

### Render (Gratis)

- $0/mes, 750 horas, DB PostgreSQL y SSL incluidos.

### Vercel (Gratis)

- $0/mes, 100 GB de ancho de banda, funciones y CDN.

## 🌐 URLs Finales

- Render: `https://chat-app-multiplataforma.onrender.com`
- Vercel: `https://chat-app.vercel.app`
- Netlify: `https://chat-app.netlify.app`

## ✅ Ventajas del Despliegue Gratuito

- Sin mantener PC encendida.
- Acceso global 24/7.
- SSL automático.
- Escala fácilmente.
- Actualizaciones automáticas desde Git/GitHub.

## 🚀 Alternativa: Auto-hosting

- Raspberry Pi (~60 USD una vez).
- VPS de bajo costo (3‑5 USD/mes).
- Servidor propio en casa.

## 📋 Preparación del Proyecto (Guía Técnica)

### Opción A: Railway (Recomendado para pruebas)

#### 1. Modificar `database.js` para PostgreSQL

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
  createOrUpdateUser: async (username, email = null) => {
    const result = await pool.query(
      `INSERT INTO users (username, email, last_seen, is_online)
       VALUES ($1, $2, CURRENT_TIMESTAMP, 1)
       ON CONFLICT (username)
       DO UPDATE SET email = $2, last_seen = CURRENT_TIMESTAMP, is_online = 1
       RETURNING id, username`,
      [username, email]
    );
    return result.rows[0];
  },
  // ...otras funciones usando pool.query()
};
```

#### 2. Crear archivo `.env`

```env
DATABASE_URL=postgresql://usuario:password@host:port/database
NODE_ENV=production
```

#### 3. Crear `railway.json`

```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health"
  }
}
```

### Opción B: Render

#### 1. Crear `render.yaml`

```yaml
services:
  - type: web
    name: chat-app-multiplataforma
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: chat-db
          property: connectionString

databases:
  - name: chat-db
    plan: free
```

## 🚀 Despliegue Paso a Paso (Railway)

### Paso 1: Preparar el Repositorio

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/chat-app.git
git push -u origin main
```

### Paso 2: Configurar Railway

1. Ve a [Railway](https://railway.app).
2. Crea proyecto → “Deploy from GitHub repo”.
3. Selecciona el repo.
4. Railway detecta Node.js automáticamente.
5. Agrega `DATABASE_URL`.
6. Añade servicio PostgreSQL.
7. Conecta la base a tu app.

### Paso 3: Configurar Base de Datos

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_online INTEGER DEFAULT 0
);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE private_messages (
    id SERIAL PRIMARY KEY,
    sender_username VARCHAR(255) NOT NULL,
    receiver_username VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📱 Actualizar Cliente para Producción

Use URL fija o dinámica:

```javascript
const socket = io('https://tu-app.railway.app');
```

```javascript
const socket = io(window.location.origin);
```

## Mantenimiento

### Automático

- Despliegues al hacer push.
- SSL renovado automáticamente.
- Backups (en planes pagos).

### Manual

- Vigilar horas usadas al mes.
- Actualizar dependencias.
- Revisar logs periódicamente.

## 🌐 Acceso Desde Cualquier Lugar

- URL pública siempre disponible.
- Acceso 24/7 sin PC encendida.
- Multiplataforma (PC/móvil/tablet).
- Escalable según crecimiento.

## 🚨 Consideraciones

### Seguridad

- Usar HTTPS siempre.
- Validar y sanitizar entradas.
- Limitar tasa de peticiones.

### Rendimiento

- CDN para assets estáticos.
- Caché de mensajes frecuentes.
- Pool de conexiones a la DB.
- Monitorizar CPU/RAM.

## 📞 Soporte

- Render: [https://render.com/docs](https://render.com/docs)
- Vercel: [https://vercel.com/docs](https://vercel.com/docs)
- Netlify: [https://docs.netlify.com](https://docs.netlify.com)
- Railway: [https://docs.railway.app](https://docs.railway.app)

## ✅ Resumen Final

1. Elige la plataforma (Render recomendado).
2. Sube código a GitHub.
3. Configura variables como `DATABASE_URL`.
4. Despliega automáticamente con cada push.
5. Actualiza el cliente con la nueva URL.
6. Disfruta un chat disponible 24/7 sin depender de tu computadora.
