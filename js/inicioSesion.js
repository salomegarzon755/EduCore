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

    // 4. Guardar el nombre y procesar el envío según el rol
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nameInput = document.getElementById('nombre');
        if (nameInput) {
            localStorage.setItem('userName', nameInput.value);
        }

        // Redirección condicional:
        // Si es Docente o Padre va directamente a Login.html, si es Estudiante va a ExitoRegistro.html
        if (savedRole === 'Docente' || savedRole === 'Padre o Madre') {
            window.location.href = 'Login.html';
        } else {
            window.location.href = 'ExitoRegistro.html';
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