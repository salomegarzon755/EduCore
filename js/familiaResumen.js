/* HU.33 A · Resumen del aprendizaje en el panel familiar (PanelFamilia.html).
   GET /api/familia/estudiantes/:id/resumen?id_grupo=  (sesión del portal «Padre o Madre»). */
document.addEventListener('DOMContentLoaded', async () => {
    'use strict';
    const P = window.EduProgreso;
    const caja = document.getElementById('hu33Contenido');
    const seccion = document.getElementById('hu33Resumen');
    if (!P || !caja) return;
    const id = Number(P.usuario().id_usuario || P.usuario().id);
    const grupo = Number(localStorage.getItem('familyGroupId')) || null;
    const ver = (params) => `PanelFamilia/Aprendizaje.html?${new URLSearchParams(params)}`;

    try {
        const d = await P.api(`/familia/estudiantes/${id}/resumen${grupo ? `?id_grupo=${grupo}` : ''}`);
        const est = d.estudiante, nombre = P.primerNombre(est.nombre), g = d.grupo_actual || d.grupos[0];

        // Datos reales en el encabezado (antes eran textos de ejemplo)
        const detalles = document.getElementById('familyStudentDetails');
        const cursoTxt = document.getElementById('familyStudentCourse');
        if (detalles) detalles.textContent = g ? `${est.nombre} · ${g.grado} · ${g.nombre_grupo}` : est.nombre;
        if (cursoTxt) cursoTxt.textContent = d.cursos.map((c) => c.titulo_curso).join(' · ');

        if (!d.cursos.length) {
            caja.innerHTML = `<div class="pe-card"><p>${P.esc(nombre)} todavía no tiene cursos asignados en este grupo.</p></div>`;
            return;
        }
        caja.innerHTML = `<div class="pe-grid-2">
            <div class="pe-cursos">${d.cursos.map((c) => `
                <article class="pe-card pe-curso">
                    <p class="pe-mini">${P.esc(c.nombre_grupo)}</p>
                    <h3>${P.esc(c.titulo_curso)}</h3>
                    ${P.barra(c.porcentaje, `Avance en ${c.titulo_curso}: ${c.porcentaje}%`)}
                    <p class="pe-mini">${P.esc(P.textoTemas(c))}</p>
                    <div class="pe-acciones">
                        <a class="pe-btn sm" href="${ver({ curso: c.id_curso })}">Consultar progreso</a>
                        <a class="pe-btn sm ghost" href="${ver({ curso: c.id_curso, vista: 'resultados' })}">Ver resultados</a>
                    </div>
                </article>`).join('')}
            </div>
            <aside class="pe-card pe-paso">
                <h3>Cada paso cuenta</h3>
                <p>Consulta los temas completados y los pendientes para acompañar a ${P.esc(nombre)} sin presión.</p>
                <p class="pe-mini">Pregúntale qué aprendió hoy y celebren juntos cada avance.</p>
            </aside>
        </div>`;
    } catch (e) {
        caja.innerHTML = `<p class="pe-error" role="alert">${P.esc(e.message)}</p>`;
    } finally {
        seccion?.setAttribute('aria-busy', 'false');
    }
});
