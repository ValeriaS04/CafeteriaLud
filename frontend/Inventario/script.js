// ==================== CONFIGURACIÓN ====================
const API_URL = 'http://localhost:3000';
//validacion encargado inventario
const userRole = localStorage.getItem('usuarioRol');

      if (userRole === 'Encargado de inventario') {
          // Encargado de Inventario (Debe ver: Inicio, Inventario, Cerrar Sesión)
          const pedidosLink = document.querySelector('nav a[href*="Gestion de pedidos.html"]');
          const panelLink = document.querySelector('nav a[href*="Panel.html"]');
          
          // 2. Restricción del Encargado: Ocultar Pedidos y Panel
          if (pedidosLink) pedidosLink.style.display = 'none';
          if (panelLink) panelLink.style.display = 'none';
      }
      //fin validacion

// ==================== ELEMENTOS DEL DOM ====================
const modal = document.getElementById('modal_editar');
const spanCerrar = document.getElementsByClassName('cerrar')[0];
const btnCancelar = document.querySelector('.btn_cancelar');
const formModal = document.getElementById('form_modal');
const inputNombreProducto = document.getElementById('nombre_producto');
const cantidadTotalInput = document.getElementById('cantidad_total');
const contenedorInventario = document.querySelector('.inventario');

// ==================== ELEMENTOS DEL MODAL ORDENAR ====================
const ordenModal = document.getElementById('ordenModal');
const closeButton = ordenModal?.querySelector('.close-button');
const ordenForm = document.getElementById('ordenForm');
const productoTitulo = document.getElementById('productoTitulo');
const ordenProductoNombre = document.getElementById('ordenProductoNombre');
const ordenDestinoInput = document.getElementById('ordenDestino');

let productoActual = null;
let productoNombreActual = null;

// ==================== FUNCIONES DE RESTRICCIONES ====================

function configurarRestriccionesPorRol() {
    const userRole = localStorage.getItem('usuarioRol');
    console.log(`🔐 Rol detectado: ${userRole}`);
    
    if (!userRole) {
        console.warn('⚠️ No se encontró rol de usuario');
        return;
    }

    // Elementos del DOM a controlar
    const usuariosLink = document.getElementById('linkUsuarios');
    const btnReporteInventario = document.getElementById('btnReporteInventario');

    // 1. ADMINISTRADOR - Acceso completo
    if (userRole === 'Administrador') {
        console.log('✅ Administrador - Acceso completo');
        if (usuariosLink) usuariosLink.style.display = 'inline-block';
        if (btnReporteInventario) btnReporteInventario.style.display = 'block';
    }
    
    // 2. ENCARGADO DE INVENTARIO - Acceso a inventario y reportes
    else if (userRole === 'Encargado de inventario') {
        console.log('✅ Encargado de Inventario - Acceso a reportes');
        if (usuariosLink) usuariosLink.style.display = 'none';
        if (btnReporteInventario) btnReporteInventario.style.display = 'block';
    }
    
    // 3. CAJERO/MESERO - Solo funciones básicas (sin reportes ni edición)
    else if (userRole === 'Cajero/Mesero') {
        console.log('✅ Cajero/Mesero - Acceso básico (sin reportes)');
        if (usuariosLink) usuariosLink.style.display = 'none';
        if (btnReporteInventario) btnReporteInventario.style.display = 'none';
        // En el bloque de Cajero/Mesero, agregar:
        if (btnReporteInventario) btnReporteInventario.style.display = 'none';
    }
    
    // 4. ROL NO RECONOCIDO
    else {
        console.warn('⚠️ Rol no reconocido:', userRole);
    }
}

// Función para deshabilitar funciones de inventario para Mesero/Cajero
function deshabilitarFuncionesInventario() {
    const userRole = localStorage.getItem('usuarioRol');
    const rolesNoPermitidos = ['Cajero/Mesero'];
    
    if (rolesNoPermitidos.includes(userRole)) {
        // Deshabilitar todos los botones de edición y ordenar para el Mesero/Cajero
        document.querySelectorAll('.btn_editar, .btn_ordenar').forEach((btn) => {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.style.cursor = 'not-allowed';
            
            btn.onclick = (e) => {
                e.stopPropagation();
                alert('Acceso de modificación restringido al rol de ' + userRole);
            };
        });
        
        return true; // Indicar que se aplicaron restricciones
    }
    return false; // No se aplicaron restricciones
}

// ==================== FUNCIONES PRINCIPALES ====================

// Determinar categoría actual basada en la página
function obtenerCategoriaActual() {
    const url = window.location.pathname;
    const nombreArchivo = url.substring(url.lastIndexOf('/') + 1);
    
    const mapeoCategorias = {
        'inventario_bebidas.html': 1,  // Bebidas
        'inventario_comidas.html': 2,  // Comida
        'inventario_envases.html': 3,  // Envases
        'inventario_limpieza.html': 4, // Limpieza
        'inventario_menu.html': 1      // Bebidas por defecto
    };
    
    return mapeoCategorias[nombreArchivo] || 1;
}

// Cargar productos desde la API
async function cargarProductos() {
    try {
        const categoriaId = obtenerCategoriaActual();
        console.log(`🔍 Cargando productos de categoría ${categoriaId}...`);
        
        const response = await fetch(`${API_URL}/api/inventario/categoria/${categoriaId}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const productos = await response.json();
        console.log(`✅ ${productos.length} productos recibidos`);
        
        actualizarCantidadesProductos(productos);
        
    } catch (error) {
        console.error('❌ Error al cargar productos:', error);
        mostrarErrorCarga(error);
    }
}

// Actualizar cantidades de productos existentes
function actualizarCantidadesProductos(productos) {
    const productosExistentes = document.querySelectorAll('.producto');
    
    productosExistentes.forEach(productoElement => {
        const nombreProducto = productoElement.querySelector('.nombre_del_producto')?.textContent?.trim();
        
        if (!nombreProducto) return;
        
        const productoBD = productos.find(p => p.NombreProducto?.trim() === nombreProducto);
        
        if (productoBD) {
            const inputCantidad = productoElement.querySelector('.cantidad_producto');
            if (inputCantidad) {
                inputCantidad.value = parseInt(productoBD.Cantidad) || 0;
            }
        }
    });
    
    agregarEventListeners();
}

// Obtener ID del producto por nombre
async function obtenerIdProducto(nombreProducto) {
    try {
        const categoriaId = obtenerCategoriaActual();
        const response = await fetch(`${API_URL}/api/inventario/categoria/${categoriaId}`);
        const productos = await response.json();
        
        const producto = productos.find(p => 
            p.NombreProducto?.trim().toLowerCase() === nombreProducto.trim().toLowerCase()
        );
        
        return producto ? producto.IdInventario : null;
    } catch (error) {
        console.error('Error al obtener ID del producto:', error);
        return null;
    }
}

// Obtener configuración del producto
async function obtenerConfiguracionProducto(idProducto) {
    try {
        const response = await fetch(`${API_URL}/api/inventario/producto/${idProducto}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            return {
                id: data.producto.IdInventario,
                nombre: data.producto.NombreProducto,
                cantidadActual: parseInt(data.producto.Cantidad) || 0
            };
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('❌ Error al obtener configuración:', error);
        alert('Error al cargar los datos del producto');
        return null;
    }
}

// Abrir modal para editar
async function abrirModal(nombreProducto) {
    try {
        console.log(`📝 Abriendo modal para producto: ${nombreProducto}`);
        
        // Obtener ID del producto por nombre
        const idProducto = await obtenerIdProducto(nombreProducto);
        
        if (!idProducto) {
            alert('Error: No se encontró el producto en la base de datos');
            return;
        }
        
        const config = await obtenerConfiguracionProducto(idProducto);
        
        if (!config) {
            alert('No se pudieron cargar los datos del producto');
            return;
        }
        
        productoNombreActual = nombreProducto;
        
        // Configurar modal
        inputNombreProducto.value = config.nombre;
        cantidadTotalInput.value = config.cantidadActual;
        
        // Enfocar el input de cantidad
        setTimeout(() => {
            cantidadTotalInput.focus();
            cantidadTotalInput.select();
        }, 100);
        
        modal.style.display = 'flex';
        
    } catch (error) {
        console.error('❌ Error al abrir modal:', error);
        alert('Error al abrir el editor: ' + error.message);
    }
}

// Actualizar producto en la base de datos
async function actualizarProducto(nombreProducto, nuevaCantidad) {
    try {
        console.log(`🔄 Actualizando producto: ${nombreProducto} a cantidad: ${nuevaCantidad}`);
        
        // Obtener ID del producto
        const idProducto = await obtenerIdProducto(nombreProducto);
        
        if (!idProducto) {
            alert('Error: No se encontró el producto en la base de datos');
            return;
        }
        
        const response = await fetch(`${API_URL}/api/inventario/producto/${idProducto}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cantidad: nuevaCantidad
            })
        });

        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Producto actualizado correctamente');
            
            // Actualizar la cantidad en el DOM
            if (productoActual) {
                const inputCantidad = productoActual.querySelector('.cantidad_producto');
                if (inputCantidad) {
                    inputCantidad.value = nuevaCantidad;
                }
            }
            
            // Cerrar modal y mostrar éxito
            cerrarModal();
            alert('¡Inventario actualizado correctamente!');
            
        } else {
            throw new Error(data.message || 'Error al actualizar el producto');
        }
        
    } catch (error) {
        console.error('❌ Error al actualizar producto:', error);
        alert('Error al actualizar el producto: ' + error.message);
    }
}

// ==================== FUNCIONES PARA REPORTE DE INVENTARIO ====================

// Cargar reporte completo de inventario
async function cargarReporteInventario() {
    try {
        console.log('📊 Cargando reporte de inventario completo...');
        
        const response = await fetch(`${API_URL}/api/inventario/vistas/inventario-completo`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const inventarioCompleto = await response.json();
        console.log(`✅ ${inventarioCompleto.length} productos cargados desde la vista`);

        generarHTMLReporte(inventarioCompleto);

    } catch (error) {
        console.error('❌ Error al cargar reporte de inventario:', error);
        mostrarErrorReporte(error);
    }
}

// Generar HTML del reporte con diseño IDÉNTICO al panel
function generarHTMLReporte(inventario) {
    const tablaReporteInventario = document.getElementById('tablaReporteInventario');
    if (!tablaReporteInventario) {
        console.error('❌ No se encontró el elemento tablaReporteInventario');
        return;
    }

    // Ordenar por ID (numéricamente)
    inventario.sort((a, b) => {
        const idA = parseInt(a.ID) || 0;
        const idB = parseInt(b.ID) || 0;
        return idA - idB;
    });

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: #2c3e50;">Todos los Productos</h3>
            <button id="btnStockBajo" class="btn-stock-bajo">
                <i class="fas fa-exclamation-triangle"></i> Ver Stock Bajo
            </button>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            <table class="detail-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Cantidad</th>
                    </tr>
                </thead>
                <tbody>
    `;

    inventario.forEach(item => {
        const cantidad = parseFloat(item.Cantidad) || 0;
        
        html += `
                    <tr>
                        <td>${item.ID || 'N/A'}</td>
                        <td>${item.Nombre || 'Producto sin nombre'}</td>
                        <td>${item.Categoria}</td>
                        <td>${cantidad}</td>
                    </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    console.log('🔄 Generando HTML del reporte...');
    tablaReporteInventario.innerHTML = html;
    
    // Agregar event listener al botón de stock bajo
    const btnStockBajo = document.getElementById('btnStockBajo');
    if (btnStockBajo) {
        btnStockBajo.addEventListener('click', cargarStockBajo);
    }
}

// Cargar solo productos con stock bajo
async function cargarStockBajo() {
    try {
        console.log('🔔 Cargando productos con stock bajo...');
        
        const response = await fetch(`${API_URL}/api/inventario/vistas/stock-critico`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const stockBajo = await response.json();
        
        if (stockBajo.length === 0) {
            mostrarMensajeSinStockBajo();
        } else {
            generarHTMLStockBajo(stockBajo);
        }

    } catch (error) {
        console.error('❌ Error al cargar stock bajo:', error);
        mostrarErrorReporte(error);
    }
}

// Generar HTML para productos con stock bajo
function generarHTMLStockBajo(stockBajo) {
    const tablaReporteInventario = document.getElementById('tablaReporteInventario');
    if (!tablaReporteInventario) return;
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 style="margin: 0; color: #dc3545;">
                <i class="fas fa-exclamation-triangle"></i> Productos con Stock Bajo
            </h3>
            <button id="btnTodosProductos" class="btn-todos-productos">
                <i class="fas fa-list"></i> Ver Todos los Productos
            </button>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            <table class="detail-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Producto</th>
                        <th>Categoría</th>
                        <th>Cantidad</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
    `;

    stockBajo.forEach(item => {
        const cantidad = parseFloat(item.Cantidad) || 0;
        
        html += `
                    <tr>
                        <td>${item.ID || 'N/A'}</td>
                        <td>${item.Nombre || 'Producto sin nombre'}</td>
                        <td>${item.Categoria}</td>
                        <td>${cantidad}</td>
                        <td style="color: ${item.Estado === 'CRÍTICO' ? '#dc3545' : '#ffc107'}; font-weight: bold;">
                            ${item.Estado || 'BAJO'}
                        </td>
                    </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
        <div style="margin-top: 15px; padding: 10px; background: #fff3cd; border-radius: 5px; color: #856404;">
            <i class="fas fa-info-circle"></i> 
            <strong>Total:</strong> ${stockBajo.length} producto(s) con stock bajo (menos de 5 unidades)
        </div>
    `;

    tablaReporteInventario.innerHTML = html;
    
    // Agregar event listener al botón de volver
    const btnTodosProductos = document.getElementById('btnTodosProductos');
    if (btnTodosProductos) {
        btnTodosProductos.addEventListener('click', cargarReporteInventario);
    }
}

// Mostrar mensaje cuando no hay stock bajo
function mostrarMensajeSinStockBajo() {
    const tablaReporteInventario = document.getElementById('tablaReporteInventario');
    if (!tablaReporteInventario) return;
    
    const html = `
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 48px; color: #28a745; margin-bottom: 20px;">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3 style="color: #28a745; margin-bottom: 10px;">¡Excelente!</h3>
            <p style="color: #666; margin-bottom: 20px;">No hay productos con stock bajo</p>
            <button onclick="cargarReporteInventario()" class="btn-todos-productos">
                <i class="fas fa-list"></i> Ver Todos los Productos
            </button>
        </div>
    `;
    
    tablaReporteInventario.innerHTML = html;
}

// Mostrar error en el reporte
function mostrarErrorReporte(error) {
    const tablaReporteInventario = document.getElementById('tablaReporteInventario');
    if (!tablaReporteInventario) return;
    
    tablaReporteInventario.innerHTML = `
        <div style="color: red; text-align: center; padding: 20px;">
            <h3>Error al cargar el reporte</h3>
            <p>${error.message}</p>
            <button onclick="cargarReporteInventario()" class="btn-reportes" style="margin-top: 10px;">
                Reintentar
            </button>
        </div>
    `;
}

// Abrir modal de reporte
function abrirModalReporte() {
    const modalReporteInventario = document.getElementById('modalReporteInventario');
    if (modalReporteInventario) {
        modalReporteInventario.style.display = 'flex';
        console.log('✅ Modal abierto, cargando reporte...');
        cargarReporteInventario();
    } else {
        console.error('❌ Modal de reporte no encontrado');
    }
}

// Cerrar modal de reporte
function cerrarModalReporte() {
    const modalReporteInventario = document.getElementById('modalReporteInventario');
    if (modalReporteInventario) {
        modalReporteInventario.style.display = 'none';
    }
}

// ==================== FUNCIONES PARA CORREOS ====================

// Función para Abrir el Modal de Ordenar
function abrirModalOrdenar(nombreProducto) {
    if (productoTitulo && ordenProductoNombre) {
        productoTitulo.textContent = nombreProducto;
        ordenProductoNombre.value = nombreProducto;
        document.getElementById('ordenCantidad').value = 1; 
        document.getElementById('ordenMotivo').value = '';
        ordenModal.style.display = 'flex';
    } else {
        console.error('❌ Elementos del modal de ordenar no encontrados');
    }
}

// Envío de orden por correo
async function enviarOrdenCorreo(orderData) {
    try {
        console.log('📧 Enviando orden:', orderData);

        const response = await fetch(`${API_URL}/api/ordenar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        const data = await response.json();

        if (response.ok && data.success) {
            alert(`✅ ${data.message}`);
            ordenModal.style.display = 'none';
        } else {
            alert(`❌ Error al enviar orden: ${data.message || 'Error de servidor desconocido'}`);
        }

    } catch (error) {
        console.error('Error de conexión con la API de Correo:', error);
        alert('❌ Error de conexión. Verifique el servidor Node.js.');
    }
}

// Cerrar modal
function cerrarModal() {
    modal.style.display = 'none';
    productoNombreActual = null;
    productoActual = null;
    formModal.reset();
}

// Cerrar modal ordenar
function cerrarModalOrdenar() {
    ordenModal.style.display = 'none';
}

// ==================== EVENT LISTENERS ====================

function agregarEventListeners() {
    console.log('🔗 Configurando event listeners...');
    
    // Verificar si se aplicaron restricciones para Mesero/Cajero
    const seAplicaronRestricciones = deshabilitarFuncionesInventario();
    
    // Si se aplicaron restricciones (Mesero/Cajero), no configurar los event listeners normales
    if (seAplicaronRestricciones) {
        console.log('ℹ️ Event listeners normales omitidos por restricciones de rol');
        return;
    }
    
    // Configurar botón de reporte de inventario (solo si está visible)
    const btnReporteInventario = document.getElementById('btnReporteInventario');
    if (btnReporteInventario && btnReporteInventario.style.display !== 'none') {
        btnReporteInventario.addEventListener('click', abrirModalReporte);
        console.log('✅ Event listener del botón de reporte configurado');
    }

    // Botones editar
    const botonesEditar = document.querySelectorAll('.btn_editar');
    botonesEditar.forEach((boton) => {
        boton.onclick = function() {
            productoActual = this.closest('.producto');
            const nombreProducto = productoActual.querySelector('.nombre_del_producto')?.textContent?.trim();
            
            if (nombreProducto) {
                abrirModal(nombreProducto);
            } else {
                alert('Error: No se pudo obtener el nombre del producto');
            }
        };
    });
    
    // Botones ordenar
    const botonesOrdenar = document.querySelectorAll('.btn_ordenar');
    botonesOrdenar.forEach(boton => {
        boton.onclick = function() {
            const productoElement = this.closest('.producto');
            const nombreProducto = productoElement.querySelector('.nombre_del_producto')?.textContent?.trim();
            
            if (nombreProducto) {
                abrirModalOrdenar(nombreProducto);
            } else {
                alert('Error: No se pudo obtener el nombre del producto');
            }
        };
    });
}

// Event listeners del modal editar
if (formModal) {
    formModal.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!productoNombreActual) {
            alert('Error: No hay un producto seleccionado');
            return;
        }

        const nuevaCantidad = parseInt(cantidadTotalInput.value);
        
        if (isNaN(nuevaCantidad) || nuevaCantidad < 0) {
            alert('Por favor ingrese una cantidad válida (número entero positivo)');
            return;
        }

        await actualizarProducto(productoNombreActual, nuevaCantidad);
    });
}

// Event listeners del modal ordenar
if (ordenForm) {
    ordenForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const producto = ordenProductoNombre.value;
        const cantidad = document.getElementById('ordenCantidad').value;
        const motivo = document.getElementById('ordenMotivo').value;
        const destino = ordenDestinoInput.value;
        const usuarioNombre = localStorage.getItem('usuarioNombre') || 'Usuario Cafetería';

        const orderData = {
            producto,
            cantidad: parseInt(cantidad, 10),
            motivo,
            destino,
            usuarioNombre 
        };

        await enviarOrdenCorreo(orderData);
    });
}

// ==================== CONFIGURACIÓN DE EVENT LISTENERS GLOBALES ====================

// Cerrar modales
if (spanCerrar) {
    spanCerrar.addEventListener('click', cerrarModal);
}
if (btnCancelar) {
    btnCancelar.addEventListener('click', cerrarModal);
}
if (closeButton) {
    closeButton.addEventListener('click', cerrarModalOrdenar);
}

const closeReporteInventario = document.getElementById('closeReporteInventario');
if (closeReporteInventario) {
    closeReporteInventario.addEventListener('click', cerrarModalReporte);
}

// Cerrar modales al hacer clic fuera
window.addEventListener('click', function(event) {
    if (event.target === modal) {
        cerrarModal();
    }
    if (event.target === ordenModal) {
        cerrarModalOrdenar();
    }
    const modalReporteInventario = document.getElementById('modalReporteInventario');
    if (event.target === modalReporteInventario) {
        cerrarModalReporte();
    }
});

// ==================== FUNCIONES AUXILIARES ====================

// Mostrar error de carga
function mostrarErrorCarga(error) {
    if (document.querySelectorAll('.producto').length === 0) {
        contenedorInventario.innerHTML = `
            <div class="error-carga">
                <h3>Error al cargar el inventario</h3>
                <p>${error.message}</p>
                <button onclick="cargarProductos()">Reintentar</button>
            </div>
        `;
    }
}

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando sistema de inventario...');
    
    // 1. PRIMERO: Configurar restricciones por rol
    configurarRestriccionesPorRol();
    
    // 2. Configurar el cierre del modal de reporte
    const closeReporteInventario = document.getElementById('closeReporteInventario');
    if (closeReporteInventario) {
        closeReporteInventario.addEventListener('click', cerrarModalReporte);
    }

    // 3. Cargar productos después de que el DOM esté listo
    setTimeout(() => {
        cargarProductos();
    }, 100);
});