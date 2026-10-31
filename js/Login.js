document.addEventListener('DOMContentLoaded', () => {

    // 1. Alternar visibilidad de contraseña (Ojo 👁️)
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

    // 2. Personalizar interfaz de Login.html según el Rol seleccionado en index.html
    const savedRole = localStorage.getItem('userRole') || 'Docente';
    const roleBadgeDisplay = document.getElementById('roleBadgeDisplay');
    const loginTitle = document.getElementById('loginTitle');
    const loginSubtitle = document.getElementById('loginSubtitle');
    const labelUsuario = document.getElementById('labelUsuario');
    const groupCodigoClase = document.getElementById('groupCodigoClase');
    const submitBtn = document.getElementById('submitBtn');
    const footerNotice = document.getElementById('footerNotice');

    if (roleBadgeDisplay) {
        if (savedRole === 'Padre o Madre') {
        roleBadgeDisplay.textContent = 'ESPACIO FAMILIA';
        if (loginTitle) loginTitle.textContent = 'Acompaña el aprendizaje de tu hijo';
        if (loginSubtitle) loginSubtitle.textContent = 'Ingresa con los datos de acceso de tu hijo';
        if (labelUsuario) labelUsuario.textContent = 'Usuario del estudiante *';
        if (submitBtn) submitBtn.textContent = '→ Consultar progreso';
        if (groupCodigoClase) groupCodigoClase.style.display = 'flex';
        if (footerNotice) footerNotice.textContent = 'No necesitas registrarte. Usa los datos del estudiante y el código de su clase.';
        } else {
        roleBadgeDisplay.textContent = 'ESPACIO DOCENTE';
        if (loginTitle) loginTitle.textContent = '¡Bienvenido, docente!';
        if (loginSubtitle) loginSubtitle.textContent = 'Ingresa para organizar tus clases y acompañar a tus estudiantes.';
        if (labelUsuario) labelUsuario.textContent = 'Usuario *';
        if (submitBtn) submitBtn.textContent = '→ Ingresar';
        if (groupCodigoClase) groupCodigoClase.style.display = 'none';
        }
    }

    // 3. Procesar Inicio de Sesión / Consulta
    const loginForm = document.getElementById('loginForm');
    const authErrorAlert = document.getElementById('authErrorAlert');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const usuarioVal = document.getElementById('usuario').value.trim();
        const codigoClaseInput = document.getElementById('codigoClase');

        // Ejemplo de validación fallida (Simulación HU.03 C / HU.02 B)
        if (usuarioVal.toLowerCase() === 'error' || (codigoClaseInput && codigoClaseInput.value === 'AC-100')) {
            if (authErrorAlert) {
            authErrorAlert.classList.remove('alert-hidden');
            }
            return;
        }

        // Redirección condicional según el rol
        if (savedRole === 'Padre o Madre') {
            localStorage.setItem('studentUser', usuarioVal || 'Sara');
            window.location.href = 'PanelFamilia.html';
        } else {
            localStorage.setItem('loggedUserName', usuarioVal || 'Laura Mina');
            window.location.href = 'PanelDocente.html';
        }
        });
    }

    // 4. Cargar datos en PanelFamilia.html
    const studentNameDisplay = document.getElementById('studentNameDisplay');
    if (studentNameDisplay) {
        const savedStudent = localStorage.getItem('studentUser') || 'Sara';
        studentNameDisplay.textContent = savedStudent;
    }

});