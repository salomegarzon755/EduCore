document.addEventListener('DOMContentLoaded', () => {

    // 1. Alternar visibilidad de contraseña (👁️ / 🙈)
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

    // 2. Personalizar según el rol guardado (Docente, Estudiante o Padre o Madre)
    const savedRole = localStorage.getItem('userRole') || 'Estudiante';

    const roleBadgeDisplay = document.getElementById('roleBadgeDisplay');
    const loginTitle = document.getElementById('loginTitle');
    const loginSubtitle = document.getElementById('loginSubtitle');
    const labelUsuario = document.getElementById('labelUsuario');
    const groupCodigoClase = document.getElementById('groupCodigoClase');
    const submitBtn = document.getElementById('submitBtn');
    const footerNotice = document.getElementById('footerNotice');

    if (roleBadgeDisplay) {
        if (savedRole === 'Docente') {
            // VISTA DOCENTE
            roleBadgeDisplay.textContent = 'ESPACIO DOCENTE';
            if (loginTitle) loginTitle.textContent = '¡Bienvenido, docente!';
            if (loginSubtitle) loginSubtitle.textContent = 'Ingresa para organizar tus clases y acompañar a tus estudiantes.';
            if (labelUsuario) labelUsuario.textContent = 'Usuario *';
            if (submitBtn) submitBtn.textContent = '→ Ingresar';
            if (groupCodigoClase) groupCodigoClase.style.display = 'none';
            if (footerNotice) footerNotice.textContent = 'Acceso reservado para profesores registrados.';

        } else if (savedRole === 'Padre o Madre') {
            // VISTA FAMILIA (Único que requiere Código de Clase)
            roleBadgeDisplay.textContent = 'ESPACIO FAMILIA';
            if (loginTitle) loginTitle.textContent = 'Acompaña el aprendizaje de tu hijo';
            if (loginSubtitle) loginSubtitle.textContent = 'Ingresa con los datos de acceso de tu hijo';
            if (labelUsuario) labelUsuario.textContent = 'Usuario del estudiante *';
            if (submitBtn) submitBtn.textContent = '→ Consultar progreso';
            if (groupCodigoClase) groupCodigoClase.style.display = 'flex';
            if (footerNotice) footerNotice.textContent = 'No necesitas registrarte. Usa los datos del estudiante y el código de su clase.';

        } else {
            // VISTA ESTUDIANTE (Mismo form que el docente, sin código de clase)
            roleBadgeDisplay.textContent = 'ESPACIO ESTUDIANTE';
            if (loginTitle) loginTitle.textContent = '¡Bienvenido, estudiante!';
            if (loginSubtitle) loginSubtitle.textContent = 'Ingresa tu usuario y contraseña para continuar tu aprendizaje.';
            if (labelUsuario) labelUsuario.textContent = 'Usuario *';
            if (submitBtn) submitBtn.textContent = '→ Ingresar';
            if (groupCodigoClase) groupCodigoClase.style.display = 'none';
            if (footerNotice) footerNotice.textContent = 'Ingresa con las credenciales que te asignó tu docente.';
        }
    }

    // 3. Procesar Inicio de Sesión conectando a la BD mediante API Flask
    const loginForm = document.getElementById('loginForm');
    const authErrorAlert = document.getElementById('authErrorAlert');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userInput = document.getElementById('usuario');
            const passInput = document.getElementById('contrasena');

            const usuarioVal = userInput ? userInput.value.trim() : '';
            const contrasenaVal = passInput ? passInput.value.trim() : '';

            // Ocultar alerta de error previa si existe
            if (authErrorAlert) authErrorAlert.classList.add('alert-hidden');

            try {
                const response = await fetch('http://localhost:5000/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usuario: usuarioVal,
                        contrasena: contrasenaVal
                    })
                });

                const data = await response.json();

                if (data.success) {
                    // Guardamos el objeto devuelto por PostgreSQL (contiene id_usuario, nombre, usuario, rol)
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    localStorage.setItem('loggedUserName', data.user.nombre || usuarioVal);
                    
                    // Si el usuario intentó ingresar desde el 'ESPACIO FAMILIA', priorizamos esa vista
                    if (savedRole === 'Padre o Madre') {
                        localStorage.setItem('userRole', 'Padre o Madre');
                        window.location.href = 'PanelFamilia.html';
                    } else if (data.user.rol === 'Docente') {
                        localStorage.setItem('userRole', 'Docente');
                        window.location.href = 'PanelDocente/PanelPrincipal.html';
                    } else {
                        localStorage.setItem('userRole', 'Estudiante');
                        window.location.href = 'PanelEstudiante/Inicio.html';
                    }
                } else {
                    if (authErrorAlert) authErrorAlert.classList.remove('alert-hidden');
                }
            } catch (error) {
                console.error('Error de conexión con el servidor Python:', error);
                if (authErrorAlert) authErrorAlert.classList.remove('alert-hidden');
            }
        });
    }

});