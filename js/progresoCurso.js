// HU.25 · Ver barra de progreso del curso (Estudiante) — MiCamino.html
// CA-01: al entrar al curso se muestra una barra con el avance en los TEMAS (unidades).
// CA-02: al completar una actividad y volver al curso, la barra refleja el nuevo avance
//        y se avisa qué tema se completó ("✓ Completaste …").
// Un tema está completado cuando el estudiante terminó todas sus actividades.
// Recibe los datos del evento 'educore:camino-cargado' que emite js/panelEstudiante.js.
(function () {
    'use strict';

    const MENSAJES = {
        inicio: 'Tu aventura está por comenzar.',
        avance: '¡Vas muy bien! Sigue a tu ritmo.',
        nuevo: '¡Un nuevo paso en tu aventura!',
        completo: '¡Completaste todos los temas del curso!'
    };

    const $ = (id) => document.getElementById(id);

    // Recuerda qué temas tenía completados el estudiante la última vez que vio el curso,
    // para detectar los que acaba de completar. Si el navegador no permite guardar, simplemente no avisa.
    const claveMemoria = (idEstudiante, idCurso) => `educore_hu25_temas_${idEstudiante}_${idCurso}`;
    function leerMemoria(clave) {
        try {
            const v = JSON.parse(localStorage.getItem(clave) || 'null');
            return v && Array.isArray(v.completados) ? v : null;
        } catch (_) { return null; }
    }
    function guardarMemoria(clave, valor) {
        try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (_) { /* sin almacenamiento */ }
    }

    // Temas = unidades con al menos una actividad (una unidad vacía no se puede completar).
    function calcularTemas(unidades) {
        const temas = (unidades || [])
            .filter((u) => (u.actividades || []).length > 0)
            .map((u) => {
                const acts = u.actividades || [];
                return {
                    id: u.id_unidad,
                    titulo: u.titulo_unidad || 'Tema',
                    completado: acts.every((a) => a.estado === 'completada'),
                    actividades: acts
                };
            });
        let porExplorarAsignado = false;
        temas.forEach((t) => {
            if (t.completado) t.estado = 'completado';
            else if (!porExplorarAsignado) { t.estado = 'explorar'; porExplorarAsignado = true; }
            else t.estado = 'pendiente';
        });
        return temas;
    }

    function siguienteActividad(temas) {
        for (const t of temas) {
            const a = t.actividades.find((x) => x.estado === 'actual')
                || t.actividades.find((x) => x.estado !== 'completada');
            if (a) return a;
        }
        return null;
    }

    function renderizar({ idCurso, studentId, curso, unidades }) {
        const seccion = $('courseProgress');
        if (!seccion) return;

        const temas = calcularTemas(unidades);
        if (!temas.length) { seccion.hidden = true; return; }

        const total = temas.length;
        const hechos = temas.filter((t) => t.completado).length;
        const porcentaje = Math.round((hechos / total) * 100);

        // CA-02: temas que se completaron desde la última visita
        const clave = claveMemoria(studentId, idCurso);
        const anterior = leerMemoria(clave);
        const idsAntes = new Set(anterior ? anterior.completados : []);
        const nuevos = anterior ? temas.filter((t) => t.completado && !idsAntes.has(t.id)) : [];
        const porcentajeAntes = anterior && Number.isFinite(anterior.porcentaje) ? anterior.porcentaje : porcentaje;
        guardarMemoria(clave, { completados: temas.filter((t) => t.completado).map((t) => t.id), porcentaje });

        // Encabezado y mensaje
        $('hu25Course').textContent = curso.titulo_curso || 'Mi curso';
        $('hu25Message').textContent = porcentaje === 100 ? MENSAJES.completo
            : nuevos.length ? MENSAJES.nuevo
            : hechos === 0 ? MENSAJES.inicio
            : MENSAJES.avance;
        $('hu25Count').textContent = `${hechos}/${total} temas completados · ${porcentaje}%`;

        // Barra: parte del valor anterior y se anima hasta el nuevo
        // (la sección debe estar visible: el navegador no anima elementos ocultos)
        seccion.hidden = false;
        const barra = $('hu25Bar');
        const relleno = $('hu25Fill');
        barra.setAttribute('aria-valuenow', String(porcentaje));
        barra.setAttribute('aria-valuetext', `${hechos} de ${total} temas completados, ${porcentaje}%`);
        relleno.style.transition = 'none';
        relleno.style.width = `${porcentajeAntes}%`;
        void relleno.offsetWidth;   // fuerza el estado inicial antes de animar
        relleno.style.transition = '';
        requestAnimationFrame(() => { relleno.style.width = `${porcentaje}%`; });

        // Tarjetas de temas
        const lista = $('hu25Topics');
        lista.innerHTML = '';
        temas.forEach((t, i) => {
            const li = document.createElement('li');
            li.className = `hu25-topic is-${t.estado}`;
            const num = document.createElement('span');
            num.className = 'hu25-topic-num';
            num.setAttribute('aria-hidden', 'true');
            num.textContent = t.completado ? '✓' : String(i + 1);
            const titulo = document.createElement('strong');
            titulo.className = 'hu25-topic-title';
            titulo.textContent = t.titulo;
            const estado = document.createElement('span');
            estado.className = 'hu25-topic-state';
            estado.textContent = t.estado === 'completado' ? 'Completado'
                : t.estado === 'explorar' ? 'Por explorar' : 'Pendiente';
            li.append(num, titulo, estado);
            lista.appendChild(li);
        });

        // Botón principal según el avance
        const boton = $('hu25Main');
        const siguiente = siguienteActividad(temas);
        const primera = temas[0].actividades[0];
        if (porcentaje === 100) {
            boton.textContent = 'Seguir practicando';
            boton.href = `Actividad.html?id_actividad=${primera.id_actividad}`;
        } else {
            boton.textContent = hechos === 0 && !temas.some((t) => t.actividades.some((a) => a.estado === 'completada'))
                ? 'Comenzar aventura' : 'Continuar aprendizaje';
            boton.href = `Actividad.html?id_actividad=${(siguiente || primera).id_actividad}`;
        }

        // Aviso del tema recién completado
        const aviso = $('hu25Toast');
        if (nuevos.length) {
            const nombres = nuevos.map((t) => t.titulo);
            aviso.textContent = nombres.length === 1
                ? `✓ Completaste ${nombres[0]}.`
                : `✓ Completaste ${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}.`;
            aviso.hidden = false;
        } else {
            aviso.hidden = true;
            aviso.textContent = '';
        }
    }

    document.addEventListener('educore:camino-cargado', (e) => {
        try { renderizar(e.detail || {}); }
        catch (err) { console.error('HU.25 · no se pudo mostrar la barra de progreso:', err); }
    });
})();
