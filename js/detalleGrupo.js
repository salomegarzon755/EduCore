document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';

    const urlParams = new URLSearchParams(window.location.search);
    const idGrupo = urlParams.get('id') || urlParams.get('id_grupo');

    if (!idGrupo) {
        alert('No se especificó un grupo.');
        window.location.href = 'MisGrupos.html';
        return;
    }

    let currentGroupInfo = null;
    let selectedCourseToRemove = null;
    let selectedStudentToAdd = null;

    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // El backend devuelve id_estudiante / apodo (no id_usuario / usuario)
    const idDeEstudiante = (est) => est.id_estudiante ?? est.id_usuario ?? est.id;
    const aliasDeEstudiante = (est) => est.apodo || est.usuario || '';

    // Elementos DOM Principales
    const groupDetailName = document.getElementById('groupDetailName');
    const groupDetailGrade = document.getElementById('groupDetailGrade');
    const groupDetailStudentCount = document.getElementById('groupDetailStudentCount');
    const groupDetailClassCode = document.getElementById('groupDetailClassCode');

    // Pestañas
    const tabEstudiantes = document.getElementById('tabEstudiantes');
    const tabCursos = document.getElementById('tabCursos');
    const sectionEstudiantes = document.getElementById('sectionEstudiantes');
    const sectionCursos = document.getElementById('sectionCursos');

    // Contenedores
    const studentsGridContainer = document.getElementById('studentsGridContainer');
    const emptyStudentsGroup = document.getElementById('emptyStudentsGroup');
    const assignedCoursesContainer = document.getElementById('assignedCoursesContainer');
    const emptyCoursesState = document.getElementById('emptyCoursesState');
    const coursesCountTitle = document.getElementById('coursesCountTitle');
    const alertFeedbackBanner = document.getElementById('alertFeedbackBanner');

    // Modales Estudiante
    const addStudentModalOverlay = document.getElementById('addStudentModalOverlay');
    const btnOpenAddModal = document.getElementById('btnOpenAddModal');
    const btnCloseAddModal = document.getElementById('btnCloseAddModal');
    const inputSearchStudent = document.getElementById('inputSearchStudent');
    const searchResultsList = document.getElementById('searchResultsList');
    const btnConfirmAddStudent = document.getElementById('btnConfirmAddStudent');

    // Modales Cursos
    const addCourseModalOverlay = document.getElementById('addCourseModalOverlay');
    const btnOpenAddCourseModal = document.getElementById('btnOpenAddCourseModal');
    const btnTriggerAddCourse = document.getElementById('btnTriggerAddCourse');
    const btnCancelAddCourse = document.getElementById('btnCancelAddCourse');
    const availableCoursesList = document.getElementById('availableCoursesList');

    const confirmRemoveModalOverlay = document.getElementById('confirmRemoveModalOverlay');
    const removeCourseTitle = document.getElementById('removeCourseTitle');
    const btnCancelRemoveCourse = document.getElementById('btnCancelRemoveCourse');
    const btnConfirmRemoveCourse = document.getElementById('btnConfirmRemoveCourse');

    // --- CAMBIO DE PESTAÑAS ---
    if (tabEstudiantes && tabCursos) {
        tabEstudiantes.addEventListener('click', () => {
            tabEstudiantes.classList.add('active');
            tabCursos.classList.remove('active');
            sectionEstudiantes.style.display = 'block';
            sectionCursos.style.display = 'none';
        });

        tabCursos.addEventListener('click', () => {
            tabCursos.classList.add('active');
            tabEstudiantes.classList.remove('active');
            sectionCursos.style.display = 'block';
            sectionEstudiantes.style.display = 'none';
        });
    }

    // 1. Cargar Información General del Grupo
    async function cargarDetalleGrupo() {
        try {
            const res = await fetch(`${BASE_URL}/grupos/${idGrupo}`);
            const data = await res.json();

            if (data.success && data.grupo) {
                currentGroupInfo = data.grupo;
                if (groupDetailName) groupDetailName.textContent = currentGroupInfo.nombre_grupo;
                if (groupDetailGrade) groupDetailGrade.textContent = `Grado ${currentGroupInfo.grado}.°`;
                if (groupDetailStudentCount) groupDetailStudentCount.textContent = `${currentGroupInfo.total_estudiantes} estudiantes`;
                if (groupDetailClassCode) groupDetailClassCode.textContent = currentGroupInfo.codigo_clase || `AC-${100 + Number(idGrupo)}`;

                renderEstudiantes(currentGroupInfo.estudiantes || []);
            }

            cargarCursosGrupo();
        } catch (err) {
            console.error('Error al cargar detalle del grupo:', err);
        }
    }

    // 2. Renderizar Lista de Estudiantes
    function renderEstudiantes(estudiantes) {
        if (!studentsGridContainer) return;
        studentsGridContainer.innerHTML = '';

        if (!estudiantes || estudiantes.length === 0) {
            if (emptyStudentsGroup) emptyStudentsGroup.style.display = 'flex';
            studentsGridContainer.style.display = 'none';
            return;
        }

        if (emptyStudentsGroup) emptyStudentsGroup.style.display = 'none';
        studentsGridContainer.style.display = 'grid';

        estudiantes.forEach(est => {
            const card = document.createElement('div');
            card.className = 'teacher-group-card';

            const progresoHTML = (est.progreso || []).map(p => {
                const total = p.total_actividades || 0;
                const hechas = p.actividades_completadas || 0;
                const pct = total ? Math.round((hechas / total) * 100) : 0;
                return `<p style="margin:6px 0 0; font-size:12px; color:#4A5568; font-weight:700;">
                            📘 ${esc(p.titulo_curso)}: ${hechas} de ${total} actividades (${pct}%)
                        </p>`;
            }).join('');

            card.innerHTML = `
                <div class="group-card-top">
                    <div class="group-avatar-icon">👤</div>
                    <div class="group-title-info">
                        <h3>${esc(est.nombre || aliasDeEstudiante(est))}</h3>
                        <p>@${esc(aliasDeEstudiante(est))}</p>
                    </div>
                </div>
                <div class="group-course-badge">Estudiante activo</div>
                ${progresoHTML}
                <button type="button" class="btn-remove-student" style="margin-top:12px; background:#FFF; color:#C53030; border:1px solid #FEB2B2; border-radius:12px; padding:6px 14px; font-size:12px; font-weight:800; cursor:pointer;">
                    Quitar del grupo
                </button>
            `;
            card.querySelector('.btn-remove-student').addEventListener('click', () => quitarEstudiante(est));
            studentsGridContainer.appendChild(card);
        });
    }

    async function quitarEstudiante(est) {
        const nombre = est.nombre || aliasDeEstudiante(est);
        const ok = confirm(`¿Quitar a ${nombre} de este grupo?\n\nSu progreso en los cursos se conserva por si entra a otro grupo con el mismo curso.`);
        if (!ok) return;
        try {
            const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/estudiantes/${idDeEstudiante(est)}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok && data.success) {
                mostrarFeedback('✓ Estudiante retirado del grupo. Su progreso se conserva.', '#DCFCE7', '#166534');
                cargarDetalleGrupo();
            } else {
                alert(data.message || 'No se pudo quitar al estudiante.');
            }
        } catch (err) {
            console.error('Error quitando estudiante:', err);
            alert('No se pudo conectar con el servidor.');
        }
    }

    // 3. Cargar y Renderizar Cursos del Grupo (Datos Reales + Enlace Directo)
    async function cargarCursosGrupo() {
        try {
            const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/cursos`);
            const data = await res.json();

            if (data.success) {
                renderCursosAsignados(data.cursos || []);
            }
        } catch (err) {
            console.error('Error al obtener cursos del grupo:', err);
        }
    }

    function renderCursosAsignados(cursos) {
        if (!assignedCoursesContainer) return;
        assignedCoursesContainer.innerHTML = '';
        const total = cursos.length;

        if (coursesCountTitle) coursesCountTitle.textContent = `Cursos asignados (${total})`;

        if (total === 0) {
            if (emptyCoursesState) emptyCoursesState.style.display = 'block';
            assignedCoursesContainer.style.display = 'none';
            return;
        }

        if (emptyCoursesState) emptyCoursesState.style.display = 'none';
        assignedCoursesContainer.style.display = 'grid';

        cursos.forEach((curso) => {
            const esGrado2 = curso.id_curso == 2 || (curso.titulo_curso && curso.titulo_curso.toLowerCase().includes('exploramos'));
            const bgTheme = esGrado2 ? 'bg-math-2' : 'bg-math-1';
            const badgeTexto = esGrado2 ? 'MATEMÁTICAS · GRADO 2.°' : 'MATEMÁTICAS · GRADO 1.°';
            const totalUnidades = curso.total_unidades || 3;

            const card = document.createElement('div');
            card.className = 'course-card-illustrated';
            card.innerHTML = `
                <div class="course-card-banner ${bgTheme}">
                    <span class="course-card-badge">${badgeTexto}</span>
                    <div class="menu-options-wrapper">
                        <button type="button" class="btn-icon-dots dropdown-toggle">•••</button>
                        <div class="dropdown-action-menu" style="display: none;">
                            <button type="button" class="dropdown-action-item danger-text btn-action-remove" data-id="${curso.id_curso}">🗑️ Quitar del grupo</button>
                        </div>
                    </div>
                </div>
                <div class="course-card-body-custom">
                    <h3>${curso.titulo_curso}</h3>
                    <p>${curso.descripcion || 'Sin descripción disponible.'}</p>
                </div>
                <div class="course-card-footer-custom">
                    <small style="color:#718096; font-weight:700;">${totalUnidades} unidades</small>
                    <a href="misCursos.html?id_curso=${curso.id_curso}#curso-${curso.id_curso}" class="btn-create-group" style="padding: 6px 14px; font-size: 12px; text-decoration: none;">→ Ver curso</a>
                </div>
            `;

            // Desplegable de Opciones
            const toggleBtn = card.querySelector('.dropdown-toggle');
            const dropdownMenu = card.querySelector('.dropdown-action-menu');
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dropdown-action-menu').forEach(m => m.style.display = 'none');
                dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
            });

            // Acción Quitar del Grupo
            const removeBtn = card.querySelector('.btn-action-remove');
            removeBtn.addEventListener('click', () => {
                selectedCourseToRemove = { id: curso.id_curso, nombre: curso.titulo_curso };
                if (removeCourseTitle) removeCourseTitle.textContent = curso.titulo_curso;
                if (confirmRemoveModalOverlay) confirmRemoveModalOverlay.style.display = 'flex';
            });

            assignedCoursesContainer.appendChild(card);
        });
    }

    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-action-menu').forEach(m => m.style.display = 'none');
    });

    // --- ACCIONES MODAL AGREGAR ESTUDIANTE ---
    if (btnOpenAddModal) {
        btnOpenAddModal.addEventListener('click', () => {
            if (addStudentModalOverlay) addStudentModalOverlay.style.display = 'flex';
            if (searchResultsList) searchResultsList.innerHTML = '<p style="color:#718096; font-size:13px;">Escribe para buscar estudiantes...</p>';
            if (inputSearchStudent) inputSearchStudent.value = '';
            selectedStudentToAdd = null;
        });
    }

    if (btnCloseAddModal) {
        btnCloseAddModal.addEventListener('click', () => {
            if (addStudentModalOverlay) addStudentModalOverlay.style.display = 'none';
        });
    }

    if (inputSearchStudent) {
        let timer;
        inputSearchStudent.addEventListener('input', () => {
            clearTimeout(timer);
            const q = inputSearchStudent.value.trim();
            timer = setTimeout(async () => {
                if (!q) {
                    searchResultsList.innerHTML = '<p style="color:#718096; font-size:13px;">Escribe para buscar estudiantes...</p>';
                    return;
                }
                try {
                    const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/estudiantes/buscar?q=${encodeURIComponent(q)}`);
                    const data = await res.json();

                    if (data.success && searchResultsList) {
                        searchResultsList.innerHTML = '';
                        if (data.estudiantes.length === 0) {
                            searchResultsList.innerHTML = '<p style="color:#718096; font-size:13px;">No se encontraron estudiantes disponibles.</p>';
                            return;
                        }
                        selectedStudentToAdd = null;
                        if (btnConfirmAddStudent) {
                            btnConfirmAddStudent.disabled = true;
                            btnConfirmAddStudent.style.opacity = '0.5';
                        }
                        data.estudiantes.forEach(est => {
                            const item = document.createElement('div');
                            const bloqueado = est.en_grupo || est.conflicto_curso;
                            item.style.cssText = 'padding:10px; border:1px solid #CBD5E0; border-radius:10px; background:#FFF;'
                                + (bloqueado ? ' opacity:0.6; cursor:not-allowed;' : ' cursor:pointer;');

                            let aviso = '';
                            if (est.en_grupo) {
                                aviso = 'Ya está en este grupo';
                            } else if (est.conflicto_curso && est.grupo_conflicto) {
                                aviso = `Ya está en «${esc(est.grupo_conflicto.nombre_grupo)}», que tiene el mismo curso (${esc(est.grupo_conflicto.cursos)}). Debe salir de ese grupo primero.`;
                            }
                            item.innerHTML = `<strong>${esc(est.nombre || aliasDeEstudiante(est))}</strong> <small style="color:#718096;">(@${esc(aliasDeEstudiante(est))})</small>`
                                + (aviso ? `<div style="font-size:12px; color:#C53030; margin-top:4px; font-weight:600;">${aviso}</div>` : '');

                            if (!bloqueado) {
                                item.addEventListener('click', () => {
                                    document.querySelectorAll('#searchResultsList > div').forEach(d => d.style.borderColor = '#CBD5E0');
                                    item.style.borderColor = '#10B981';
                                    item.style.backgroundColor = '#ECFDF5';
                                    selectedStudentToAdd = est;
                                    if (btnConfirmAddStudent) {
                                        btnConfirmAddStudent.disabled = false;
                                        btnConfirmAddStudent.style.opacity = '1';
                                    }
                                });
                            }
                            searchResultsList.appendChild(item);
                        });
                    }
                } catch (err) {
                    console.error('Error buscando estudiantes:', err);
                }
            }, 300);
        });
    }

    if (btnConfirmAddStudent) {
        btnConfirmAddStudent.addEventListener('click', async () => {
            if (!selectedStudentToAdd) return;
            const idEstudiante = idDeEstudiante(selectedStudentToAdd);
            if (idEstudiante === undefined || idEstudiante === null) {
                alert('No se pudo identificar al estudiante seleccionado. Vuelve a buscarlo.');
                return;
            }
            try {
                const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/estudiantes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_estudiante: idEstudiante })
                });
                const data = await res.json();
                if (addStudentModalOverlay) addStudentModalOverlay.style.display = 'none';
                selectedStudentToAdd = null;

                if (res.ok && data.success) {
                    mostrarFeedback('✓ ' + (data.message || 'Estudiante agregado al grupo.'), '#DCFCE7', '#166534', 8000);
                    cargarDetalleGrupo();
                } else {
                    // 409 CURSO_DUPLICADO: el mensaje del servidor ya indica de qué grupo debe salir
                    alert(data.message || 'Error agregando estudiante.');
                }
            } catch (err) {
                console.error('Error agregando estudiante:', err);
                alert('No se pudo conectar con el servidor.');
            }
        });
    }

    // --- ACCIONES MODAL AGREGAR CURSO ---
    [btnOpenAddCourseModal, btnTriggerAddCourse].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => abrirModalCatalogoCursos());
        }
    });

    if (btnCancelAddCourse) {
        btnCancelAddCourse.addEventListener('click', () => {
            if (addCourseModalOverlay) addCourseModalOverlay.style.display = 'none';
        });
    }

    async function abrirModalCatalogoCursos() {
        if (addCourseModalOverlay) addCourseModalOverlay.style.display = 'flex';
        if (availableCoursesList) availableCoursesList.innerHTML = '<p style="text-align:center;">Cargando catálogo...</p>';

        try {
            const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/cursos/disponibles`);
            const data = await res.json();

            if (data.success && availableCoursesList) {
                availableCoursesList.innerHTML = '';
                if (!data.cursos || data.cursos.length === 0) {
                    availableCoursesList.innerHTML = '<p style="text-align:center; color:#718096;">Todos los cursos ya han sido asignados a este grupo.</p>';
                    return;
                }
                data.cursos.forEach(curso => {
                    const item = document.createElement('div');
                    item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid #E2E8F0; border-radius:12px; background:#FFF;';
                    item.innerHTML = `
                        <div>
                            <h4 style="margin:0 0 4px 0; font-size:14px; color:#2D3748;">${curso.titulo_curso}</h4>
                            <p style="margin:0; font-size:12px; color:#718096;">${curso.descripcion}</p>
                        </div>
                        <button type="button" class="btn-create-group btn-add-single" style="padding:6px 12px; font-size:12px;">+ Agregar</button>
                    `;
                    item.querySelector('.btn-add-single').addEventListener('click', async () => {
                        await asociarCursoAGrupo(curso.id_curso);
                    });
                    availableCoursesList.appendChild(item);
                });
            }
        } catch (err) {
            console.error('Error catálogo cursos:', err);
        }
    }

    async function asociarCursoAGrupo(idCurso) {
        try {
            const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/cursos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_curso: idCurso })
            });
            const data = await res.json();
            if (addCourseModalOverlay) addCourseModalOverlay.style.display = 'none';

            if (res.ok && data.success) {
                mostrarFeedback('✓ Curso asignado al grupo con éxito.', '#DCFCE7', '#166534');
                cargarCursosGrupo();
            } else {
                alert(data.message || 'Error al asignar curso.');
            }
        } catch (err) {
            console.error('Error asociando curso:', err);
        }
    }

    // --- ACCIONES QUITAR CURSO ---
    if (btnCancelRemoveCourse) {
        btnCancelRemoveCourse.addEventListener('click', () => {
            if (confirmRemoveModalOverlay) confirmRemoveModalOverlay.style.display = 'none';
        });
    }

    if (btnConfirmRemoveCourse) {
        btnConfirmRemoveCourse.addEventListener('click', async () => {
            if (!selectedCourseToRemove) return;
            try {
                const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/cursos/${selectedCourseToRemove.id}`, {
                    method: 'DELETE'
                });
                const data = await res.json();
                if (confirmRemoveModalOverlay) confirmRemoveModalOverlay.style.display = 'none';

                if (res.ok && data.success) {
                    mostrarFeedback('✓ Curso quitado del grupo.', '#DCFCE7', '#166534');
                    cargarCursosGrupo();
                } else {
                    alert(data.message || 'No se pudo quitar el curso.');
                }
            } catch (err) {
                console.error('Error quitando curso:', err);
            }
        });
    }

    function mostrarFeedback(mensaje, bg, color, duracion = 4000) {
        if (!alertFeedbackBanner) return;
        alertFeedbackBanner.textContent = mensaje;
        alertFeedbackBanner.style.backgroundColor = bg;
        alertFeedbackBanner.style.color = color;
        alertFeedbackBanner.style.display = 'block';
        setTimeout(() => { alertFeedbackBanner.style.display = 'none'; }, duracion);
    }

    cargarDetalleGrupo();
});