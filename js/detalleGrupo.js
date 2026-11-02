document.addEventListener('DOMContentLoaded', () => {
    
    const BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';

    const urlParams = new URLSearchParams(window.location.search);
    const idGrupo = urlParams.get('id') || urlParams.get('id_grupo');
    const autoOpenModal = urlParams.get('openModal') === 'true';

    if (!idGrupo) {
        alert('No se especificó el ID del grupo.');
        window.location.href = 'MisGrupos.html';
        return;
    }

    let selectedStudentId = null;

    const groupDetailName = document.getElementById('groupDetailName');
    const groupDetailGrade = document.getElementById('groupDetailGrade');
    const groupDetailClassCode = document.getElementById('groupDetailClassCode');
    const studentsGridContainer = document.getElementById('studentsGridContainer');
    const emptyStudentsGroup = document.getElementById('emptyStudentsGroup');
    const alertFeedbackBanner = document.getElementById('alertFeedbackBanner');

    const addStudentModalOverlay = document.getElementById('addStudentModalOverlay');
    const btnOpenAddModal = document.getElementById('btnOpenAddModal');
    const btnCloseAddModal = document.getElementById('btnCloseAddModal');
    const inputSearchStudent = document.getElementById('inputSearchStudent');
    const searchResultsList = document.getElementById('searchResultsList');
    const btnConfirmAddStudent = document.getElementById('btnConfirmAddStudent');

    // 1. Cargar Detalle del Grupo y sus Estudiantes desde el Backend
    async function cargarGrupo() {
        try {
            const res = await fetch(`${BASE_URL}/grupos/${idGrupo}`);
            const data = await res.json();

            if (data.success) {
                const g = data.grupo;
                if (groupDetailName) groupDetailName.textContent = g.nombre_grupo;
                if (groupDetailGrade) {
                    groupDetailGrade.innerHTML = `Grado ${g.grado}.° · <span id="groupDetailStudentCount">${g.total_estudiantes} estudiantes</span>`;
                }
                if (groupDetailClassCode) groupDetailClassCode.textContent = g.codigo_clase;

                renderEstudiantes(g.estudiantes);
            } else {
                alert(data.message || 'No se pudo obtener la información del grupo.');
            }
        } catch (err) {
            console.error('Error cargando grupo:', err);
        }
    }

    function renderEstudiantes(estudiantes) {
        if (!studentsGridContainer) return;
        studentsGridContainer.innerHTML = '';

        if (!estudiantes || estudiantes.length === 0) {
            if (emptyStudentsGroup) emptyStudentsGroup.style.display = 'block';
            studentsGridContainer.style.display = 'none';
        } else {
            if (emptyStudentsGroup) emptyStudentsGroup.style.display = 'none';
            studentsGridContainer.style.display = 'grid';

            estudiantes.forEach(est => {
                const card = document.createElement('div');
                card.className = 'teacher-group-card';
                card.style.padding = '16px';
                card.innerHTML = `
                    <div style="display:flex; align-items:center; gap:12px;">
                        <div style="background:#E2E8F0; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:800; color:#2D3748; font-size:15px;">
                            ${(est.nombre || 'ES').substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h4 style="margin:0; font-size:16px; font-weight:700; color:#2D3748;">${est.nombre}</h4>
                            <p style="margin:2px 0 0 0; color:#718096; font-size:13px;">Usuario: ${est.apodo}</p>
                        </div>
                    </div>
                `;
                studentsGridContainer.appendChild(card);
            });
        }
    }

    // 2. Abrir y Cerrar Modal (HU.06 B)
    if (btnOpenAddModal) {
        btnOpenAddModal.addEventListener('click', () => {
            if (addStudentModalOverlay) addStudentModalOverlay.style.display = 'flex';
            if (inputSearchStudent) inputSearchStudent.value = '';
            selectedStudentId = null;
            if (btnConfirmAddStudent) {
                btnConfirmAddStudent.disabled = true;
                btnConfirmAddStudent.style.opacity = '0.5';
            }
            buscarEstudiantes('');
        });
    }

    if (btnCloseAddModal) {
        btnCloseAddModal.addEventListener('click', () => {
            if (addStudentModalOverlay) addStudentModalOverlay.style.display = 'none';
        });
    }

    if (inputSearchStudent) {
        inputSearchStudent.addEventListener('input', (e) => {
            buscarEstudiantes(e.target.value.trim());
        });
    }

    // 3. Buscar estudiantes evitando duplicados visuales
    async function buscarEstudiantes(texto) {
        try {
            const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/estudiantes/buscar?q=${encodeURIComponent(texto)}`);
            const data = await res.json();

            if (data.success && searchResultsList) {
                searchResultsList.innerHTML = '';
                if (data.estudiantes.length === 0) {
                    searchResultsList.innerHTML = `<p style="color:#718096; font-size:13px; text-align:center; margin:12px 0;">No se encontraron estudiantes para esa búsqueda.</p>`;
                    return;
                }

                data.estudiantes.forEach(est => {
                    const item = document.createElement('div');
                    item.style.cssText = `
                        display: flex; justify-content: space-between; align-items: center;
                        padding: 10px 14px; border: 1px solid #E2E8F0; border-radius: 10px;
                        cursor: ${est.en_grupo ? 'not-allowed' : 'pointer'};
                        background: ${est.en_grupo ? '#EDF2F7' : '#FFFFFF'};
                        transition: background-color 0.15s, border-color 0.15s;
                    `;

                    item.innerHTML = `
                        <div>
                            <strong style="font-size:14px; color:#2D3748;">${est.nombre}</strong>
                            <span style="font-size:12px; color:#718096; display:block;">Usuario: ${est.apodo}</span>
                        </div>
                        ${est.en_grupo ? '<span style="font-size:12px; font-weight:700; color:#A0AEC0;">En el grupo</span>' : ''}
                    `;

                    if (!est.en_grupo) {
                        item.addEventListener('click', () => {
                            document.querySelectorAll('#searchResultsList > div').forEach(el => {
                                el.style.borderColor = '#E2E8F0';
                                el.style.backgroundColor = '#FFFFFF';
                            });
                            item.style.borderColor = '#84CC16';
                            item.style.backgroundColor = '#F7FEE7';
                            selectedStudentId = est.id_estudiante;
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
    }

    // 4. Confirmar inscripción (HU.06 C & D)
    if (btnConfirmAddStudent) {
        btnConfirmAddStudent.addEventListener('click', async () => {
            if (!selectedStudentId) return;

            try {
                const res = await fetch(`${BASE_URL}/grupos/${idGrupo}/estudiantes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id_estudiante: selectedStudentId })
                });

                const data = await res.json();
                if (addStudentModalOverlay) addStudentModalOverlay.style.display = 'none';

                if (res.status === 201 && data.success) {
                    mostrarNotificacion('✓ Estudiante agregado al grupo con éxito', '#DCFCE7', '#166534');
                    cargarGrupo();
                } else if (res.status === 409) {
                    mostrarNotificacion('⚠️ Este estudiante ya forma parte del grupo', '#FEF3C7', '#92400E');
                } else {
                    alert(data.message || 'Error al agregar estudiante.');
                }
            } catch (err) {
                console.error('Error al agregar estudiante:', err);
                alert('Ocurrió un error al intentar comunicar con la API.');
            }
        });
    }

    function mostrarNotificacion(mensaje, bgColor, textColor) {
        if (!alertFeedbackBanner) return;
        alertFeedbackBanner.textContent = mensaje;
        alertFeedbackBanner.style.backgroundColor = bgColor;
        alertFeedbackBanner.style.color = textColor;
        alertFeedbackBanner.style.display = 'block';

        setTimeout(() => {
            alertFeedbackBanner.style.display = 'none';
        }, 4000);
    }

    // Inicializar vista y abrir modal si proviene del flujo de creación de grupo
    cargarGrupo();
    if (autoOpenModal && btnOpenAddModal) {
        btnOpenAddModal.click();
    }
});