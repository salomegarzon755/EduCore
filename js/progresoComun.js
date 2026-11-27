/* EduCore · Componentes compartidos de progreso del curso (HU.33 Familia y HU.34 Docente).
   Solo pinta lo que llega de la API (/api/familia/... y /api/docentes/.../progreso): no hay datos fijos.
   Reglas de temas y estados: backend/dao/progreso_dao.py (mismas de HU.25 «Mi camino»). */
(function () {
    'use strict';
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || 'tu estudiante';
    const fecha = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
    const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

    // Usa avatares.js (rutas relativas a su propio archivo) para no repetir rutas de imágenes.
    function avatar(id, clase = 'pe-avatar') {
        const src = window.EduAvatares ? window.EduAvatares.url(id || 'kokoi') : '';
        const alt = window.EduAvatares ? (window.EduAvatares.nombres[id] || 'Kokoi') : '';
        return `<span class="${clase}"><img src="${esc(src)}" alt="Avatar: ${esc(alt)}"></span>`;
    }

    function barra(pct, etiqueta) {
        const v = Math.max(0, Math.min(100, Number(pct) || 0));
        return `<div class="pe-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" aria-label="${esc(etiqueta || 'Avance del curso')}"><i style="width:${v}%"></i></div>`;
    }

    const textoTemas = (p) => `${p.temas_completados} de ${p.temas_total} temas completados · ${p.porcentaje}%`;

    function tarjetaEstudiante(est, p, subtitulo) {
        const act = fecha(p && p.ultima_actividad);
        return `<section class="pe-estudiante">${avatar(est.avatar)}
            <div><h2>${esc(est.nombre)}</h2><p>${esc(subtitulo)}</p>
            ${p ? `<p class="pe-mini">${esc(textoTemas(p))} · ${act ? 'Última actividad: ' + esc(act) : 'Aún sin actividades registradas'}</p>` : ''}</div></section>`;
    }

    const ESTADO_TEMA = { completado: ['✓', 'Completado'], en_curso: ['◷', 'En curso'], pendiente: ['○', 'Pendiente'] };
    function recorrido(p, nombre) {
        if (!p.temas.length) return `<section class="pe-card"><h3>El recorrido de ${esc(primerNombre(nombre))}</h3><p class="pe-vacio">Este curso todavía no tiene temas con actividades.</p></section>`;
        return `<section class="pe-card" aria-labelledby="peRecorrido"><h3 id="peRecorrido">El recorrido de ${esc(primerNombre(nombre))}</h3>
            <ol class="pe-temas">${p.temas.map((t) => {
                const [icono, texto] = ESTADO_TEMA[t.estado] || ESTADO_TEMA.pendiente;
                return `<li class="pe-tema is-${t.estado}"><span class="pe-tema-icono" aria-hidden="true">${icono}</span>
                    <span class="pe-tema-titulo">${esc(t.titulo)}<small>${t.actividades_completadas} de ${plural(t.actividades_total, 'actividad', 'actividades')}</small></span>
                    <span class="pe-tema-estado">${texto}</span></li>`;
            }).join('')}</ol></section>`;
    }

    function avance(p) {
        return `<section class="pe-card pe-avance" aria-labelledby="peAvance"><h3 id="peAvance">Avance del curso</h3>
            ${barra(p.porcentaje, `Avance del curso: ${p.porcentaje}%`)}
            <p class="pe-pct">${p.porcentaje}%</p>
            <p>${plural(p.temas_completados, 'tema completado', 'temas completados')}</p>
            <p>${plural(p.temas_pendientes, 'tema pendiente', 'temas pendientes')}</p>
            <p class="pe-mini">${p.actividades_completadas} de ${plural(p.actividades_total, 'actividad realizada', 'actividades realizadas')}</p></section>`;
    }

    const ESTADO_ACT = { completada: 'Completada', por_practicar: 'Por practicar', pendiente: 'Pendiente' };
    function resultadoTexto(a) {
        if (!a.completada) return 'Sin resultados';
        if (!a.total) return 'Teoría vista';
        return `${a.aciertos} de ${a.total} · ${a.porcentaje}%`;
    }
    function tablaResultados(p) {
        const filas = p.temas.flatMap((t) => t.actividades.map((a) => ({ ...a, tema: t.titulo })));
        if (!filas.length) return '<p class="pe-vacio">Este curso todavía no tiene actividades.</p>';
        return `<div class="pe-tabla-wrap"><table class="pe-tabla">
            <caption class="pe-sr">Resultados de las actividades del curso ${esc(p.titulo_curso)}</caption>
            <thead><tr><th scope="col">Actividad</th><th scope="col">Resultado</th><th scope="col">Estado</th></tr></thead>
            <tbody>${filas.map((a) => `<tr class="is-${a.estado}">
                <th scope="row"><span class="pe-act">${esc(a.titulo)}</span><small>${esc(a.tema)}${a.intentos > 1 ? ` · ${a.intentos} intentos` : ''}</small></th>
                <td data-label="Resultado">${esc(resultadoTexto(a))}</td>
                <td data-label="Estado"><span class="pe-estado is-${a.estado}">${ESTADO_ACT[a.estado]}</span></td></tr>`).join('')}</tbody>
            </table></div>`;
    }

    async function api(ruta) {
        const base = window.API_BASE_URL || 'http://localhost:5000/api';
        let r, d;
        try {
            r = await fetch(base + ruta);
            d = await r.json();
        } catch (e) {
            const err = new Error('No pudimos conectar con EduCore. Revisa tu conexión e inténtalo de nuevo.');
            err.estado = 0; throw err;
        }
        if (!r.ok || !d.success) {
            const err = new Error(d.message || 'No se pudo consultar el progreso.');
            err.estado = r.status; err.datos = d; throw err;
        }
        return d;
    }

    function usuario() { try { return JSON.parse(localStorage.getItem('currentUser') || '{}') || {}; } catch { return {}; } }

    window.EduProgreso = { esc, primerNombre, fecha, plural, avatar, barra, textoTemas, tarjetaEstudiante, recorrido, avance, tablaResultados, api, usuario };
})();
