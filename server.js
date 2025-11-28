// ====================================================================
// PASO 1: CONFIGURACIÓN DE DEPENDENCIAS Y VARIABLES DE ENTORNO
// ====================================================================
// Cargar variables de entorno desde el archivo .env
require('dotenv').config();

const express = require('express');
const path = require('path');
// Importamos mysql2/promise para usar async/await y transacciones
const mysql = require('mysql2/promise');
const cors = require('cors');
// mails
// Dentro de server.js
const nodemailer = require('nodemailer'); // ⬅️ Añadir esta línea

const app = express();
// Puerto del servidor (tomado de .env o 3000 por defecto)
const PORT = process.env.PORT || 3000;

// Middlewares: Permiten al servidor procesar peticiones
app.use(express.json()); // Permite al servidor leer datos JSON que le envíe el frontend
app.use(cors()); // Permite que tu frontend (HTML/JS) acceda a esta API
app.use(express.static(path.join(__dirname, 'frontend'))); // Servir archivos estáticos del frontend

// ====================================================================
// PASO 2: CONFIGURACIÓN DE LA CONEXIÓN A MYSQL
// ====================================================================
// Creamos un pool de conexiones para manejar múltiples peticiones eficientemente
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT // 3306 por defecto
});
// Lineas de inventario
const inventarioRoutes = require('./inventarioroutes')(pool);
app.use('/api/inventario', inventarioRoutes);
// Fin lineas inventario

// Función para verificar la conexión al iniciar el servidor
async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión a MySQL local exitosa!');
    connection.release(); // Liberar la conexión al pool
  } catch (err) {
    console.error('❌ Error al conectar con la base de datos MySQL. Revisa tu archivo .env. Detalles:', err.message);
    // Opcional: Podrías detener el proceso si la DB es crítica
    // process.exit(1); 
  }
}

// ====================================================================
// PASO 3: DEFINICIÓN DE LAS RUTAS (ENDPOINTS) DE TU API
// ====================================================================

// RUTAS DE AUTENTICACIÓN
app.post('/api/login', async (req, res) => {
  // ... dentro de app.post('/api/login', ...
  const { email, password } = req.body; // Cambiaremos estas variables en el frontend

  try {
    const [users] = await pool.query(
      // Usa CORREO y CONTRASENA para que coincida con tu DB
      'SELECT IdUsuario, Nombre, Rol, Correo FROM Usuarios WHERE Correo = ? AND Contrasena = ?',
      [email, password] // Aquí usamos las variables recibidas
    );

    if (users.length > 0) {
      res.json({
        success: true,
        usuario: {
          IdUsuario: users[0].IdUsuario,
          Nombre: users[0].Nombre, // Usar Nombre
          Rol: users[0].Rol,
          Correo: users[0].Correo
        }
      });
      // ...

    } else {
      res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
});

// RUTAS PARA OBTENER DATOS (GET)

// Ruta para obtener la lista de productos (el menú de la cafetería)
app.get('/api/menu', async (req, res) => {
  try {
    // Consulta SQL con JOIN para obtener el nombre de la categoría
    const query = `
      SELECT p.IdProducto, p.Nombre, p.Descripcion, p.Precio, p.Stock, p.ImagenUrl, c.Nombre as Categoria 
      FROM Productos p
      JOIN Categorias c ON p.IdCategoria = c.IdCategoria
      ORDER BY c.Nombre, p.Nombre;
    `;

    // Ejecutar la consulta en la base de datos
    const [results] = await pool.query(query);

    // Enviar los datos al JavaScript del navegador
    res.json(results);

  } catch (error) {
    console.error('Error al obtener el menú:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener el menú' });
  }
});

// Rutas para el inventario
app.get('/api/inventario/bebidas', async (req, res) => {
  try {
    const query = `
      SELECT p.IdProducto, p.Nombre, p.Descripcion, p.Precio, p.Stock, p.ImagenUrl
      FROM Productos p
      JOIN Categorias c ON p.IdCategoria = c.IdCategoria
      WHERE c.Nombre = 'Bebidas'
      ORDER BY p.Nombre;
    `;
    const [results] = await pool.query(query);
    res.json(results);
  } catch (error) {
    console.error('Error al obtener bebidas:', error);
    res.status(500).json({ error: 'Error al obtener bebidas' });
  }
});

// Actualizar stock de un producto
app.put('/api/inventario/productos/:id', async (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;

  try {
    await pool.query(
      'UPDATE Productos SET Stock = ? WHERE IdProducto = ?',
      [stock, id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    res.status(500).json({ error: 'Error al actualizar stock' });
  }
});

// ggggggg Crear nuevo producto en inventario
app.post('/api/inventario/productos', async (req, res) => {
  const { Nombre, Descripcion, Precio, Stock, IdCategoria, Imagen } = req.body;
  try {
    // Intentar insertar con ImagenUrl (mapeamos el campo 'Imagen' del body a 'ImagenUrl' de la DB)
    const [result] = await pool.query(
      'INSERT INTO Productos (Nombre, Descripcion, Precio, Stock, IdCategoria, ImagenUrl) VALUES (?, ?, ?, ?, ?, ?)',
      [Nombre, Descripcion, Precio, Stock, IdCategoria, Imagen]
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ error: 'Error al crear producto: ' + error.message });
  }
});

// Nueva ruta para obtener categorías del menú
app.get('/api/categorias_menu', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM Categorias');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});


// RUTA PARA MARCAR PEDIDO COMO COMPLETADO
app.put('/api/pedidos/:id/completar', async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'UPDATE Pedidos SET Estado = "Completado" WHERE IdPedido = ?';
    const [result] = await pool.query(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
    }

    res.json({ success: true, message: 'Estado del pedido actualizado a Completado.' });

  } catch (error) {
    console.error('Error al completar pedido:', error);
    res.status(500).json({ success: false, message: 'Error interno al actualizar el estado.' });
  }
});

// get oedido o algo asi nose pal papnel
// --- RUTAS DE PEDIDOS PARA EL PANEL DE VISUALIZACIÓN ---

// Ruta 1: Para obtener la lista de pedidos principales (Panel, tabla izquierda)
// Elimina la columna 'Estado' de la consulta
app.get('/api/pedidos', async (req, res) => {
  try {
    const query = `
            SELECT 
                p.IdPedido,
                c.Nombre AS NombreCliente,  -- Nombre de la mesa/cliente
                p.Fecha,
                p.Total,
                u.Nombre AS NombreUsuario,   -- Nombre del empleado
                p.Estado
            FROM Pedidos p
            JOIN Clientes c ON p.IdCliente = c.IdCliente
            JOIN Usuarios u ON p.IdUsuario = u.IdUsuario
            WHERE P.Estado = 'Pendiente'
            ORDER BY p.Fecha DESC;
        `;

    const [results] = await pool.query(query);
    res.json(results);
  } catch (error) {
    console.error('Error al obtener pedidos para el panel:', error);
    res.status(500).json({ error: 'Error al obtener lista de pedidos' });
  }
});

// Ruta 2: Para obtener el detalle de un pedido específico (Panel, ticket derecho)

app.get('/api/pedidos/:id/detalle', async (req, res) => {
  const { id } = req.params;
  try {
    const query = `
            SELECT 
                dp.Cantidad,
                dp.Subtotal,
                p.Nombre AS NombreProducto,
                p.Precio AS PrecioUnitario
            FROM DetallePedidos dp
            JOIN Productos p ON dp.IdProducto = p.IdProducto
            WHERE dp.IdPedido = ?;
        `;

    const [results] = await pool.query(query, [id]);
    res.json(results);
  } catch (error) {
    console.error('Error al obtener el detalle del pedido:', error);
    res.status(500).json({ error: 'Error al obtener detalles del pedido' });
  }
});



// RUTAS PARA INSERTAR DATOS (POST)

// Ruta para registrar un nuevo pedido completo
// Ruta para registrar un nuevo pedido completo
app.post('/api/pedidos', async (req, res) => {
  // 1. Recibir los datos del frontend (incluyendo IdCliente)
  const { idCliente, total, idUsuario, productos } = req.body;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 2. Insertar en la tabla PEDIDOS (IdCliente, Total, IdUsuario, Estado)
    const pedidoQuery = 'INSERT INTO Pedidos (IdCliente, Total, IdUsuario, Estado) VALUES (?, ?, ?, "Pendiente")';
    const [pedidoResult] = await connection.query(pedidoQuery, [idCliente, total, idUsuario]);
    const idPedido = pedidoResult.insertId;

    // 3. Insertar cada producto en DETALLE_PEDIDOS y actualizar stock
    for (const producto of productos) {
      // Insertar detalle (DetallePedidos)
      await connection.query(
        // OJO: Asegúrate de que el nombre de la tabla sea 'DetallePedidos' o 'Detalle_Pedidos' según tu esquema
        'INSERT INTO detallepedidos (IdPedido, IdProducto, Cantidad, Subtotal) VALUES (?, ?, ?, ?)',
        [idPedido, producto.id, producto.cantidad, producto.subtotal]
      );

      // Actualizar stock (Productos)
      /*await connection.query(
          'UPDATE Productos SET Stock = Stock - ? WHERE IdProducto = ?',
          [producto.cantidad, producto.id]
      );*/
    }

    // 4. Confirmar la transacción
    await connection.commit();
    res.json({
      success: true,
      message: 'Pedido registrado correctamente',
      idPedido
    });

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    // Imprime el error en la consola negra
    console.error('❌ ERROR REAL:', error.sqlMessage || error.message);

    res.status(500).json({
      success: false,
      // CAMBIO: Usamos la variable error.sqlMessage en lugar del texto fijo
      message: error.sqlMessage || error.message
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});


// RUTA PARA ENVIAR CORREO DE ORDEN DE INVENTARIO
app.post('/api/ordenar', async (req, res) => {
  // 1. Recibir datos del frontend (incluyendo el correo de destino)
  const { producto, cantidad, motivo, destino, usuarioNombre } = req.body;

  // 2. Configuración del transportador (usando Gmail como ejemplo)
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Tu correo (del .env)
      pass: process.env.EMAIL_PASS  // Tu contraseña/token (del .env)
    }
  });

  // 3. Contenido del correo
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: destino, // ⬅️ Usamos el correo ingresado por el usuario en el modal
    subject: `ORDEN DE COMPRA: ${producto} - URGENCIAS`,
    html: `
            <h3>Nueva Solicitud de Orden de Compra</h3>
            <p>El empleado ${usuarioNombre || 'Sistema'} ha solicitado una orden urgente de inventario.</p>
            <hr>
            <p><strong>Producto Solicitado:</strong> ${producto}</p>
            <p><strong>Cantidad a Ordenar:</strong> ${cantidad} unidades</p>
            <p><strong>Motivo / Observaciones:</strong> ${motivo || 'No especificado'}</p>
            <p>Por favor, procesar esta orden lo antes posible.</p>
        `
  };

  // 4. Envío del correo
  try {
    let info = await transporter.sendMail(mailOptions);
    console.log("✅ Correo enviado: %s", info.messageId);
    res.json({ success: true, message: 'Orden de compra enviada por correo con éxito.' });
  } catch (error) {
    console.error("❌ Error al enviar el correo:", error);
    res.status(500).json({ success: false, message: 'Fallo al enviar el correo de orden. Revise credenciales en .env.' });
  }
});

// ======================================
// RUTA: Obtener pedidos completados
// ======================================
app.get('/api/pedidos/completados', async (req, res) => {
  try {
    const query = `
            SELECT
              p.IdPedido,
              p.IdCliente,
              c.Nombre AS NombreCliente,
              p.Fecha,
              p.Total,
              u.IdUsuario,
              u.Nombre AS NombreUsuario,
              p.Estado
              FROM Pedidos p
              JOIN Clientes c ON p.IdCliente = c.IdCliente
              JOIN Usuarios u ON p.IdUsuario = u.IdUsuario
              WHERE p.Estado = 'Completado'
              ORDER BY p.Fecha DESC;
                  `;

    const [results] = await pool.query(query);
    res.json(results);

  } catch (error) {
    console.error('Error al obtener pedidos completados:', error);
    res.status(500).json({ error: 'Error al obtener pedidos completados' });
  }
});


// ======================================
// RUTAS DE GESTIÓN DE USUARIOS (ADMIN)
// ======================================

// 1. Obtener todos los usuarios
app.get('/api/usuarios', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT IdUsuario, Nombre, Correo, Rol FROM Usuarios');
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// 2. Crear un nuevo usuario
app.post('/api/usuarios', async (req, res) => {
  const { nombre, correo, contrasena, rol } = req.body;
  try {
    // Verificar si el correo ya existe
    const [existing] = await pool.query('SELECT IdUsuario FROM Usuarios WHERE Correo = ?', [correo]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'El correo ya está registrado.' });
    }

    const [result] = await pool.query(
      'INSERT INTO Usuarios (Nombre, Correo, Contrasena, Rol) VALUES (?, ?, ?, ?)',
      [nombre, correo, contrasena, rol]
    );
    res.json({ success: true, id: result.insertId, message: 'Usuario creado exitosamente.' });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ success: false, message: 'Error al crear usuario' });
  }
});

// 3. Actualizar un usuario (Rol, Nombre, Correo)
app.put('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol } = req.body;
  try {
    await pool.query(
      'UPDATE Usuarios SET Nombre = ?, Correo = ?, Rol = ? WHERE IdUsuario = ?',
      [nombre, correo, rol, id]
    );
    res.json({ success: true, message: 'Usuario actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
});

// 4. Eliminar un usuario
app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM Usuarios WHERE IdUsuario = ?', [id]);
    res.json({ success: true, message: 'Usuario eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
  }
});

// --- RUTA: REPORTE TOP 5 PRODUCTOS (Llama al SP) ---
app.post('/api/reportes/top', async (req, res) => {
    const { inicio, fin } = req.body; 
    
    try {
        // Ejecutamos el procedimiento almacenado
        const [rows] = await pool.query('CALL sp_top_productos(?, ?)', [inicio, fin]);
        
        // MySQL devuelve el resultado en la posición 0
        res.json(rows[0]); 
        
    } catch (error) {
        console.error('Error en reporte top:', error);
        res.status(500).json({ error: 'Error al generar el reporte' });
    }
});

// ====================================================================
// PASO 4: INICIAR EL SERVIDOR
// ====================================================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express iniciado en: http://localhost:${PORT}`);
  console.log('¡Tu API está lista para recibir peticiones del frontend!');
  testDbConnection(); // Probar la conexión a la base de datos al iniciar
});