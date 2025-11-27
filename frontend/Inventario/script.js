// ==================== CONFIGURACIÓN ====================
const API_URL = 'http://localhost:3000';

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

    //logica de control de acceso
    const userRole = localStorage.getItem('usuarioRol');
    const rolesNoPermitidos = ['Cajero/Mesero']; // Roles que solo deben ver
    if (rolesNoPermitidos.includes(userRole)) {
        // Deshabilitar todos los botones de edición y ordenar para el Mesero/Cajero
        document.querySelectorAll('.btn_editar, .btn_ordenar').forEach((btn) => {
            btn.disabled = true;
            btn.style.opacity = '0.4'; // Retroalimentación visual de que está deshabilitado
            btn.style.cursor = 'not-allowed';

            // Opcional: Si el botón intenta abrir un modal, esto lo previene:
            btn.onclick = (e) => {
                e.stopPropagation(); // Prevenir que el evento suba
                alert('Acceso de modificación restringido al rol de ' + userRole);
            };
        });

        // Finalizar la función aquí, sin adjuntar los event listeners originales
        return;
    }
    //fiin

    // Botones editar
    const botonesEditar = document.querySelectorAll('.btn_editar');
    botonesEditar.forEach((boton) => {
        boton.onclick = function () {
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
        boton.onclick = function () {
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
formModal.addEventListener('submit', async function (e) {
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

// Cerrar modales
spanCerrar?.addEventListener('click', cerrarModal);
btnCancelar?.addEventListener('click', cerrarModal);
closeButton?.addEventListener('click', cerrarModalOrdenar);

window.addEventListener('click', function (event) {
    if (event.target === modal) {
        cerrarModal();
    }
    if (event.target === ordenModal) {
        cerrarModalOrdenar();
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

document.addEventListener('DOMContentLoaded', function () {
    console.log('🚀 Inicializando sistema de inventario...');

    // Cargar productos después de que el DOM esté listo
    setTimeout(() => {
        cargarProductos();
    }, 100);
});

document.addEventListener("DOMContentLoaded", () => {
    const rol = localStorage.getItem("usuarioRol");
    if (rol === "Administrador") {
        document.getElementById("linkUsuarios").style.display = "inline-block";
    }
});

