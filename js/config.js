// js/config.js
// URL base de la API.
//  - Local (localhost, 127.0.0.1 o abriendo el archivo directamente): Flask en el puerto 5000.
//  - Produccion: tu Web Service de Render.
// IMPORTANTE: se asigna a window.API_BASE_URL porque los demas scripts leen window.API_BASE_URL.
(function () {
    var host = window.location.hostname;
    var esLocal = host === 'localhost' || host === '127.0.0.1' || window.location.protocol === 'file:';

    // >>> CAMBIA esta URL por la de tu Web Service en Render (debe terminar en /api) <<<
    var URL_PRODUCCION = 'https://educore-api-6zrr.onrender.com/api';

    window.API_BASE_URL = esLocal ? 'http://localhost:5000/api' : URL_PRODUCCION;
})();

// HU18/HU19: adjunta la sesión a las llamadas existentes y trata su revocación.
(function () {
    const base = new URL(window.API_BASE_URL);
    const original = window.fetch.bind(window);
    const login = new URL('../html/Login.html', document.currentScript.src);
    function cerrarSesion(mensaje) {
        ['authToken', 'currentUser', 'loggedUserName', 'familyGroupId', 'userName'].forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
        sessionStorage.setItem('avisoCuenta', mensaje || 'Inicia sesión para continuar.');
        location.replace(login.href);
    }
    window.EduSesion = { cerrarSesion };
    window.fetch = async function (input, options) {
        const url = new URL(input instanceof Request ? input.url : input, location.href);
        const esApi = url.origin === base.origin && url.pathname.startsWith(base.pathname + '/');
        const publica = esApi && ['/login', '/registro', '/health'].includes(url.pathname.slice(base.pathname.length));
        if (!esApi || publica) return original(input, options);
        const headers = new Headers(options?.headers || (input instanceof Request ? input.headers : undefined));
        const token = localStorage.getItem('authToken');
        if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
        const respuesta = await original(input, {...options, headers});
        if (respuesta.status === 401 && !location.pathname.endsWith('/Login.html') && token === localStorage.getItem('authToken')) {
            cerrarSesion('Tu sesión terminó. Inicia sesión para continuar.');
        }
        return respuesta;
    };
    const paginaPrivada = /\/(Panel[^/]+\/|PanelFamilia\.html|MiCuenta\.html|CambiarAvatar\.html)/.test(location.pathname);
    if (paginaPrivada) {
        window.addEventListener('pageshow', () => {
            if (!localStorage.getItem('authToken')) cerrarSesion('Inicia sesión para continuar.');
            else window.fetch(window.API_BASE_URL + '/sesion').catch(() => {});
        });
    }
    window.addEventListener('storage', e => {
        if (e.key === 'authToken' && !e.newValue && /\/(Panel[^/]+\/|PanelFamilia\.html|MiCuenta\.html|CambiarAvatar\.html)/.test(location.pathname)) {
            location.replace(login.href);
        }
    });
})();
