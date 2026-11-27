/* HU.33 · Ver resultados de las actividades del hijo (PanelFamilia/Aprendizaje.html)
   ?curso=ID                    -> B · detalle del curso (recorrido de temas y avance)
   ?curso=ID&vista=resultados   -> C · resultados de cada actividad
   ?estudiante=OTRO             -> D · el servidor responde 403 ACCESO_RESTRINGIDO y se muestra
                                   «Información protegida» sin datos del otro estudiante.
   Endpoints: GET /api/familia/estudiantes/:id/resumen · GET /api/familia/estudiantes/:id/cursos/:id/progreso */
document.addEventListener('DOMContentLoaded', async () => {
    'use strict';
    const P = window.EduProgreso, esc = P.esc;
    const app = document.getElementById('hu33App');
    const q = new URLSearchParams(location.search);
    const propio = Number(P.usuario().id_usuario || P.usuario().id);
    const id = Number(q.get('estudiante')) || propio;
    let curso = Number(q.get('curso')) || null;
    const vista = q.get('vista') === 'resultados' ? 'resultados' : 'curso';
    const url = (params) => `Aprendizaje.html?${new URLSearchParams(params)}`;

    const pintar = (html) => {
        app.innerHTML = html;
        app.setAttribute('aria-busy', 'false');
        app.querySelector('h1')?.focus();
    };

    function protegida(asociado) {
        const nombre = asociado ? asociado.nombre : 'tu hijo o hija';
        document.title = 'EduCore - Información protegida';
        pintar(`<nav class="pe-ruta" aria-label="Ubicación"><a href="../PanelFamilia.html">Inicio</a> / Información protegida</nav>
            <h1 tabindex="-1">Información protegida</h1><p class="pe-sub">Cuidamos los datos de cada estudiante.</p>
            <section class="pe-protegida" role="alert">
                <img src="../../img/files/EduCore_Identidad/06_estados_vacios/png/error_amable.png" alt="">
                <h2>No tienes acceso a estos resultados</h2>
                <p>Solo puedes consultar la información de <strong>${esc(nombre)}</strong>, el estudiante asociado a tu ingreso.</p>
                <p class="pe-mini">No se muestran nombres, actividades ni resultados de otros estudiantes.</p>
                <div class="pe-acciones" style="justify-content:center">
                    <a class="pe-btn" href="${url({ vista: 'resultados' })}">Ver resultados de ${esc(P.primerNombre(nombre))}</a>
                </div>
            </section>`);
    }

    function error(mensaje) {
        pintar(`<h1 tabindex="-1">No pudimos mostrar la información</h1>
            <p class="pe-error" role="alert">${esc(mensaje)}</p>
            <div class="pe-acciones"><a class="pe-btn ghost" href="../PanelFamilia.html">← Volver al resumen</a></div>`);
    }

    try {
        if (!curso) {   // sin curso en la URL: el primero del grupo elegido al ingresar
            const grupo = Number(localStorage.getItem('familyGroupId')) || null;
            const r = await P.api(`/familia/estudiantes/${id}/resumen${grupo ? `?id_grupo=${grupo}` : ''}`);
            if (!r.cursos.length) return error('El estudiante todavía no tiene cursos asignados.');
            curso = r.cursos[0].id_curso;
        }
        const d = await P.api(`/familia/estudiantes/${id}/cursos/${curso}/progreso`);
        const est = d.estudiante, p = d.progreso, nombre = P.primerNombre(est.nombre);
        const sub = `${d.grupo.nombre_grupo} · ${p.titulo_curso}`;
        const ruta = (actual) => `<nav class="pe-ruta" aria-label="Ubicación"><a href="../PanelFamilia.html">Inicio</a> / ${esc(p.titulo_curso)} / ${actual}</nav>`;

        if (vista === 'resultados') {
            document.title = `EduCore - Resultados de ${nombre}`;
            return pintar(`${ruta('Resultados de actividades')}
                <h1 tabindex="-1">Resultados de ${esc(nombre)}</h1>
                <p class="pe-sub">${esc(est.nombre)} · Actividades realizadas en ${esc(p.titulo_curso)}</p>
                <section class="pe-card">
                    <p class="pe-aviso">🔒 Solo puedes consultar los resultados de ${esc(nombre)}.</p>
                    ${P.tablaResultados(p)}
                    <p class="pe-mini">«Por practicar»: la actividad se terminó con menos del 80 % de respuestas correctas; puede repetirla para mejorar.</p>
                </section>
                <div class="pe-acciones">
                    <a class="pe-btn" href="${url({ curso })}">Ver avance del curso</a>
                    <a class="pe-btn ghost" href="../PanelFamilia.html">← Volver al resumen</a>
                </div>`);
        }
        document.title = `EduCore - El aprendizaje de ${nombre}`;
        pintar(`${ruta('Detalle del curso')}
            <h1 tabindex="-1">El aprendizaje de ${esc(nombre)}</h1>
            <p class="pe-sub">Acompaña a ${esc(nombre)} en su aventura.</p>
            ${P.tarjetaEstudiante(est, p, sub)}
            <div class="pe-grid">${P.recorrido(p, est.nombre)}${P.avance(p)}</div>
            <div class="pe-acciones">
                <a class="pe-btn" href="${url({ curso, vista: 'resultados' })}">Ver resultados de actividades</a>
                <a class="pe-btn ghost" href="../PanelFamilia.html">← Volver al resumen</a>
            </div>`);
    } catch (e) {
        const datos = e.datos || {};
        if (datos.codigo === 'ACCESO_RESTRINGIDO') return protegida(datos.estudiante_asociado);
        error(e.message);
    }
});
