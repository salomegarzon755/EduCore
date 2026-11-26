document.addEventListener('DOMContentLoaded', () => {

    const BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';
    localStorage.removeItem('authToken');
    localStorage.removeItem('familyGroupId');

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
            roleBadgeDisplay.textContent = 'ESPACIO DOCENTE';
            if (loginTitle) loginTitle.textContent = '¡Bienvenido, docente!';
            if (loginSubtitle) loginSubtitle.textContent = 'Ingresa para organizar tus clases y acompañar a tus estudiantes.';
            if (labelUsuario) labelUsuario.textContent = 'Usuario *';
            if (submitBtn) submitBtn.textContent = '→ Ingresar';
            if (groupCodigoClase) groupCodigoClase.style.display = 'none';
            if (footerNotice) footerNotice.textContent = 'Acceso reservado para profesores registrados.';

        } else if (savedRole === 'Administrador') {
            roleBadgeDisplay.textContent = 'ESPACIO ADMINISTRACIÓN';
            if (loginTitle) loginTitle.textContent = 'Bienvenido, administrador';
            if (loginSubtitle) loginSubtitle.textContent = 'Ingresa para gestionar los cursos predefinidos de EduCore.';
            if (labelUsuario) labelUsuario.textContent = 'Usuario *';
            if (submitBtn) submitBtn.textContent = '→ Ingresar';
            if (groupCodigoClase) groupCodigoClase.style.display = 'none';
            if (footerNotice) footerNotice.textContent = 'Acceso reservado para administradores de EduCore.';

        } else if (savedRole === 'Padre o Madre') {
            roleBadgeDisplay.textContent = 'ESPACIO FAMILIA';
            if (loginTitle) loginTitle.textContent = 'Acompaña el aprendizaje de tu hijo';
            if (loginSubtitle) loginSubtitle.textContent = 'Ingresa con los datos de acceso de tu hijo';
            if (labelUsuario) labelUsuario.textContent = 'Usuario del estudiante *';
            if (submitBtn) submitBtn.textContent = '→ Consultar progreso';
            if (groupCodigoClase) groupCodigoClase.style.display = 'flex';
            if (footerNotice) footerNotice.textContent = 'No necesitas registrarte. Usa los datos del estudiante y el código de su clase.';

        } else {
            roleBadgeDisplay.textContent = 'ESPACIO ESTUDIANTE';
            if (loginTitle) loginTitle.textContent = '¡Bienvenido, estudiante!';
            if (loginSubtitle) loginSubtitle.textContent = 'Ingresa tu usuario y contraseña para continuar tu aprendizaje.';
            if (labelUsuario) labelUsuario.textContent = 'Usuario *';
            if (submitBtn) submitBtn.textContent = '→ Ingresar';
            if (groupCodigoClase) groupCodigoClase.style.display = 'none';
            if (footerNotice) footerNotice.textContent = 'Ingresa con las credenciales que te asignó tu docente.';
        }
    }

    // 3. Procesar Inicio de Sesión con validación estricta del portal
    const loginForm = document.getElementById('loginForm');
    const authErrorAlert = document.getElementById('authErrorAlert');

    const selector = document.getElementById('codigoClase');
    let pending = null;
    function resetGroups() {
        pending = null;
        if (selector) { selector.disabled = true; selector.innerHTML = '<option value="">Valida tus credenciales para cargar los grupos</option>'; }
    }
    ['usuario', 'contrasena'].forEach(id => document.getElementById(id)?.addEventListener('input', resetGroups));

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const userInput = document.getElementById('usuario');
            const passInput = document.getElementById('contrasena');

            const usuarioVal = userInput ? userInput.value.trim() : '';
            const contrasenaVal = passInput ? passInput.value.trim() : '';

            if (authErrorAlert) authErrorAlert.classList.add('alert-hidden');

            if (savedRole === 'Padre o Madre' && pending) {
                if (!selector?.value) { mostrarError('Selecciona un grupo para consultar el progreso.'); return; }
                localStorage.setItem('currentUser', JSON.stringify(pending.user));
                localStorage.setItem('authToken', pending.token);
                localStorage.setItem('familyGroupId', selector.value);
                localStorage.setItem('userRole', 'Padre o Madre');
                window.location.href = 'PanelFamilia.html';
                return;
            }
            try {
                const response = await fetch(`${BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usuario: usuarioVal,
                        contrasena: contrasenaVal,
                        rol_esperado: savedRole
                    })
                });

                const data = await response.json();

                if (data.success && data.user) {
                    const rolReal = data.user.rol;

                    // Exclusividad de portales en frontend
                    if (savedRole === 'Administrador' && rolReal !== 'Administrador') {
                        mostrarError('Esta cuenta no tiene permisos de administración.');
                        return;
                    }

                    if (savedRole === 'Docente' && rolReal !== 'Docente') {
                        mostrarError('Esta cuenta es de un estudiante. Por favor ingresa desde el Portal Estudiantes.');
                        return;
                    }

                    if (savedRole === 'Estudiante' && rolReal !== 'Estudiante') {
                        mostrarError('Esta cuenta es de un docente. Por favor ingresa desde el Portal Docentes.');
                        return;
                    }

                    // Si la autenticación es válida para el portal correcto
                    if (savedRole === 'Padre o Madre') {
                        const gr = await fetch(`${BASE_URL}/familia/grupos`, {headers: {Authorization: `Bearer ${data.token}`}});
                        const gd = await gr.json();
                        if (!gr.ok || !gd.success) { mostrarError(gd.message || 'No se pudieron cargar los grupos'); return; }
                        const grupos = gd.grupos || [];
                        if (!grupos.length) { mostrarError('Este estudiante no tiene grupos asignados.'); return; }
                        pending = {user: data.user, token: data.token};
                        selector.innerHTML = '<option value=>Selecciona un grupo</option>';
                        grupos.forEach(grupo => { const option = document.createElement('option'); option.value = grupo.id_grupo; option.textContent = `${grupo.nombre_grupo} (${grupo.codigo_clase})`; selector.appendChild(option); });
                        selector.disabled = false; selector.focus();
                        if (submitBtn) submitBtn.textContent = '→ Consultar progreso';
                        return;
                    }
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('currentUser', JSON.stringify(data.user));
                    localStorage.setItem('loggedUserName', data.user.nombre || usuarioVal);

                    if (rolReal === 'Administrador') {
                        localStorage.setItem('userRole', 'Administrador');
                        window.location.href = 'PanelAdministrador/GestionCursos.html';
                    } else if (rolReal === 'Docente') {
                        localStorage.setItem('userRole', 'Docente');
                        window.location.href = 'PanelDocente/PanelPrincipal.html';
                    } else {
                        localStorage.setItem('userRole', 'Estudiante');
                        window.location.href = 'PanelEstudiante/Inicio.html';
                    }

                } else {
                    mostrarError(data.message || 'Usuario o contraseña incorrectos.');
                }
            } catch (error) {
                console.error('Error de conexión con el servidor Python:', error);
                mostrarError('No se pudo conectar con el servidor.');
            }
        });
    }

    const avisoCuenta = sessionStorage.getItem('avisoCuenta');
    if (avisoCuenta) {
        sessionStorage.removeItem('avisoCuenta');
        mostrarError(avisoCuenta);
    }

    function mostrarError(mensaje) {
        if (authErrorAlert) {
            authErrorAlert.textContent = mensaje;
            authErrorAlert.classList.remove('alert-hidden');
        } else {
            alert(mensaje);
        }
    }
});