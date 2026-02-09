const { Client } = require('pg');

/**
 * Función principal de Netlify para manejar las peticiones a la base de datos Neon.
 * Configuración necesaria: Variable de entorno DATABASE_URL en el panel de Netlify.
 */
exports.handler = async (event, context) => {
  // Configuración del cliente de PostgreSQL para Neon
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Requerido para conexiones seguras con Neon
    }
  });

  try {
    await client.connect();
    const { httpMethod, path, body } = event;
    
    // Extraemos el recurso final de la URL (ej: /anuncios o /asesoras)
    const segments = path.split('/').filter(Boolean);
    const resource = segments[segments.length - 1];

    // --- MÉTODOS DE LECTURA (GET) ---
    if (httpMethod === 'GET') {
      
      // 1. Leer todos los anuncios con los datos de su asesora vinculada
      if (resource === 'anuncios') {
        const query = `
          SELECT 
            a.id, a.nombre, a.foto_url, a.tipo, a.estado, a.video_reel,
            to_char(a.fecha_inicio, 'DD/MM/YYYY') as fecha_inicio,
            aser.nombre as asesora_nombre, aser.ciudad, aser.whatsapp
          FROM anuncios a
          JOIN asesoras aser ON a.asesora_id = aser.id
          ORDER BY 
            CASE a.estado WHEN 'Activo' THEN 1 WHEN 'Programado' THEN 2 ELSE 3 END,
            a.fecha_inicio DESC;
        `;
        const res = await client.query(query);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(res.rows)
        };
      }

      // 2. Leer lista de asesoras para el formulario del admin
      if (resource === 'asesoras') {
        const res = await client.query('SELECT * FROM asesoras ORDER BY nombre ASC');
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(res.rows)
        };
      }
    }

    // --- MÉTODOS DE CREACIÓN (POST) ---
    if (httpMethod === 'POST') {
      if (resource === 'anuncios') {
        const data = JSON.parse(body);
        
        const query = `
          INSERT INTO anuncios (nombre, foto_url, tipo, asesora_id, estado, fecha_inicio, video_reel)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id;
        `;
        
        const values = [
          data.nombre, 
          data.foto_url, 
          data.tipo, 
          data.asesora_id, 
          data.estado, 
          data.fecha_inicio, 
          data.video_reel
        ];

        const res = await client.query(query, values);
        return {
          statusCode: 201,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Anuncio registrado correctamente', id: res.rows[0].id })
        };
      }
    }

    // --- MÉTODOS DE ELIMINACIÓN (DELETE) ---
    if (httpMethod === 'DELETE' && resource === 'anuncios') {
      const { id } = JSON.parse(body);
      await client.query('DELETE FROM anuncios WHERE id = $1', [id]);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Anuncio eliminado' })
      };
    }

    // Si la ruta no coincide con nada
    return { statusCode: 404, body: 'Recurso no encontrado' };

  } catch (error) {
    console.error('Error de base de datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
    };
  } finally {
    // Cerramos siempre la conexión para evitar saturar Neon
    await client.end();
  }
};
