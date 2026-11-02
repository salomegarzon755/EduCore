document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Cargar usuario docente autenticado desde localStorage
    const storedUserRaw = localStorage.getItem('currentUser');
    let teacherUser = null;

    if (storedUserRaw) {
        try {
            teacherUser = JSON.parse(storedUserRaw);
        } catch (e) {
            console.error('Error parseando usuario docente:', e);
        }
    }

    const teacherFullName = teacherUser?.nombre || localStorage.getItem('loggedUserName') || 'Profe';
    const teacherId = teacherUser?.id_usuario || teacherUser?.id || 2; // ID fallback en desarrollo
    const firstName = teacherFullName.split(' ')[0];

    const displayTeacherName = document.getElementById('displayTeacherName');
    const teacherFirstNameLabels = document.querySelectorAll('.teacher-first-name');

    if (displayTeacherName) displayTeacherName.textContent = firstName;
    teacherFirstNameLabels.forEach(el => el.textContent = firstName);

    // 2. Selector de Grado en el formulario (CrearGrupo.html)
    const gradeBtns = document.querySelectorAll('.grade-btn');
    let selectedGrade = 'Primero';

    gradeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            gradeBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedGrade = btn.getAttribute('data-grade');
        });
    });

    // 3. Cargar catálogo de cursos desde PostgreSQL (CrearGrupo.html)
    const coursesContainer = document.querySelector('.courses-multiselect-container');
    if (coursesContainer) {
        fetch('http://localhost:5000/api/cursos')
            .then(res => res.json())
            .then(data => {
                const listaCursos = Array.isArray(data) ? data : (data.cursos || []);
                if (listaCursos.length > 0) {
                    coursesContainer.innerHTML = '';
                    listaCursos.forEach((curso, index) => {
                        const label = document.createElement('label');
                        label.className = 'course-checkbox-card';
                        label.innerHTML = `
                            <input type="checkbox" name="cursosSeleccionados" value="${curso.id_curso}" data-name="${curso.titulo_curso}" ${index === 0 ? 'checked' : ''}>
                            <div class="card-content">
                                <strong>${curso.titulo_curso}</strong>
                                <span>${curso.descripcion}</span>
                            </div>
                        `;
                        coursesContainer.appendChild(label);
                    });
                }
            })
            .catch(err => console.error('Error al obtener cursos de la BD:', err));
    }

    // 4. Envío de formulario de creación de grupo (HU.05 -> HU.06)
    const createGroupForm = document.getElementById('createGroupForm');
    const createGroupFormContainer = document.getElementById('createGroupFormContainer');
    const groupCreatedSuccessContainer = document.getElementById('groupCreatedSuccessContainer');
    const createdGroupSummary = document.getElementById('createdGroupSummary');
    const createdCourseSummary = document.getElementById('createdCourseSummary');

    if (createGroupForm) {
        createGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombreGrupo = document.getElementById('nombreGrupo').value.trim();
            const descripcionGrupo = document.getElementById('descripcionGrupo')?.value.trim() || '';
            
            const checkedCourses = document.querySelectorAll('input[name="cursosSeleccionados"]:checked');
            const idsCursos = Array.from(checkedCourses).map(cb => cb.value);
            const selectedCourseNames = Array.from(checkedCourses).map(cb => cb.getAttribute('data-name') || 'Curso');

            const payload = {
                nombre_grupo: nombreGrupo,
                grado: selectedGrade,
                descripcion: descripcionGrupo,
                id_docente: teacherId,
                ids_cursos: idsCursos
            };

            try {
                const response = await fetch('http://localhost:5000/api/grupos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok && (data.success || data.grupo)) {
                    const grupoCreado = data.grupo || data;
                    const idNuevoGrupo = grupoCreado.id_grupo;

                    if (createdGroupSummary) {
                        createdGroupSummary.textContent = `${nombreGrupo} · Grado ${selectedGrade.toLowerCase()}`;
                    }

                    if (createdCourseSummary) {
                        if (selectedCourseNames.length > 0) {
                            createdCourseSummary.textContent = `Cursos asignados (${selectedCourseNames.length}): ` + selectedCourseNames.join(' | ');
                        } else {
                            createdCourseSummary.textContent = 'Sin cursos asignados.';
                        }
                    }

                    // Vincular botón "Agregar estudiantes" con el grupo recién creado (HU.06)
                    const btnAgregarEstudiantes = document.querySelector('#groupCreatedSuccessContainer a.btn-create-group') || 
                                                 document.querySelector('#groupCreatedSuccessContainer a[href*="AgregarEstudiantes"]');
                    if (btnAgregarEstudiantes && idNuevoGrupo) {
                        btnAgregarEstudiantes.href = `DetalleGrupo.html?id=${idNuevoGrupo}&openModal=true`;
                    }

                    if (createGroupFormContainer) createGroupFormContainer.style.display = 'none';
                    if (groupCreatedSuccessContainer) groupCreatedSuccessContainer.style.display = 'block';
                } else {
                    alert('Error al guardar en BD: ' + (data.message || 'Error desconocido'));
                }

            } catch (error) {
                console.error('Error conectando con la API:', error);
                alert('No se pudo conectar con el servidor backend Flask.');
            }
        });
    }

    // 5. Cargar grupos y renderizar métricas + tarjetas (PanelPrincipal.html & MisGrupos.html)
    const emptyDashboardContainer = document.getElementById('emptyDashboardContainer');
    const kpiMetricsContainer = document.getElementById('kpiMetricsContainer');
    const dashboardGroupsSection = document.getElementById('dashboardGroupsSection');
    const dashboardGroupsList = document.getElementById('dashboardGroupsList');

    const emptyGroupsState = document.getElementById('emptyGroupsState');
    const groupsListContainer = document.getElementById('groupsListContainer');

    if (teacherId && (emptyDashboardContainer || emptyGroupsState || dashboardGroupsList || groupsListContainer)) {
        fetch(`http://localhost:5000/api/grupos/docente/${teacherId}`)
            .then(res => res.json())
            .then(data => {
                const grupos = Array.isArray(data) ? data : (data.grupos || []);

                if (grupos.length > 0) {
                    // Calcular Métricas Globales
                    const totalGrupos = grupos.length;
                    const totalEstudiantes = grupos.reduce((acc, g) => acc + (parseInt(g.total_estudiantes) || 0), 0);
                    const totalCursosAsociados = grupos.reduce((acc, g) => acc + (parseInt(g.total_cursos) || 0), 0);
                    const totalActividades = 0; // Estado inicial

                    // Actualizar indicadores KPI en el HTML
                    const elStatGrupos = document.getElementById('statTotalGrupos');
                    const elStatCursos = document.getElementById('statTotalCursos');
                    const elStatEstudiantes = document.getElementById('statTotalEstudiantes');
                    const elStatActividades = document.getElementById('statTotalActividades');

                    if (elStatGrupos) elStatGrupos.textContent = totalGrupos;
                    if (elStatCursos) elStatCursos.textContent = totalCursosAsociados;
                    if (elStatEstudiantes) elStatEstudiantes.textContent = totalEstudiantes;
                    if (elStatActividades) elStatActividades.textContent = totalActividades;

                    // Mostrar contenedores de métricas y grupos en Dashboard
                    if (kpiMetricsContainer) kpiMetricsContainer.style.display = 'grid';
                    if (dashboardGroupsSection) dashboardGroupsSection.style.display = 'block';
                    if (emptyDashboardContainer) emptyDashboardContainer.style.display = 'none';

                    // Ocultar estado vacío y mostrar lista en vista MisGrupos.html
                    if (emptyGroupsState) emptyGroupsState.style.display = 'none';
                    if (groupsListContainer) groupsListContainer.style.display = 'grid';

                    // Función generadora de HTML para las tarjetas con enlace a DetalleGrupo.html
                    const renderGroupCards = (targetElement) => {
                        if (!targetElement) return;
                        targetElement.innerHTML = '';
                        grupos.forEach(grupo => {
                            const card = document.createElement('div');
                            card.className = 'teacher-group-card';
                            card.innerHTML = `
                                <div>
                                    <div class="group-card-top">
                                        <div class="group-avatar-icon">🌱</div>
                                        <div class="group-title-info">
                                            <h3>${grupo.nombre_grupo}</h3>
                                            <p>Grado ${grupo.grado}.° · ${grupo.total_estudiantes} estudiantes</p>
                                        </div>
                                    </div>
                                    <div class="group-course-badge">
                                        ${grupo.total_cursos} ${grupo.total_cursos === 1 ? 'curso asociado' : 'cursos asociados'}
                                    </div>
                                    <div class="group-courses-name">
                                        ${grupo.nombres_cursos}
                                    </div>
                                </div>
                                <a href="DetalleGrupo.html?id=${grupo.id_grupo}" class="btn-ver-grupo-link">→ Ver grupo</a>
                            `;
                            targetElement.appendChild(card);
                        });
                    };

                    renderGroupCards(dashboardGroupsList);
                    renderGroupCards(groupsListContainer);

                } else {
                    // Si no hay grupos registrados, activar estados vacíos
                    if (kpiMetricsContainer) kpiMetricsContainer.style.display = 'none';
                    if (dashboardGroupsSection) dashboardGroupsSection.style.display = 'none';
                    if (emptyDashboardContainer) emptyDashboardContainer.style.display = 'flex';

                    if (emptyGroupsState) emptyGroupsState.style.display = 'flex';
                    if (groupsListContainer) groupsListContainer.style.display = 'none';
                }
            })
            .catch(err => {
                console.error('Error al obtener grupos:', err);
                if (emptyGroupsState) emptyGroupsState.style.display = 'flex';
                if (emptyDashboardContainer) emptyDashboardContainer.style.display = 'flex';
            });
    }

});