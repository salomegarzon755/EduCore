// HU.31 · Resumen al finalizar cada módulo (Estudiante) — ResumenModulo.html?unidad=ID
// CA-01: preguntas correctas e incorrectas del módulo (último intento de cada actividad).
// CA-02: temas por practicar (preguntas falladas) con acceso directo para volver a practicar.
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';

    function idEstudiante() {
        try { const u = JSON.parse(localStorage.getItem('currentUser')); return u && (u.id_estudiante || u.id_usuario || u.id); }
        catch (_) { return null; }
    }
    const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

    function el(tag, clase, texto) {
        const e = document.createElement(tag);
        if (clase) e.className = clase;
        if (texto != null) e.textContent = texto;
        return e;
    }

    function mostrarError(texto) {
        $('hu31Cargando').hidden = true;
        $('hu31Error').textContent = texto;
        $('hu31Error').hidden = false;
    }

    function tiles(r) {
        const caja = document.createDocumentFragment();
        [['ok', r.correctas, 'Correctas'], ['mal', r.incorrectas, 'Incorrectas'],
         ['pct', r.puntuacion == null ? '—' : `${r.puntuacion} %`, 'Puntuación']].forEach(([c, v, t]) => {
            const d = el('div', `hu31-tile is-${c}`);
            d.append(el('strong', null, String(v)), el('span', null, t));
            caja.appendChild(d);
        });
        return caja;
    }

    function pintar(r) {
        const ruta = `${r.titulo_curso} / Módulo ${r.numero} · ${r.titulo_unidad}`;
        document.querySelectorAll('.hu31-ruta').forEach((p) => { p.textContent = ruta; });
        document.querySelectorAll('.hu31-volver').forEach((a) => { a.href = `MiCamino.html?id_curso=${r.id_curso}`; });
        document.querySelectorAll('.hu31-tiles').forEach((t) => { t.innerHTML = ''; t.appendChild(tiles(r)); });

        const aviso = document.querySelector('.hu31-aviso');
        if (!r.completo) {
            aviso.textContent = `Llevas ${r.actividades_hechas} de ${r.actividades_total} actividades de este módulo. El resumen se completará cuando termines las que faltan.`;
            aviso.hidden = false;
        }

        // CA-01 · tabla de respuestas
        const filas = $('hu31Filas');
        filas.innerHTML = '';
        r.preguntas.forEach((p) => {
            const f = el('div', `hu31-fila ${p.es_correcta ? 'is-ok' : 'is-mal'}`);
            f.setAttribute('role', 'row');
            const preg = el('span', 'hu31-preg', `${p.numero}. ${p.enunciado}`);
            const resp = el('span', 'hu31-resp', `${p.tu_respuesta} / ${p.correcta}`);
            resp.setAttribute('aria-label', `Tu respuesta: ${p.tu_respuesta}. Correcta: ${p.correcta}`);
            const est = el('span', 'hu31-estado', p.es_correcta ? 'Correcta' : 'Incorrecta');
            [preg, resp, est].forEach((c) => { c.setAttribute('role', 'cell'); f.appendChild(c); });
            filas.appendChild(f);
        });

        // CA-02 · temas por practicar
        const correctas = [...new Set(r.preguntas.filter((p) => p.es_correcta).map((p) => p.tu_respuesta))];
        const numericas = correctas.length && correctas.every((t) => /^\d+$/.test(t));
        if (numericas) correctas.sort((a, b) => a - b);
        $('hu31Dominas').textContent = !r.temas.length ? '¡Dominas todo el módulo! 🌟'
            : !correctas.length ? 'Cada intento te acerca a dominar este módulo. 🌱'
            : numericas ? `Dominas ${correctas.length === 1 ? 'el número' : 'los números'} ${lista(correctas)}.`
            : `Respondiste bien ${r.correctas} de ${r.correctas + r.incorrectas} preguntas.`;
        const nums = r.temas.map((t) => t.numero);
        $('hu31Repasar').textContent = !r.temas.length ? 'No tienes temas pendientes por practicar. ¡Sigue así!'
            : nums.length === 1 ? `La pregunta ${nums[0]} indica qué puedes repasar.`
            : `Las preguntas ${lista(nums.map(String))} indican qué puedes repasar.`;
        const ul = $('hu31ListaTemas');
        ul.innerHTML = '';
        r.temas.forEach((t) => {
            const li = el('li', 'hu31-tema');
            const txt = el('div', 'hu31-tema-txt');
            txt.append(el('strong', null, `Pregunta ${t.numero} · ${t.enunciado}`),
                el('span', null, t.pista || 'Repasa el tema y vuelve a responder la pregunta.'));
            const a = el('a', 'hu31-btn hu31-practicar', 'Practicar');
            a.href = `Actividad.html?id_actividad=${t.id_actividad}`;
            a.setAttribute('aria-label', `Practicar la pregunta ${t.numero} en la actividad ${t.actividad}`);
            li.append(txt, a);
            ul.appendChild(li);
        });
        $('hu31VerTemas').textContent = r.temas.length ? 'Ver temas por practicar' : 'Ver mis logros';
    }

    function verVista(cual, enfocar) {
        $('hu31Resumen').hidden = cual !== 'A';
        $('hu31Temas').hidden = cual !== 'B';
        window.scrollTo(0, 0);
        if (enfocar) $(cual === 'A' ? 'hu31TituloA' : 'hu31TituloB').focus({ preventScroll: true });
    }

    async function iniciar() {
        const unidad = new URLSearchParams(location.search).get('unidad');
        const est = idEstudiante();
        const token = localStorage.getItem('authToken');
        if (!est || !token) { mostrarError('Inicia sesión para ver tu resumen.'); return; }
        if (!/^\d+$/.test(unidad || '')) { mostrarError('No encontramos ese módulo. Vuelve a Mi camino y elige un tema.'); return; }
        try {
            const res = await fetch(`${BASE_URL}/estudiantes/${est}/unidades/${unidad}/resumen`,
                { headers: { Authorization: `Bearer ${token}` } });
            const d = await res.json().catch(() => ({}));
            if (res.status === 401) { mostrarError('Tu sesión terminó. Vuelve a iniciar sesión.'); return; }
            if (!res.ok || !d.success) { mostrarError(d.message || 'No se pudo cargar el resumen del módulo.'); return; }
            const r = d.resumen;
            if (!r.preguntas.length) {
                mostrarError(r.actividades_hechas
                    ? 'Este módulo no tiene preguntas para resumir.'
                    : 'Aún no has respondido actividades de este módulo. ¡Comienza tu aventura!');
                return;
            }
            pintar(r);
            $('hu31Cargando').hidden = true;
            verVista('A');
        } catch (_) {
            mostrarError('No se pudo cargar el resumen. Revisa tu conexión e inténtalo otra vez.');
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        $('hu31VerTemas').addEventListener('click', () => verVista('B', true));
        $('hu31VerResumen').addEventListener('click', () => verVista('A', true));
        iniciar();
    });
})();
