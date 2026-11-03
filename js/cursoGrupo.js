document.addEventListener('DOMContentLoaded', () => {

    const BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';

    const storedUserRaw = localStorage.getItem('currentUser');
    const teacherUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    const teacherId = teacherUser?.id_usuario || teacherUser?.id || 2;

    const urlParams = new URLSearchParams(window.location.search);
    const targetCourseId = urlParams.get('id') || urlParams.get('id_curso') || (window.location.hash ? window.location.hash.replace('#curso-', '') : null);

    const fullCoursesContainer = document.getElementById('fullCoursesContainer');
    const feedbackBanner = document.getElementById('courseAssignFeedback');

    // Modales Lector de Puntos
    const contentModalOverlay = document.getElementById('contentModalOverlay');
    const modalActivityType = document.getElementById('modalActivityType');
    const modalActivityTitle = document.getElementById('modalActivityTitle');
    const modalBodyPoints = document.getElementById('modalBodyPoints');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnDoneModal = document.getElementById('btnDoneModal');

    let misGruposDocente = [];

    // 1. Cargar Grupos del Docente
    async function cargarGruposDocente() {
        if (!teacherId) return;
        try {
            const res = await fetch(`${BASE_URL}/grupos/docente/${teacherId}`);
            const data = await res.json();
            misGruposDocente = Array.isArray(data) ? data : (data.grupos || []);
        } catch (err) {
            console.error('Error cargando grupos del docente:', err);
        }
    }

    // 2. Cargar Catálogo Completo de Cursos (Unidades + Actividades)
    async function cargarCursosCompleto() {
        await cargarGruposDocente();

        try {
            const res = await fetch(`${BASE_URL}/cursos/completo`);
            const data = await res.json();

            if (data.success && fullCoursesContainer) {
                renderCursosCompletos(data.cursos);

                // Auto-scroll y destello verde al llegar desde el botón "Ver curso" de DetalleGrupo
                if (targetCourseId) {
                    setTimeout(() => {
                        const targetElem = document.getElementById(`curso-${targetCourseId}`);
                        if (targetElem) {
                            targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetElem.style.transition = 'box-shadow 0.4s ease, border-color 0.4s ease';
                            targetElem.style.borderColor = '#10B981';
                            targetElem.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.4)';
                            setTimeout(() => {
                                targetElem.style.borderColor = '#E2E8F0';
                                targetElem.style.boxShadow = '0 4px 18px rgba(0, 0, 0, 0.04)';
                            }, 2500);
                        }
                    }, 250);
                }
            }
        } catch (err) {
            console.error('Error al obtener cursos completos:', err);
            if (fullCoursesContainer) {
                fullCoursesContainer.innerHTML = '<p style="text-align:center; color:#E53E3E;">Error al cargar el catálogo de cursos.</p>';
            }
        }
    }

    // 3. Renderizar cada Curso con identificador id="curso-X"
    function renderCursosCompletos(cursos) {
        if (!fullCoursesContainer) return;
        fullCoursesContainer.innerHTML = '';

        if (!cursos || cursos.length === 0) {
            fullCoursesContainer.innerHTML = '<p style="text-align:center; color:#718096;">No hay cursos disponibles.</p>';
            return;
        }

        cursos.forEach((c, idx) => {
            const bgTheme = (idx % 2 === 0) ? 'bg-math-1' : 'bg-math-2';
            const card = document.createElement('div');
            card.className = 'course-card-docente-full';
            card.id = `curso-${c.id_curso}`; // ID para anclaje

            // Opciones del selector de grupos
            let optionsGruposHTML = '<option value="">-- Seleccionar grupo --</option>';
            misGruposDocente.forEach(g => {
                optionsGruposHTML += `<option value="${g.id_grupo}">${g.nombre_grupo} (Grado ${g.grado}.°)</option>`;
            });

            // Generar HTML de las Unidades y Actividades
            let unidadesHTML = '';
            if (c.unidades && c.unidades.length > 0) {
                c.unidades.forEach(u => {
                    let actividadesHTML = '';
                    if (u.actividades && u.actividades.length > 0) {
                        u.actividades.forEach(act => {
                            const tipoClass = (act.tipo_contenido || 'Práctica').toLowerCase();
                            const iconBtn = act.tipo_contenido === 'Teoría' ? '📖 Ver Teoría' : '📝 Ver Actividad';

                            actividadesHTML += `
                                <div class="activity-pill-card">
                                    <div>
                                        <span class="activity-type-tag ${tipoClass}">${act.tipo_contenido}</span>
                                        <h5 style="margin:6px 0 0 0; font-size:13px; color:#2D3748;">${act.titulo_actividad}</h5>
                                    </div>
                                    <button type="button" class="btn-create-group btn-view-act-modal" 
                                        style="padding:4px 10px; font-size:11px; justify-content:center;"
                                        data-id="${act.id_actividad}"
                                        data-tipo="${act.tipo_contenido}"
                                        data-titulo="${act.titulo_actividad}">
                                        ${iconBtn}
                                    </button>
                                </div>
                            `;
                        });
                    } else {
                        actividadesHTML = '<p style="color:#718096; font-size:12px;">Sin actividades.</p>';
                    }

                    unidadesHTML += `
                        <div class="unit-block-card">
                            <div class="unit-block-title">
                                <span>${u.titulo_unidad}</span>
                                <small style="color:#718096; font-size:12px;">${u.actividades ? u.actividades.length : 0} lecciones</small>
                            </div>
                            <div class="activities-horizontal-grid">
                                ${actividadesHTML}
                            </div>
                        </div>
                    `;
                });
            } else {
                unidadesHTML = '<p style="color:#718096;">Sin unidades registradas.</p>';
            }

            card.innerHTML = `
                <!-- PARTE 1: INFORMACIÓN DEL CURSO Y ASIGNACIÓN -->
                <div class="course-card-header-full ${bgTheme}">
                    <div>
                        <span class="course-tag-pill">MATEMÁTICAS · GRADO ${(c.grado || (c.id_curso == 2 ? '2.°' : '1.°')).toUpperCase()}</span>
                        <h2 style="margin:8px 0 4px 0; font-size:22px;">${c.titulo_curso}</h2>
                        <p style="margin:0; font-size:13px; color:#E2E8F0;">${c.descripcion}</p>
                    </div>
                    <div class="header-badges-summary">
                        <span class="summary-badge">${c.total_unidades || (c.unidades ? c.unidades.length : 3)} Unidades</span>
                        <span class="summary-badge">${c.total_actividades || 12} Actividades</span>
                    </div>
                </div>

                <div class="course-card-body-full">
                    <div class="association-box">
                        <div class="field-group">
                            <label for="selectGroup_${c.id_curso}">Asignar este curso al grupo:</label>
                            <select id="selectGroup_${c.id_curso}" class="form-select-custom group-select-dynamic" data-course-id="${c.id_curso}">
                                ${optionsGruposHTML}
                            </select>
                        </div>
                        <button type="button" class="btn-create-group btn-assign-course" data-course-id="${c.id_curso}">
                            Asociar curso al grupo
                        </button>
                    </div>
                </div>

                <!-- PARTE 2: ESTRUCTURA DE UNIDADES Y ACTIVIDADES ENLISTADAS -->
                <div class="course-structure-section">
                    <div class="course-structure-title">
                        <span>📚 Unidades y Contenidos de ${c.titulo_curso}</span>
                    </div>
                    <div class="units-vertical-accordion">
                        ${unidadesHTML}
                    </div>
                </div>
            `;

            // Ver Actividad/Teoría Modal
            card.querySelectorAll('.btn-view-act-modal').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idAct = btn.getAttribute('data-id');
                    const tipo = btn.getAttribute('data-tipo');
                    const titulo = btn.getAttribute('data-titulo');
                    abrirModalPuntos(idAct, tipo, titulo);
                });
            });

            // Asociar Curso a Grupo
            const assignBtn = card.querySelector('.btn-assign-course');
            assignBtn.addEventListener('click', async () => {
                const select = card.querySelector(`.group-select-dynamic[data-course-id="${c.id_curso}"]`);
                const groupId = select ? select.value : null;

                if (!groupId) {
                    alert('Por favor, selecciona un grupo antes de asociar el curso.');
                    return;
                }

                try {
                    const res = await fetch(`${BASE_URL}/grupos/${groupId}/cursos`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id_curso: c.id_curso })
                    });
                    const data = await res.json();

                    if (res.ok && data.success) {
                        if (feedbackBanner) {
                            feedbackBanner.textContent = '✓ Curso asociado al grupo correctamente';
                            feedbackBanner.style.backgroundColor = '#DCFCE7';
                            feedbackBanner.style.color = '#166534';
                            feedbackBanner.style.display = 'block';
                            setTimeout(() => { feedbackBanner.style.display = 'none'; }, 4000);
                        }
                    } else {
                        alert(data.message || 'El curso ya se encuentra asociado a este grupo.');
                    }
                } catch (e) {
                    console.error('Error asociando curso:', e);
                    alert('No se pudo conectar con el servidor.');
                }
            });

            fullCoursesContainer.appendChild(card);
        });
    }

    // 4. Modal Lector de Puntos
    async function abrirModalPuntos(idActividad, tipo, titulo) {
        if (modalActivityTitle) modalActivityTitle.textContent = titulo;
        if (modalActivityType) {
            modalActivityType.textContent = tipo.toUpperCase();
            modalActivityType.className = `course-tag-pill ${tipo.toLowerCase()}`;
        }
        if (modalBodyPoints) modalBodyPoints.innerHTML = '<p style="text-align:center;">Cargando contenido...</p>';
        if (contentModalOverlay) contentModalOverlay.style.display = 'flex';

        try {
            const res = await fetch(`${BASE_URL}/actividades/${idActividad}/puntos`);
            const data = await res.json();

            if (data.success && modalBodyPoints) {
                modalBodyPoints.innerHTML = '';
                const puntos = data.puntos || [];

                if (puntos.length === 0) {
                    modalBodyPoints.innerHTML = '<p style="text-align:center; color:#718096;">No hay puntos registrados en esta lección.</p>';
                    return;
                }

                puntos.forEach((p, idx) => {
                    const pCard = document.createElement('div');
                    pCard.className = 'point-card-reader';

                    if (tipo === 'Teoría') {
                        pCard.innerHTML = `
                            <p><strong>Punto ${idx + 1}:</strong> ${p.enunciado}</p>
                        `;
                    } else {
                        pCard.innerHTML = `
                            <p><strong>Pregunta ${idx + 1}:</strong> ${p.enunciado}</p>
                            <div class="options-grid-view">
                                <div class="option-box-item ${p.respuesta_correcta === 'A' ? 'is-correct' : ''}">A) ${p.opcion_a || ''}</div>
                                <div class="option-box-item ${p.respuesta_correcta === 'B' ? 'is-correct' : ''}">B) ${p.opcion_b || ''}</div>
                                <div class="option-box-item ${p.respuesta_correcta === 'C' ? 'is-correct' : ''}">C) ${p.opcion_c || ''}</div>
                                <div class="option-box-item ${p.respuesta_correcta === 'D' ? 'is-correct' : ''}">D) ${p.opcion_d || ''}</div>
                            </div>
                        `;
                    }
                    modalBodyPoints.appendChild(pCard);
                });
            }
        } catch (err) {
            console.error('Error cargando puntos:', err);
            if (modalBodyPoints) modalBodyPoints.innerHTML = '<p style="text-align:center; color:#E53E3E;">Error al cargar los puntos.</p>';
        }
    }

    [btnCloseModal, btnDoneModal].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', () => {
                if (contentModalOverlay) contentModalOverlay.style.display = 'none';
            });
        }
    });

    cargarCursosCompleto();
});