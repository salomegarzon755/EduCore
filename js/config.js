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
