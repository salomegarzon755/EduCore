/* HU.34 · Ver progreso del curso por estudiante (PanelDocente/ProgresoGrupo.html)
   ?grupo=ID&curso=ID                 -> A · listado del grupo con el avance de cada estudiante
   ?grupo=ID&curso=ID&estudiante=ID   -> B · detalle individual (temas, avance y resultados)
   Endpoints (solo grupos del docente con sesión):
     GET /api/docentes/:id/progreso
     GET /api/docentes/:id/grupos/:g/progreso?id_curso=
     GET /api/docentes/:id/grupos/:g/estudiantes/:e/progreso?id_curso= */
document.addEventListener('DOMContentLoaded', async () => {
    'use strict';
    const P = window.EduProgreso, esc = P.esc;
    const app = document.getElementById('hu34App');
    const q = new URLSearchParams(location.search);
    const docente = Number(P.usuario().id_usuario || P.usuario().id);
    const pedido = { grupo: Number(q.get('grupo')) || null, curso: Number(q.get('curso')) || null, estudiante: Number(q.get('estudiante')) || null };
    const url = (params) => `ProgresoGrupo.html?${new URLSearchParams(Object.entries(params).filter(([, v]) => v))}`;

    const pintar = (html, foco = true) => {
        app.innerHTML = html;
        app.setAttribute('aria-busy', 'false');
        if (foco) app.querySelector('h1')?.focus();
    };
    const encabezado = (titulo, sub) => `<h1 tabindex="-1">${esc(titulo)}</h1><p class="pe-sub">${esc(sub)}</p>`;

    function filtros(grupos, grupo, curso) {
        const g = grupos.find((x) => x.id_grupo === grupo.id_grupo) || { cursos: [] };
        return `<div class="pe-filtros">
            <label>Grupo<select id="peGrupo">${grupos.map((x) => `<option value="${x.id_grupo}" ${x.id_grupo === grupo.id_grupo ? 'selected' : ''}>${esc(x.nombre_grupo)} · ${esc(x.grado)}</option>`).join('')}</select></label>
            <label>Curso<select id="peCurso" ${g.cursos.length ? '' : 'disabled'}>${g.cursos.length ? g.cursos.map((c) => `<option value="${c.id_curso}" ${curso && c.id_curso === curso.id_curso ? 'selected' : ''}>${esc(c.titulo_curso)}</option>`).join('') : '<option>Sin cursos asignados</option>'}</select></label>
        </div>`;
    }
    function escucharFiltros() {
        document.getElementById('peGrupo')?.addEventListener('change', (e) => { location.href = url({ grupo: e.target.value }); });
        document.getElementById('peCurso')?.addEventListener('change', (e) => { location.href = url({ grupo: pedido.grupo, curso: e.target.value }); });
    }

    function listado(grupos, d) {
        const { grupo, curso, estudiantes } = d;
        const bloqueGrupo = `<div class="pe-grupo"><strong>${esc(grupo.nombre_grupo)} · Grado ${esc(({ Primero: '1.°', Segundo: '2.°' })[grupo.grado] || grupo.grado)}</strong><p>${curso ? esc(curso.titulo_curso) : 'Este grupo todavía no tiene cursos asignados'}</p></div>`;
        let cuerpo;
        if (!curso) {
            cuerpo = `<div class="pe-card"><p>Asigna un curso al grupo para ver el avance de sus estudiantes.</p><div class="pe-acciones"><a class="pe-btn" href="DetalleGrupo.html?id=${grupo.id_grupo}">Ir al grupo</a></div></div>`;
        } else if (!estudiantes.length) {
            cuerpo = `<div class="empty-state-card"><img src="../../img/files/EduCore_Identidad/06_estados_vacios/png/vacio_sin_estudiantes.png" alt="" class="empty-state-img"><h3 class="empty-state-title">Este grupo aún no tiene estudiantes</h3><p class="empty-state-desc">Cuando inscribas estudiantes podrás acompañar su avance desde aquí.</p><a class="btn-create-group" href="DetalleGrupo.html?id=${grupo.id_grupo}">+ Agregar estudiantes</a></div>`;
        } else {
            const promedio = Math.round(estudiantes.reduce((n, e) => n + e.porcentaje, 0) / estudiantes.length);
            const sinIniciar = estudiantes.filter((e) => !e.actividades_completadas).length;
            cuerpo = `<section class="pe-card" aria-labelledby="peListaTitulo">
                <h3 id="peListaTitulo">${P.plural(estudiantes.length, 'estudiante', 'estudiantes')} · Avance promedio ${promedio}%${sinIniciar ? ` · ${sinIniciar} sin iniciar` : ''}</h3>
                <div class="pe-tabla-wrap"><table class="pe-tabla pe-lista">
                    <caption class="pe-sr">Avance de cada estudiante en ${esc(curso.titulo_curso)}</caption>
                    <thead><tr><th scope="col">Estudiante</th><th scope="col">Avance del curso</th><th scope="col">Temas</th><th scope="col">Detalle</th></tr></thead>
                    <tbody>${estudiantes.map((e) => `<tr>
                        <th scope="row"><span class="pe-quien">${P.avatar(e.avatar, 'pe-avatar-sm')}<span>${esc(e.nombre)}<small>${e.ultima_actividad ? 'Última actividad: ' + esc(P.fecha(e.ultima_actividad)) : 'Sin actividades aún'}</small></span></span></th>
                        <td class="pe-col-avance" data-label="Avance">${P.barra(e.porcentaje, `Avance de ${e.nombre}: ${e.porcentaje}%`)}<small>${e.porcentaje}%</small></td>
                        <td data-label="Temas">${e.temas_completados}/${e.temas_total}</td>
                        <td class="pe-sin-etiqueta"><a class="pe-btn sm" href="${url({ grupo: grupo.id_grupo, curso: curso.id_curso, estudiante: e.id_estudiante })}" aria-label="Ver progreso de ${esc(e.nombre)}">Ver progreso</a></td>
                    </tr>`).join('')}</tbody></table></div>
            </section>`;
        }
        pintar(`${encabezado('Progreso del grupo', 'Acompaña el aprendizaje de cada estudiante.')}${filtros(grupos, grupo, curso)}${bloqueGrupo}${cuerpo}`);
        escucharFiltros();
    }

    function detalle(d) {
        const { grupo, estudiante: est, progreso: p } = d;
        const nombre = P.primerNombre(est.nombre);
        document.title = `EduCore - Progreso de ${est.nombre}`;
        pintar(`<nav class="pe-ruta" aria-label="Ubicación"><a href="${url({ grupo: grupo.id_grupo, curso: p.id_curso })}">Progreso del grupo</a> / ${esc(grupo.nombre_grupo)} / ${esc(est.nombre)}</nav>
            ${encabezado('Progreso del grupo', 'Acompaña el aprendizaje de cada estudiante.')}
            ${P.tarjetaEstudiante(est, p, `${grupo.nombre_grupo} · ${p.titulo_curso}`)}
            <div class="pe-grid">${P.recorrido(p, est.nombre)}${P.avance(p)}</div>
            <section class="pe-card" style="margin-top:18px" aria-labelledby="peResTitulo">
                <h3 id="peResTitulo">Resultados de ${esc(nombre)} por actividad</h3>
                ${P.tablaResultados(p)}
            </section>
            <div class="pe-acciones">
                <a class="pe-btn ghost" href="${url({ grupo: grupo.id_grupo, curso: p.id_curso })}">← Volver al grupo</a>
                <a class="pe-btn ghost" href="Seguimiento.html">Ver intentos y comentarios</a>
            </div>`);
    }

    function error(mensaje) {
        pintar(`${encabezado('Progreso del grupo', 'Acompaña el aprendizaje de cada estudiante.')}
            <p class="pe-error" role="alert">${esc(mensaje)}</p>
            <div class="pe-acciones"><a class="pe-btn ghost" href="ProgresoGrupo.html">← Ver mis grupos</a></div>`);
    }

    try {
        const { grupos } = await P.api(`/docentes/${docente}/progreso`);
        if (!grupos.length) {
            return pintar(`${encabezado('Progreso del grupo', 'Acompaña el aprendizaje de cada estudiante.')}
                <div class="empty-state-card"><img src="../../img/files/EduCore_Identidad/06_estados_vacios/png/vacio_sin_grupos.png" alt="" class="empty-state-img">
                <h3 class="empty-state-title">Aún no tienes grupos</h3><p class="empty-state-desc">Crea un grupo y asígnale un curso para seguir el avance de tus estudiantes.</p>
                <a href="CrearGrupo.html" class="btn-create-group">+ Crear grupo</a></div>`);
        }
        pedido.grupo = pedido.grupo || grupos[0].id_grupo;
        const curso = pedido.curso ? `?id_curso=${pedido.curso}` : '';
        if (pedido.estudiante) {
            detalle(await P.api(`/docentes/${docente}/grupos/${pedido.grupo}/estudiantes/${pedido.estudiante}/progreso${curso}`));
        } else {
            listado(grupos, await P.api(`/docentes/${docente}/grupos/${pedido.grupo}/progreso${curso}`));
        }
    } catch (e) {
        error(e.message);
    }
});
