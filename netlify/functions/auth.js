const { Client } = require('pg');

/**
 * Función de Netlify para manejar el inicio de sesión.
 * Valida credenciales contra la tabla 'usuarios' en Neon.
 */
exports.handler = async (event, context) => {
  // Configuración de la base de datos
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Necesario para la conexión segura con Neon
    }
  });

  // Solo permitimos peticiones de tipo POST para login
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  try {
    // Conexión a la base de datos
    await client.connect();

    // Extraer datos del cuerpo de la petición
    const { username, password } = JSON.parse(event.body);

    if (!username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Usuario y contraseña requeridos' })
      };
    }

    // Consulta SQL para verificar credenciales
    // Nota: En un sistema real se debería usar hashing para las contraseñas
    const query = 'SELECT id, username, rol FROM usuarios WHERE username = $1 AND password = $2';
    const values = [username, password];
    
    const res = await client.query(query, values);

    // Si encontramos un registro coincidente
    if (res.rows.length > 0) {
      const user = res.rows[0];
      
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            rol: user.rol
          }
        })
      };
    } else {
      // Si las credenciales no son correctas
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Usuario o contraseña incorrectos'
        })
      };
    }

  } catch (error) {
    console.error('Error en el proceso de autenticación:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor', details: error.message })
    };
  } finally {
    // Cerramos la conexión para liberar recursos en Neon
    await client.end();
  }
};
