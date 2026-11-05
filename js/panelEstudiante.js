document.addEventListener('DOMContentLoaded', () => {

    const BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';

    // Cargar información del estudiante desde localStorage
    const storedUserRaw = localStorage.getItem('currentUser');
    let studentFullName = localStorage.getItem('loggedUserName') || 'Luna';
    let studentUser = { id_usuario: 3, nombre: studentFullName };
    

    if (storedUserRaw) {
        try {
            const userObj = JSON.parse(storedUserRaw);
            studentUser = userObj;
            if (userObj.nombre) {
                studentFullName = userObj.nombre;
            }
        } catch (e) {
            console.error('Error procesando datos del usuario:', e);
        }
    }

    const firstName = studentFullName.split(' ')[0];
    // Cambia la extracción del ID del estudiante por esto:
    const studentId = studentUser.id_estudiante || studentUser.id_usuario || studentUser.id || 1;

    const displayStudentName = document.getElementById('displayStudentName');
    const studentFirstNameLabels = document.querySelectorAll('.student-first-name');

    if (displayStudentName) displayStudentName.textContent = firstName;
    studentFirstNameLabels.forEach(el => el.textContent = firstName);

    // -----------------------------------------------------------
    // 1. VISTA: MIS GRUPOS (MisGrupos.html)
    // -----------------------------------------------------------
    const studentGroupsGrid = document.getElementById('studentGroupsGrid');
    const emptyStudentGroupsContainer = document.getElementById('emptyStudentGroupsContainer');

    if (studentGroupsGrid) {
        cargarGruposEstudiante();
    }

    async function cargarGruposEstudiante() {
        try {
            const res = await fetch(`${BASE_URL}/estudiantes/${studentId}/grupos`);
            const data = await res.json();

            if (data.success && data.grupos && data.grupos.length > 0) {
                renderGruposEstudiante(data.grupos);
            } else {
                if (emptyStudentGroupsContainer) emptyStudentGroupsContainer.style.display = 'flex';
                if (studentGroupsGrid) studentGroupsGrid.style.display = 'none';
            }
        } catch (err) {
            console.error('Error cargando grupos del estudiante:', err);
            if (emptyStudentGroupsContainer) emptyStudentGroupsContainer.style.display = 'flex';
        }
    }

    function renderGruposEstudiante(grupos) {
        if (!studentGroupsGrid) return;
        studentGroupsGrid.innerHTML = '';
        studentGroupsGrid.style.display = 'grid';
        if (emptyStudentGroupsContainer) emptyStudentGroupsContainer.style.display = 'none';

        grupos.forEach(g => {
            const card = document.createElement('div');
            card.className = 'teacher-group-card';
            card.innerHTML = `
                <div class="group-card-top">
                    <div class="group-avatar-icon">🌱</div>
                    <div class="group-title-info">
                        <h3>${g.nombre_grupo}</h3>
                        <p>Grado ${g.grado}.° · ${g.total_estudiantes} estudiantes</p>
                    </div>
                </div>
                <div class="group-course-badge">${g.total_cursos} curso${g.total_cursos === 1 ? '' : 's'} asociado${g.total_cursos === 1 ? '' : 's'}</div>
                <a href="DetalleGrupo.html?id=${g.id_grupo}" class="btn-ver-grupo-link">→ Ver grupo</a>
            `;
            studentGroupsGrid.appendChild(card);
        });
    }

    // -----------------------------------------------------------
    // 2. VISTA: DETALLE DEL GRUPO (DetalleGrupo.html)
    // -----------------------------------------------------------
    const groupDetailName = document.getElementById('groupDetailName');
    if (groupDetailName) {
        const urlParams = new URLSearchParams(window.location.search);
        const idGrupo = urlParams.get('id');

        if (idGrupo) {
            cargarDetalleGrupoEstudiante(idGrupo);
        } else {
            window.location.href = 'MisGrupos.html';
        }
    }

    async function cargarDetalleGrupoEstudiante(idGrupo) {
        const groupDetailGrade = document.getElementById('groupDetailGrade');
        const groupDetailStudentCount = document.getElementById('groupDetailStudentCount');
        const groupDetailClassCode = document.getElementById('groupDetailClassCode');
        const assignedCoursesContainer = document.getElementById('assignedCoursesContainer');
        const emptyCoursesState = document.getElementById('emptyCoursesState');

        try {
            const resGrupo = await fetch(`${BASE_URL}/grupos/${idGrupo}`);
            const dataGrupo = await resGrupo.json();

            if (dataGrupo.success && dataGrupo.grupo) {
                const g = dataGrupo.grupo;
                if (groupDetailName) groupDetailName.textContent = g.nombre_grupo;
                if (groupDetailGrade) groupDetailGrade.textContent = `Grado ${g.grado}.°`;
                if (groupDetailStudentCount) groupDetailStudentCount.textContent = `${g.total_estudiantes} estudiantes`;
                if (groupDetailClassCode) groupDetailClassCode.textContent = g.codigo_clase || `AC-${100 + Number(idGrupo)}`;
            }

            const resCursos = await fetch(`${BASE_URL}/grupos/${idGrupo}/cursos`);
            const dataCursos = await resCursos.json();

            if (dataCursos.success && dataCursos.cursos && dataCursos.cursos.length > 0) {
                if (emptyCoursesState) emptyCoursesState.style.display = 'none';
                if (assignedCoursesContainer) {
                    assignedCoursesContainer.innerHTML = '';
                    assignedCoursesContainer.style.display = 'grid';

                    dataCursos.cursos.forEach(curso => {
                        const esGrado2 = curso.id_curso == 2 || (curso.titulo_curso && curso.titulo_curso.toLowerCase().includes('exploramos'));
                        const bgTheme = esGrado2 ? 'bg-math-2' : 'bg-math-1';
                        const badgeTexto = esGrado2 ? 'MATEMÁTICAS · GRADO 2.°' : 'MATEMÁTICAS · GRADO 1.°';

                        const card = document.createElement('div');
                        card.className = 'course-card-illustrated';
                        card.innerHTML = `
                            <div class="course-card-banner ${bgTheme}">
                                <span class="course-card-badge">${badgeTexto}</span>
                            </div>
                            <div class="course-card-body-custom">
                                <h3>${curso.titulo_curso}</h3>
                                <p>${curso.descripcion || 'Sin descripción disponible.'}</p>
                            </div>
                            <div class="course-card-footer-custom">
                                <small style="color:#718096; font-weight:700;">${curso.total_unidades || 0} unidades</small>
                                <a href="MisCursos.html?id_curso=${curso.id_curso}#curso-${curso.id_curso}" class="btn-create-group" style="padding:6px 14px; font-size:12px; text-decoration:none;">→ Ver curso</a>
                            </div>
                        `;
                        assignedCoursesContainer.appendChild(card);
                    });
                }
            } else {
                if (emptyCoursesState) emptyCoursesState.style.display = 'flex';
                if (assignedCoursesContainer) assignedCoursesContainer.style.display = 'none';
            }
        } catch (err) {
            console.error('Error obteniendo el detalle del grupo para el estudiante:', err);
        }
    }

    // -----------------------------------------------------------
    // 3. VISTA: MIS CURSOS (MisCursos.html) - CON PROGRESO CALCULADO
    // -----------------------------------------------------------
    const studentCoursesContainer = document.getElementById('studentCoursesContainer');
    const emptyStudentCoursesContainer = document.getElementById('emptyStudentCoursesContainer');

    if (studentCoursesContainer) {
        cargarCursosDelEstudiante();
    }

    async function cargarCursosDelEstudiante() {
        try {
            const res = await fetch(`${BASE_URL}/estudiantes/${studentId}/cursos`);
            const data = await res.json();

            if (data.success && data.cursos && data.cursos.length > 0) {
                // Obtener el progreso real enriquecido para cada curso
                const cursosConProgreso = await Promise.all(
                    data.cursos.map(async (c) => {
                        try {
                            const resDetalle = await fetch(`${BASE_URL}/cursos/${c.id_curso}/detalle_completo?id_estudiante=${studentId}`);
                            const dataDetalle = await resDetalle.json();
                            if (dataDetalle.success && dataDetalle.curso) {
                                return {
                                    ...c,
                                    total_actividades: dataDetalle.curso.total_actividades || 0,
                                    actividades_completadas: dataDetalle.curso.actividades_completadas || 0,
                                    porcentaje_progreso: dataDetalle.curso.porcentaje_progreso || 0
                                };
                            }
                        } catch (e) {
                            console.error(`Error obteniendo detalle para curso ${c.id_curso}:`, e);
                        }
                        return c;
                    })
                );

                renderCursosEstudianteEstiloImagen3(cursosConProgreso);
            } else {
                if (emptyStudentCoursesContainer) emptyStudentCoursesContainer.style.display = 'flex';
                if (studentCoursesContainer) studentCoursesContainer.style.display = 'none';
            }
        } catch (err) {
            console.error('Error cargando cursos del estudiante:', err);
            if (emptyStudentCoursesContainer) emptyStudentCoursesContainer.style.display = 'flex';
        }
    }

    function renderCursosEstudianteEstiloImagen3(cursos) {
        if (!studentCoursesContainer) return;
        studentCoursesContainer.innerHTML = '';
        studentCoursesContainer.style.display = 'flex';
        if (emptyStudentCoursesContainer) emptyStudentCoursesContainer.style.display = 'none';

        cursos.forEach(c => {
            const totalAct = c.total_actividades || 0;
            const compAct = c.actividades_completadas || 0;
            
            // Usar el porcentaje devuelto o calcularlo como fallback
            const porcentaje = c.porcentaje_progreso !== undefined 
                ? c.porcentaje_progreso 
                : (totalAct > 0 ? Math.round((compAct / totalAct) * 100) : 0);

            const esGrado2 = c.id_curso == 2 || (c.titulo_curso && c.titulo_curso.toLowerCase().includes('exploramos'));
            const gradoTexto = esGrado2 ? 'Matemáticas · Grado 2.°' : 'Matemáticas · Grado 1.°';

            const card = document.createElement('div');
            card.className = 'student-course-card';
            card.id = `curso-${c.id_curso}`;

            card.innerHTML = `
                <div class="student-course-banner">
                    <h2>${c.titulo_curso}</h2>
                </div>
                <div class="student-course-content">
                    <span class="grade-pill-purple">${gradoTexto}</span>
                    <p class="student-course-description">${c.descripcion || ''}</p>
                    
                    <div class="progress-info-row">
                        <span>${compAct} de ${totalAct} actividades completadas</span>
                        <span>${porcentaje}%</span>
                    </div>

                    <div class="progress-track-custom">
                        <div class="progress-fill-custom" style="width: ${porcentaje}%;"></div>
                    </div>

                    <a href="MiCamino.html?id_curso=${c.id_curso}" class="btn-continue-course">
                        → Continuar
                    </a>
                </div>
            `;
            studentCoursesContainer.appendChild(card);
        });

        const urlParams = new URLSearchParams(window.location.search);
        const targetId = urlParams.get('id_curso');
        if (targetId) {
            setTimeout(() => {
                const targetElem = document.getElementById(`curso-${targetId}`);
                if (targetElem) {
                    targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 200);
        }
    }

    // -----------------------------------------------------------
    // 4. VISTA: MI CAMINO (MiCamino.html - SLIDER DE UNIDADES)
    // -----------------------------------------------------------
    const pathUnitsTrack = document.getElementById('pathUnitsTrack');

    if (pathUnitsTrack) {
        cargarCaminoEstudiante();
    }

    let unidadesCursoGlobal = [];
    let indiceUnidadActual = 0;

    async function cargarCaminoEstudiante() {
        const urlParams = new URLSearchParams(window.location.search);
        const idCurso = urlParams.get('id_curso') || 1;

        try {
            const res = await fetch(`${BASE_URL}/cursos/${idCurso}/detalle_completo?id_estudiante=${studentId}`);
            const data = await res.json();

            if (data.success && data.curso) {
                const curso = data.curso;
                const pathCourseTitle = document.getElementById('pathCourseTitle');
                if (pathCourseTitle) pathCourseTitle.textContent = curso.titulo_curso;

                unidadesCursoGlobal = curso.unidades || [];
                await aplicarProgreso(idCurso);

                // Abre el carrusel en la unidad donde está la estación actual
                const idxActual = unidadesCursoGlobal.findIndex(u => (u.actividades || []).some(a => a.estado === 'actual'));
                indiceUnidadActual = idxActual >= 0 ? idxActual : 0;
                renderizarCarruselUnidades();
            }
        } catch (err) {
            console.error('Error al obtener los datos del camino:', err);
        }
    }

    // Estado de cada estación según los resultados guardados en la base de datos
    async function aplicarProgreso(idCurso) {
        let progreso = {};
        try {
            const res = await fetch(`${BASE_URL}/estudiantes/${studentId}/progreso?id_curso=${idCurso}`);
            const data = await res.json();
            if (data.success) progreso = data.progreso || {};
        } catch (err) {
            console.error('Error cargando el progreso:', err);
        }
        let actualAsignada = false;
        unidadesCursoGlobal.forEach(u => (u.actividades || []).forEach(a => {
            const r = progreso[a.id_actividad];
            if (r && r.completada) {
                a.estado = 'completada';
            } else if (!actualAsignada) {
                a.estado = 'actual';
                actualAsignada = true;
            } else {
                a.estado = 'bloqueada';
            }
        }));
    }

    function renderizarCarruselUnidades() {
        if (!pathUnitsTrack) return;
        pathUnitsTrack.innerHTML = '';

        unidadesCursoGlobal.forEach((u, idxUnidad) => {
            const slideContainer = document.createElement('div');
            slideContainer.className = 'unit-slide-canvas';

            const actividades = u.actividades || [];
            let nodosHTML = '';

            // Renderizar hasta 4 actividades por unidad
            for (let i = 0; i < 4; i++) {
                const act = actividades[i];
                const posClass = `pos-${i + 1}`;

                if (act) {
                    const estado = act.estado || (idxUnidad === 0 && i === 0 ? 'actual' : 'bloqueada');
                    let icono = '🔒';
                    let estadoLabel = 'Por descubrir';

                    if (estado === 'completada') {
                        icono = '⭐';
                        estadoLabel = 'Completada';
                    } else if (estado === 'actual') {
                        icono = '🐸';
                        estadoLabel = '¡Aquí seguimos!';
                    }

                    nodosHTML += `
                        <div class="path-node-card ${posClass} ${estado}" ${estado !== 'bloqueada' ? `data-href="Actividad.html?id_actividad=${act.id_actividad}" style="cursor:pointer"` : ''}>
                            <div class="node-avatar-badge">${icono}</div>
                            <h4 class="node-title">${act.titulo_actividad}</h4>
                            <p class="node-status-text">${estadoLabel}</p>
                        </div>
                    `;
                } else {
                    // Estación vacía o bloqueada por defecto
                    nodosHTML += `
                        <div class="path-node-card ${posClass} bloqueada">
                            <div class="node-avatar-badge">🔒</div>
                            <h4 class="node-title">Estación por descubrir</h4>
                            <p class="node-status-text">Bloqueada</p>
                        </div>
                    `;
                }
            }

            slideContainer.innerHTML = nodosHTML;
            pathUnitsTrack.appendChild(slideContainer);
        });

        actualizarNavegacionUnidad();
    }

    function actualizarNavegacionUnidad() {
        const btnPrevUnit = document.getElementById('btnPrevUnit');
        const btnNextUnit = document.getElementById('btnNextUnit');
        const pathUnitSubtitle = document.getElementById('pathUnitSubtitle');
        const pathProgressBadge = document.getElementById('pathProgressBadge');

        // Mover carrusel con CSS Translate
        pathUnitsTrack.style.transform = `translateX(-${indiceUnidadActual * 100}%)`;

        const uActual = unidadesCursoGlobal[indiceUnidadActual];
        if (pathUnitSubtitle && uActual) {
            pathUnitSubtitle.textContent = uActual.titulo_unidad || `Unidad ${indiceUnidadActual + 1}`;
        }

        if (pathProgressBadge && uActual) {
            const acts = uActual.actividades || [];
            const comp = acts.filter(a => a.estado === 'completada').length;
            pathProgressBadge.textContent = `${comp} de ${Math.min(acts.length || 4, 4)} estaciones completadas`;
        }

        if (btnPrevUnit) btnPrevUnit.disabled = (indiceUnidadActual === 0);
        if (btnNextUnit) btnNextUnit.disabled = (indiceUnidadActual >= unidadesCursoGlobal.length - 1);
    }

    // Abrir la actividad al tocar una estación disponible
    if (pathUnitsTrack) {
        pathUnitsTrack.addEventListener('click', (e) => {
            const nodo = e.target.closest('[data-href]');
            if (nodo) window.location.href = nodo.dataset.href;
        });
    }

    // Listeners para botones Anterior / Siguiente Unidad
    const btnPrevUnit = document.getElementById('btnPrevUnit');
    const btnNextUnit = document.getElementById('btnNextUnit');

    if (btnPrevUnit) {
        btnPrevUnit.addEventListener('click', () => {
            if (indiceUnidadActual > 0) {
                indiceUnidadActual--;
                actualizarNavegacionUnidad();
            }
        });
    }

    if (btnNextUnit) {
        btnNextUnit.addEventListener('click', () => {
            if (indiceUnidadActual < unidadesCursoGlobal.length - 1) {
                indiceUnidadActual++;
                actualizarNavegacionUnidad();
            }
        });
    }
});