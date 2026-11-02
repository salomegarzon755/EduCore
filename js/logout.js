document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Detectar si la página actual está dentro de una subcarpeta (PanelDocente o PanelEstudiante)
    const currentPath = window.location.pathname;
    const isSubfolder = currentPath.includes('/PanelDocente/') || currentPath.includes('/PanelEstudiante/');
    
    // Ajustar rutas relativas dinámicamente según el nivel de carpetas
    const imgPath = isSubfolder 
        ? '../../img/files/EduCore_Identidad/06_estados_vacios/png/vacio_sin_cursos.png' 
        : '../img/files/EduCore_Identidad/06_estados_vacios/png/vacio_sin_cursos.png';

    // 2. Inyectar el HTML del modal dinámicamente si no existe en la página
    if (!document.getElementById('logoutModalOverlay')) {
        const modalHTML = `
            <div id="logoutModalOverlay" class="logout-modal-overlay" style="display: none;">
                <div class="logout-modal-card">
                    <div class="logout-modal-avatar">
                        <img src="${imgPath}" alt="Lúa Mascot" style="width: 80px; height: 80px;">
                    </div>
                    <h2 class="logout-modal-title">¿Quieres salir de EduCore?</h2>
                    <p class="logout-modal-desc">Tu aprendizaje te espera cuando regreses.</p>
                    
                    <div class="logout-modal-actions">
                        <button id="btnKeepLearning" class="btn-primary-logout">Seguir aprendiendo</button>
                        <button id="btnConfirmLogout" class="btn-secondary-logout">→ Sí, salir</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    const logoutModalOverlay = document.getElementById('logoutModalOverlay');
    const btnKeepLearning = document.getElementById('btnKeepLearning');
    const btnConfirmLogout = document.getElementById('btnConfirmLogout');

    // 3. Capturar clics globales en cualquier botón o enlace de salir
    document.addEventListener('click', (e) => {
        const logoutTrigger = e.target.closest('.logout-btn') || e.target.closest('a[href*="Login.html"]');
        if (logoutTrigger) {
            e.preventDefault();
            if (logoutModalOverlay) {
                logoutModalOverlay.style.display = 'flex';
            } else {
                ejecutarCierreSesion();
            }
        }
    });

    // 4. Acción "Seguir aprendiendo" (Cancela y cierra el modal)
    if (btnKeepLearning) {
        btnKeepLearning.addEventListener('click', () => {
            logoutModalOverlay.style.display = 'none';
        });
    }

    // 5. Acción "Sí, salir" (Limpia sesión y redirige)
    if (btnConfirmLogout) {
        btnConfirmLogout.addEventListener('click', () => {
            ejecutarCierreSesion();
        });
    }

    function ejecutarCierreSesion() {
        // Limpiar credenciales y variables guardadas
        localStorage.removeItem('currentUser');
        localStorage.removeItem('loggedUserName');
        sessionStorage.clear();

        // Notificación para la pantalla de ingreso (HU.04 C)
        sessionStorage.setItem('showLogoutNotice', 'true');

        // Redirección dinámica según la ubicación actual
        if (isSubfolder) {
            window.location.href = '../Login.html';
        } else {
            window.location.href = 'Login.html';
        }
    }
});