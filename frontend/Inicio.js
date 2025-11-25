document.querySelector('button').addEventListener('click', function(e) {
    e.preventDefault();
    const email = document.querySelector('input[type="email"]').value;
    const password = document.querySelector('input[type="password"]').value;
    
    // Validación básica (aquí deberías validar contra datos reales)
    if(email && password) {
        localStorage.setItem('sesionActiva', 'true');
        localStorage.setItem('usuarioEmail', email);
        window.location.href = 'Gestion de pedidos.html'; // o 'panel.html'
    }
});