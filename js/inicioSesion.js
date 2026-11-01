document.addEventListener('DOMContentLoaded', () => {

    // 1. Guardar rol al hacer clic en index.html
    const roleButtons = document.querySelectorAll('.role-btn');
    roleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedRole = button.getAttribute('data-role');
            if (selectedRole) {
                localStorage.setItem('userRole', selectedRole);
            }
        });
    });

    // 2. Mostrar el rol activo en InicioSesion.html o ExitoRegistro.html
    const savedRole = localStorage.getItem('userRole') || 'Estudiante';
    const userRoleDisplay = document.getElementById('userRoleDisplay');
    const registeredRoleDisplay = document.getElementById('registeredRoleDisplay');

    if (userRoleDisplay) userRoleDisplay.textContent = savedRole;
    if (registeredRoleDisplay) registeredRoleDisplay.textContent = savedRole.toLowerCase();

    // 3. Mostrar u ocultar contraseñas (Ojo 👁️)
    const togglePasswordBtns = document.querySelectorAll('.toggle-password-btn');
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const passwordInput = btn.previousElementSibling;
            if (passwordInput && passwordInput.type === 'password') {
                passwordInput.type = 'text';
                btn.textContent = '🙈';
            } else if (passwordInput) {
                passwordInput.type = 'password';
                btn.textContent = '👁️';
            }
        });
    });

    // 4. Enviar datos del registro a la BD PostgreSQL vía API Python
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Capturar elementos de la interfaz por su ID o atributo name
            const nameInput = document.getElementById('nombre') || document.querySelector('input[name="nombre"]');
            const apellidoInput = document.getElementById('apellidos') || document.querySelector('input[name="apellidos"]');
            const emailInput = document.getElementById('correo') || document.querySelector('input[type="email"]');
            const userInput = document.getElementById('usuario') || document.querySelector('input[name="usuario"]');
            const passInput = document.getElementById('contrasena') || document.querySelector('input[name="contrasena"]');

            // Extraer y limpiar valores de los inputs
            const nombreVal = nameInput ? nameInput.value.trim() : '';
            const apellidoVal = apellidoInput ? apellidoInput.value.trim() : '';
            const nombreCompleto = apellidoVal ? `${nombreVal} ${apellidoVal}`.trim() : nombreVal;

            const correoVal = emailInput ? emailInput.value.trim() : '';
            const usuarioVal = userInput ? userInput.value.trim() : nombreVal;
            const contrasenaVal = passInput ? passInput.value.trim() : '';

            try {
                const response = await fetch('http://localhost:5000/api/registro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nombre: nombreCompleto,
                        usuario: usuarioVal,
                        correo: correoVal,
                        contrasena: contrasenaVal,
                        rol: savedRole
                    })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem('userName', nombreVal || usuarioVal);
                    
                    // Redirección condicional:
                    if (savedRole === 'Docente' || savedRole === 'Padre o Madre') {
                        window.location.href = 'Login.html';
                    } else {
                        window.location.href = 'ExitoRegistro.html';
                    }
                } else {
                    alert(data.message || 'Error al completar el registro.');
                }
            } catch (error) {
                console.error('Error de conexión con el backend:', error);
                alert('No se pudo conectar con el servidor en Python.');
            }
        });
    }

    // 5. Cargar el nombre registrado en ExitoRegistro.html
    const registeredNameDisplay = document.getElementById('registeredNameDisplay');
    if (registeredNameDisplay) {
        const savedName = localStorage.getItem('userName') || 'Usuario';
        registeredNameDisplay.textContent = savedName;
    }

});