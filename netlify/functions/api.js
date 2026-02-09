const { Client } = require('pg');

/**
 * Función principal de Netlify para manejar las peticiones a la base de datos Neon.
 * Soporta: 
 * - GET: Obtener datos (incluye campos necesarios para edición).
 * - POST: Crear nuevos registros.
 * - PUT: Actualizar registros existentes (Edición).
 * - DELETE: Eliminar registros.
 */
exports.handler = async (event, context) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const { httpMethod, path, body } = event;
    const segments = path.split('/').filter(Boolean);
    const resource = segments[segments.length - 1];

    // --- MÉTODOS DE LECTURA (GET) ---
    if (httpMethod === 'GET') {
      if (resource === 'anuncios') {
        const query = `
          SELECT 
            a.id, a.nombre, a.foto_url, a.tipo, a.estado, a.video_reel, a.asesora_id,
            to_char(a.fecha_inicio, 'YYYY-MM-DD') as fecha_iso,
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
      const data = JSON.parse(body);
      if (resource === 'anuncios') {
        const query = `
          INSERT INTO anuncios (nombre, foto_url, tipo, asesora_id, estado, fecha_inicio, video_reel)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id;
        `;
        const values = [data.nombre, data.foto_url, data.tipo, data.asesora_id, data.estado, data.fecha_inicio, data.video_reel];
        const res = await client.query(query, values);
        return {
          statusCode: 201,
          body: JSON.stringify({ message: 'Anuncio registrado', id: res.rows[0].id })
        };
      }

      if (resource === 'asesoras') {
        const query = `INSERT INTO asesoras (nombre, ciudad, whatsapp) VALUES ($1, $2, $3) RETURNING id;`;
        const values = [data.nombre, data.ciudad, data.whatsapp];
        const res = await client.query(query, values);
        return {
          statusCode: 201,
          body: JSON.stringify({ message: 'Asesora registrada', id: res.rows[0].id })
        };
      }
    }

    // --- MÉTODOS DE ACTUALIZACIÓN / EDICIÓN (PUT) ---
    if (httpMethod === 'PUT') {
      const data = JSON.parse(body);
      if (resource === 'anuncios') {
        const query = `
          UPDATE anuncios 
          SET nombre=$1, foto_url=$2, tipo=$3, asesora_id=$4, estado=$5, fecha_inicio=$6, video_reel=$7
          WHERE id=$8;
        `;
        const values = [data.nombre, data.foto_url, data.tipo, data.asesora_id, data.estado, data.fecha_inicio, data.video_reel, data.id];
        await client.query(query, values);
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Anuncio actualizado correctamente' })
        };
      }

      if (resource === 'asesoras') {
        const query = `
          UPDATE asesoras 
          SET nombre=$1, ciudad=$2, whatsapp=$3 
          WHERE id=$4;
        `;
        const values = [data.nombre, data.ciudad, data.whatsapp, data.id];
        await client.query(query, values);
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'Asesora actualizada correctamente' })
        };
      }
    }

    // --- MÉTODOS DE ELIMINACIÓN (DELETE) ---
    if (httpMethod === 'DELETE') {
      const { id } = JSON.parse(body);
      if (resource === 'anuncios') {
        await client.query('DELETE FROM anuncios WHERE id = $1', [id]);
        return { statusCode: 200, body: JSON.stringify({ message: 'Anuncio eliminado' }) };
      }
      if (resource === 'asesoras') {
        await client.query('DELETE FROM asesoras WHERE id = $1', [id]);
        return { statusCode: 200, body: JSON.stringify({ message: 'Asesora eliminada' }) };
      }
    }

    return { statusCode: 404, body: 'Recurso no encontrado' };

  } catch (error) {
    console.error('Error de base de datos:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
    };
  } finally {
    await client.end();
  }
};
