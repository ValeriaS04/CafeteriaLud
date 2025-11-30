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
app.get('/api/pedidos', async (req, res) => {
  try {
    const query = `
      SELECT 
        p.IdPedido,
        c.Nombre AS NombreCliente,
        p.Fecha,
        p.Total,
        ROUND(p.Total / 1.16, 2) as Subtotal,
        CalcularIVA(ROUND(p.Total / 1.16, 2)) as IVA,
        u.Nombre AS NombreUsuario,
        p.Estado
      FROM Pedidos p
      JOIN Clientes c ON p.IdCliente = c.IdCliente
      JOIN Usuarios u ON p.IdUsuario = u.IdUsuario
      WHERE p.Estado = 'Pendiente'
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

// ======================================
// RUTA: Obtener información del cliente de un pedido
// ======================================
app.get('/api/pedidos/:id/cliente', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT c.Nombre, c.Email 
            FROM Pedidos p
            JOIN Clientes c ON p.IdCliente = c.IdCliente
            WHERE p.IdPedido = ?
        `;
        const [results] = await pool.query(query, [id]);
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }
        
        res.json({
            nombre: results[0].Nombre,
            email: results[0].Email
        });
        
    } catch (error) {
        console.error('Error al obtener cliente del pedido:', error);
        res.status(500).json({ error: 'Error al obtener información del cliente' });
    }
});

// ======================================
// RUTA: Enviar ticket por email
// ======================================
app.post('/api/pedidos/enviar-ticket', async (req, res) => {
    const { orderId, email, orderSummary, details } = req.body;

    try {
        // 🟢 NUEVO: Calcular subtotal e IVA para el ticket
        const subtotal = parseFloat(orderSummary.Total) - parseFloat(orderSummary.IVA);
        
        // Configurar el transportador
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // 🟢 MODIFICADO: Ticket con desglose de IVA
        const ticketHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .ticket { max-width: 600px; margin: 0 auto; border: 2px solid #5a3d31; border-radius: 10px; padding: 20px; }
                    .header { text-align: center; background: #5a3d31; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .details { margin: 15px 0; }
                    .product-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    .product-table th, .product-table td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    .product-table th { background: #f5f5f5; }
                    .total-breakdown { text-align: right; font-size: 1.1em; margin-top: 20px; }
                    .total-breakdown div { margin: 5px 0; }
                    .total-final { font-size: 1.3em; font-weight: bold; border-top: 2px solid #5a3d31; padding-top: 10px; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <div class="header">
                        <h1>🍵 Cafetería JAVA</h1>
                        <h2>Ticket de Compra #${orderId}</h2>
                    </div>
                    
                    <div class="details">
                        <p><strong>Cliente:</strong> ${orderSummary.NombreCliente}</p>
                        <p><strong>Fecha:</strong> ${new Date(orderSummary.Fecha).toLocaleString('es-MX')}</p>
                        <p><strong>Atendido por:</strong> ${orderSummary.NombreUsuario}</p>
                        <p><strong>Estado:</strong> ${orderSummary.Estado}</p>
                    </div>
                    
                    <table class="product-table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cantidad</th>
                                <th>Precio Unit.</th>
                                <th>Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${details.map(item => `
                                <tr>
                                    <td>${item.NombreProducto}</td>
                                    <td>${item.Cantidad}</td>
                                    <td>$${parseFloat(item.PrecioUnitario).toFixed(2)}</td>
                                    <td>$${parseFloat(item.Subtotal).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="total-breakdown">
                        <div><strong>Subtotal:</strong> $${subtotal.toFixed(2)}</div>
                        <div><strong>IVA (16%):</strong> $${parseFloat(orderSummary.IVA).toFixed(2)}</div>
                        <div class="total-final"><strong>TOTAL:</strong> $${parseFloat(orderSummary.Total).toFixed(2)}</div>
                    </div>
                    
                    <div class="footer">
                        <p>¡Gracias por su preferencia!</p>
                        <p>📍 Visítanos nuevamente en Cafetería JAVA</p>
                        <p>📞 Para cualquier duda, contáctanos</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Configurar el correo
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `🎫 Ticket de Compra - Cafetería JAVA #${orderId}`,
            html: ticketHTML
        };

        // Enviar el correo
        let info = await transporter.sendMail(mailOptions);
        console.log("✅ Ticket enviado: %s", info.messageId);
        
        res.json({ 
            success: true, 
            message: 'Ticket enviado correctamente',
            messageId: info.messageId
        });

    } catch (error) {
        console.error("❌ Error al enviar el ticket:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al enviar el ticket: ' + error.message 
        });
    }
});
// RUTAS PARA INSERTAR DATOS (POST)
// Ruta para registrar un nuevo pedido completo
app.post('/api/pedidos', async (req, res) => {
  // 1. Recibir los datos del frontend (incluyendo IdCliente)
  const { idCliente, total, idUsuario, productos } = req.body;

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 🟢 NUEVO: Calcular IVA usando la función MySQL
    const [ivaResult] = await connection.query('SELECT CalcularIVA(?) as iva', [total]);
    const iva = parseFloat(ivaResult[0].iva);
    const totalConIVA = parseFloat((parseFloat(total) + iva).toFixed(2));

    // 2. Insertar en la tabla PEDIDOS (IdCliente, Total, IdUsuario, Estado)
    // 🟢 CAMBIO: Usar totalConIVA en lugar de total
    const pedidoQuery = 'INSERT INTO Pedidos (IdCliente, Total, IdUsuario, Estado) VALUES (?, ?, ?, "Pendiente")';
    const [pedidoResult] = await connection.query(pedidoQuery, [idCliente, totalConIVA, idUsuario]);
    const idPedido = pedidoResult.insertId;

    // 3. Insertar cada producto en DETALLE_PEDIDOS y actualizar stock
    for (const producto of productos) {
      // Insertar detalle (DetallePedidos)
      await connection.query(
        'INSERT INTO detallepedidos (IdPedido, IdProducto, Cantidad, Subtotal) VALUES (?, ?, ?, ?)',
        [idPedido, producto.id, producto.cantidad, producto.subtotal]
      );

      // Actualizar stock (Productos) - comentado por ahora
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
    console.error('❌ ERROR REAL:', error.sqlMessage || error.message);

    res.status(500).json({
      success: false,
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

// ==================================================
// RUTAS DE GESTIÓN DE CLIENTES (PARA PEDIDOS)
// ==================================================
// 1. Buscar clientes por nombre
app.get('/api/clientes/buscar', async (req, res) => {
    const { nombre } = req.query;
    try {
        // Busca clientes que coincidan con el nombre (LIKE)
        const [clientes] = await pool.query(
            'SELECT * FROM Clientes WHERE Nombre LIKE ?', 
            [`%${nombre}%`]
        );
        res.json(clientes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar cliente' });
    }
});

// 2. Registrar un nuevo cliente rápido
app.post('/api/clientes', async (req, res) => {
    const { nombre, email } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO Clientes (Nombre, Email) VALUES (?, ?)',
            [nombre, email || null] // El email es opcional
        );
        res.json({ success: true, id: result.insertId, nombre: nombre });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al registrar cliente' });
    }
});

// ==================================================
// BLOQUE: CREACIÓN DE PRODUCTOS CON RECETA
// ==================================================
// 1. Ruta para llenar el "Select" de ingredientes
app.get('/api/inventario/insumos', async (req, res) => {
    try {
        // MODIFICADO: WHERE IdCategoriaInventario IN (1, 2, 3)
        // Esto trae solo Bebidas, Comidas y Envases. Ignora Limpieza (4).
        const query = `
            SELECT IdInventario, NombreProducto 
            FROM Inventario 
            WHERE IdCategoriaInventario IN (1, 2, 3) 
            ORDER BY NombreProducto
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar lista de insumos' });
    }
});
// 2. Ruta Transaccional: Guarda Producto + Receta
app.post('/api/inventario/productos-con-receta', async (req, res) => {
    const { Nombre, Descripcion, Precio, Stock, IdCategoria, Imagen, Receta } = req.body;
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        // A. Insertar Producto
        const [prodRes] = await connection.query(
            'INSERT INTO Productos (Nombre, Descripcion, Precio, Stock, IdCategoria, ImagenUrl) VALUES (?, ?, ?, ?, ?, ?)',
            [Nombre, Descripcion, Precio, Stock, IdCategoria, Imagen]
        );
        const nuevoIdProducto = prodRes.insertId;
        // B. Insertar Receta
        if (Receta && Receta.length > 0) {
            for (const ing of Receta) {
                await connection.query(
                    'INSERT INTO Recetas (IdProducto, IdInventario, CantidadInsumo) VALUES (?, ?, ?)',
                    [nuevoIdProducto, ing.IdInventario, ing.CantidadInsumo]
                );
            }
        }
        await connection.commit();
        res.json({ success: true, message: 'Producto creado.' });
    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ success: false, message: 'Error: ' + error.message });
    } finally {
        if (connection) connection.release();
    }
});

// --- RUTA CORREGIDA: CREAR NUEVO INSUMO ---
app.post('/api/inventario/nuevo-insumo', async (req, res) => {
    // CORRECCIÓN: Aquí leíamos 'idCategoria', pero el frontend envía 'categoria'.
    // Ahora leemos 'categoria' para que coincida.
    const { nombre, cantidad, categoria, imagen } = req.body;

    try {
        const [result] = await pool.query(
            'INSERT INTO Inventario (NombreProducto, Cantidad, IdCategoriaInventario, ImagenUrl) VALUES (?, ?, ?, ?)',
            [nombre, cantidad, categoria, imagen] // Usamos la variable correcta aquí
        );
        res.json({ success: true, message: 'Insumo agregado correctamente' });
    } catch (error) {
        console.error("Error SQL:", error.sqlMessage || error.message); // Para que veas el error real en la terminal
        res.status(500).json({ success: false, message: 'Error al guardar insumo: ' + (error.sqlMessage || error.message) });
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