// ====================================================================
// ARCHIVO: inventarioRoutes.js
// Rutas SIMPLIFICADAS para la gestión del inventario de la cafetería
// ====================================================================

module.exports = function(pool) {
  const express = require('express');
  const router = express.Router();

  // 1️⃣ Obtener un producto específico del inventario por ID (SIMPLIFICADO)
  router.get('/producto/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      console.log(`🔍 Solicitando producto ID: ${id}`);
      
      const query = `
        SELECT 
          IdInventario,
          NombreProducto,
          Cantidad
        FROM inventario 
        WHERE IdInventario = ?
      `;
      
      const [results] = await pool.query(query, [id]);
      
      if (results.length > 0) {
        const producto = results[0];
        
        console.log(`✅ Producto encontrado: ${producto.NombreProducto}`);
        
        res.json({
          success: true,
          producto: producto
        });
      } else {
        console.log(`❌ Producto no encontrado: ${id}`);
        res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
    } catch (error) {
      console.error('❌ Error al obtener producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  });

  // 2️⃣ Actualizar un producto del inventario (ULTRA-SIMPLIFICADO)
  router.put('/producto/:id', async (req, res) => {
    const { id } = req.params;
    const { cantidad } = req.body;
    
    console.log('📥 Recibiendo actualización:', { id, cantidad });
    
    try {
      // Validar que los datos existen
      if (cantidad === undefined) {
        console.log('❌ Datos incompletos en la solicitud');
        return res.status(400).json({
          success: false,
          message: 'Datos incompletos: cantidad es requerida'
        });
      }

      // Validar tipo de dato
      const nuevaCantidad = parseInt(cantidad);
      
      if (isNaN(nuevaCantidad)) {
        console.log('❌ Dato inválido:', { cantidad });
        return res.status(400).json({
          success: false,
          message: 'Dato inválido: cantidad debe ser un número entero'
        });
      }

      console.log(`🔄 Actualizando producto ID: ${id} con cantidad: ${nuevaCantidad}`);
      
      // SOLO actualizar Cantidad
      const updateQuery = `
        UPDATE inventario 
        SET Cantidad = ?
        WHERE IdInventario = ?
      `;
      
      const [result] = await pool.query(updateQuery, [nuevaCantidad, id]);
      
      if (result.affectedRows === 0) {
        console.log(`❌ No se afectaron filas en la actualización: ${id}`);
        return res.status(404).json({
          success: false,
          message: 'No se pudo actualizar el producto - ninguna fila afectada'
        });
      }
      
      // Obtener el producto actualizado
      const selectQuery = `
        SELECT 
          IdInventario,
          NombreProducto,
          Cantidad
        FROM inventario 
        WHERE IdInventario = ?
      `;
      
      const [updatedProduct] = await pool.query(selectQuery, [id]);
      
      if (updatedProduct.length === 0) {
        console.log(`❌ No se pudo obtener el producto actualizado: ${id}`);
        return res.status(404).json({
          success: false,
          message: 'Producto actualizado pero no se pudo obtener la información actualizada'
        });
      }
      
      const producto = updatedProduct[0];
      
      console.log(`✅ Producto actualizado correctamente. Filas afectadas: ${result.affectedRows}`);
      
      res.json({
        success: true,
        message: 'Producto actualizado correctamente',
        cantidad_actualizada: nuevaCantidad,
        producto: {
          id: producto.IdInventario,
          nombre: producto.NombreProducto,
          cantidad: producto.Cantidad
        }
      });
      
    } catch (error) {
      console.error('❌ Error al actualizar producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor: ' + error.message
      });
    }
  });

  // 3️⃣ Obtener todos los productos de inventario por categoría (SIMPLIFICADO)
  router.get('/categoria/:idCategoria', async (req, res) => {
    const { idCategoria } = req.params;
    
    try {
      console.log(`📦 Solicitando productos de categoría: ${idCategoria}`);
      
      const query = `
        SELECT 
          i.IdInventario,
          i.NombreProducto,
          i.Cantidad,
          c.Nombre as Categoria
        FROM inventario i
        JOIN categorias_inventario c ON i.IdCategoriaInventario = c.IdCategoriaInventario
        WHERE i.IdCategoriaInventario = ?
        ORDER BY i.NombreProducto
      `;
      
      const [results] = await pool.query(query, [idCategoria]);
      console.log(`✅ Encontrados ${results.length} productos para categoría ${idCategoria}`);
      
      res.json(results);
    } catch (error) {
      console.error('❌ Error al obtener productos por categoría:', error);
      res.status(500).json({ 
        error: 'Error al obtener productos',
        detalles: error.message
      });
    }
  });

  // 4️⃣ Obtener todas las categorías de inventario
  router.get('/categorias', async (req, res) => {
    try {
      console.log('📂 Solicitando categorías de inventario');
      
      const query = `
        SELECT 
          IdCategoriaInventario,
          Nombre,
          Descripcion
        FROM categorias_inventario
        ORDER BY Nombre
      `;
      
      const [results] = await pool.query(query);
      console.log(`✅ Encontradas ${results.length} categorías`);
      
      res.json(results);
    } catch (error) {
      console.error('❌ Error al obtener categorías:', error);
      res.status(500).json({ 
        error: 'Error al obtener categorías',
        detalles: error.message
      });
    }
  });

  // 5️⃣ Crear nuevo producto en inventario (SIMPLIFICADO)
  router.post('/producto', async (req, res) => {
    const {
      IdCategoriaInventario,
      NombreProducto,
      Cantidad
    } = req.body;
    
    try {
      console.log('➕ Creando nuevo producto:', { NombreProducto, IdCategoriaInventario });
      
      const query = `
        INSERT INTO inventario (
          IdCategoriaInventario,
          NombreProducto,
          Cantidad
        ) VALUES (?, ?, ?)
      `;
      
      const [result] = await pool.query(query, [
        IdCategoriaInventario,
        NombreProducto,
        Cantidad || 0
      ]);
      
      console.log(`✅ Producto creado correctamente. ID: ${result.insertId}`);
      
      res.status(201).json({
        success: true,
        message: 'Producto creado correctamente',
        id: result.insertId
      });
    } catch (error) {
      console.error('❌ Error al crear producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear producto: ' + error.message
      });
    }
  });

  // 6️⃣ Eliminar producto del inventario
  router.delete('/producto/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
      console.log(`🗑️ Eliminando producto ID: ${id}`);
      
      const query = 'DELETE FROM inventario WHERE IdInventario = ?';
      const [result] = await pool.query(query, [id]);
      
      if (result.affectedRows === 0) {
        console.log(`❌ Producto no encontrado para eliminar: ${id}`);
        return res.status(404).json({
          success: false,
          message: 'Producto no encontrado'
        });
      }
      
      console.log(`✅ Producto eliminado correctamente. Filas afectadas: ${result.affectedRows}`);
      
      res.json({
        success: true,
        message: 'Producto eliminado correctamente'
      });
    } catch (error) {
      console.error('❌ Error al eliminar producto:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar producto: ' + error.message
      });
    }
  });

  // 7️⃣ Endpoint de salud/verificación (para debugging)
  router.get('/status', async (req, res) => {
    try {
      console.log('🔍 Verificando estado del servicio de inventario');
      
      // Verificar conexión a la base de datos
      const [dbResult] = await pool.query('SELECT 1 as test');
      
      // Verificar tablas existentes
      const [tablas] = await pool.query('SHOW TABLES LIKE "inventario"');
      const [categorias] = await pool.query('SHOW TABLES LIKE "categorias_inventario"');
      
      // Contar productos
      const [conteoProductos] = await pool.query('SELECT COUNT(*) as total FROM inventario');
      
      res.json({
        status: 'ok',
        database: dbResult.length > 0 ? 'conectado' : 'error',
        tablas: {
          inventario: tablas.length > 0,
          categorias_inventario: categorias.length > 0
        },
        total_productos: conteoProductos[0].total,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ Error en endpoint de status:', error);
      res.status(500).json({
        status: 'error',
        error: error.message
      });
    }
  });

  // 8️⃣ Obtener inventario completo usando la vista vw_inventario_completo
  router.get('/vistas/inventario-completo', async (req, res) => {
    try {
      console.log('📊 Solicitando inventario completo desde vista');
      
      const query = 'SELECT * FROM vw_inventario_completo ORDER BY Categoria, Nombre';
      const [results] = await pool.query(query);
      
      console.log(`✅ Vista cargada: ${results.length} productos encontrados`);
      
      res.json(results);
    } catch (error) {
      console.error('❌ Error al cargar vista de inventario completo:', error);
      
      // Si la vista no existe, proporcionar un mensaje útil
      if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes('vw_inventario_completo')) {
        return res.status(404).json({
          success: false,
          message: 'La vista vw_inventario_completo no existe. Ejecuta el SQL de creación de vistas en la base de datos.',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error al cargar el inventario completo',
        error: error.message
      });
    }
  });

  // 9️⃣ Obtener stock crítico usando la vista vw_stock_critico
  router.get('/vistas/stock-critico', async (req, res) => {
    try {
      console.log('🔔 Solicitando stock crítico desde vista');
      
      const query = 'SELECT * FROM vw_stock_critico ORDER BY Cantidad ASC';
      const [results] = await pool.query(query);
      
      console.log(`✅ Vista de stock crítico cargada: ${results.length} productos con stock bajo`);
      
      res.json(results);
    } catch (error) {
      console.error('❌ Error al cargar vista de stock crítico:', error);
      
      // Si la vista no existe, proporcionar un mensaje útil
      if (error.code === 'ER_NO_SUCH_TABLE' || error.message.includes('vw_stock_critico')) {
        return res.status(404).json({
          success: false,
          message: 'La vista vw_stock_critico no existe. Ejecuta el SQL de creación de vistas en la base de datos.',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error al cargar el stock crítico',
        error: error.message
      });
    }
  });

  // 🔟 Fallback: Obtener stock bajo sin usar vistas (método alternativo)
  router.get('/stock-bajo', async (req, res) => {
    try {
      console.log('📉 Solicitando productos con stock bajo (método alternativo)');
      
      const query = `
        SELECT 
          i.IdInventario as ID,
          i.NombreProducto as Nombre,
          c.Nombre as Categoria,
          i.Cantidad as Cantidad,
          CASE 
            WHEN i.Cantidad <= 2 THEN 'CRÍTICO'
            WHEN i.Cantidad <= 5 THEN 'BAJO'
            ELSE 'NORMAL'
          END as Estado
        FROM inventario i
        JOIN categorias_inventario c ON i.IdCategoriaInventario = c.IdCategoriaInventario
        WHERE i.Cantidad < 5
        ORDER BY i.Cantidad ASC
      `;
      
      const [results] = await pool.query(query);
      console.log(`✅ ${results.length} productos con stock bajo encontrados`);
      
      res.json(results);
    } catch (error) {
      console.error('❌ Error al obtener stock bajo:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener productos con stock bajo',
        error: error.message
      });
    }
  });

  return router;
};
