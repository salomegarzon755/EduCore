// HU.23 · Crear curso predefinido · HU.24 · Ver listado y detalle · HU.26 · Eliminar un curso (Administrador)
// Vistas: listado de cursos disponibles, detalle de un curso (?curso=<id>) y formulario "Crear nuevo curso".
document.addEventListener('DOMContentLoaded', () => {
    const BASE_URL = window.API_BASE_URL || 'http://localhost:5000/api';
    const LOGIN_URL = '../Login.html';

    // ---------- Sesión: solo administradores ----------
    const token = localStorage.getItem('authToken');
    let user = null;
    try { user = JSON.parse(localStorage.getItem('currentUser') || 'null'); } catch (_) { user = null; }
    if (!token || !user || user.rol !== 'Administrador') {
        localStorage.setItem('userRole', 'Administrador');
        window.location.replace(LOGIN_URL);
        return;
    }
    document.getElementById('adminName').textContent = user.nombre || user.usuario || 'Administrador';

    // ---------- Referencias ----------
    const $ = (id) => document.getElementById(id);
    const listView = $('listView');
    const formView = $('formView');
    const detailView = $('detailView');
    const btnClearSearch = $('btnClearSearch');
    const pageTitle = $('pageTitle');
    const pageSubtitle = $('pageSubtitle');
    const breadcrumbState = $('breadcrumbState');
    const banner = $('statusBanner');
    const tbody = $('courseTableBody');
    const listCount = $('listCount');
    const listEmpty = $('listEmpty');
    const searchInput = $('searchCourse');
    const gradeFilter = $('filterGrade');
    const form = $('createCourseForm');
    const btnSave = $('btnSaveCourse');
    const fields = {
        nombre: { input: $('courseName'), error: $('errorNombre'), etiqueta: 'el nombre' },
        grado: { input: $('courseGrade'), error: $('errorGrado'), etiqueta: 'el grado' },
        descripcion: { input: $('courseDescription'), error: $('errorDescripcion'), etiqueta: 'la descripción' }
    };
    const MENSAJES = {
        nombre: 'Escribe el nombre del curso.',
        grado: 'Selecciona el grado del curso.',
        descripcion: 'Escribe la descripción del curso.'
    };

    let cursos = [];
    let idResaltado = null;

    const authHeaders = (extra = {}) => ({ Authorization: `Bearer ${token}`, ...extra });
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const gradoTexto = (g) => (g ? `${g}.°` : '—');

    function sesionVencida() {
        localStorage.removeItem('authToken');
        localStorage.setItem('userRole', 'Administrador');
        window.location.replace(LOGIN_URL);
    }

    // ---------- Banner de estado ----------
    function mostrarBanner(tipo, texto) {
        banner.className = `admin-banner ${tipo}`;
        banner.innerHTML = `<span aria-hidden="true">${tipo === 'error' ? '!' : '✓'}</span><span>${esc(texto)}</span>`;
        banner.hidden = false;
    }
    function ocultarBanner() { banner.hidden = true; banner.textContent = ''; }

    // ---------- Cambio de vista ----------
    function mostrarListado({ trasGuardar = false } = {}) {
        formView.hidden = true;
        detailView.hidden = true;
        listView.hidden = false;
        if (trasGuardar) {
            pageTitle.textContent = 'Crear nuevo curso';
            pageSubtitle.textContent = 'Prepara cursos predefinidos para los docentes.';
            breadcrumbState.textContent = 'Curso guardado';
        } else {
            pageTitle.textContent = 'Gestión de cursos';
            pageSubtitle.textContent = 'Consulta los cursos disponibles en EduCore.';
            actualizarMigaListado();
        }
    }

    // Miga de pan del listado: "Listado" o "Sin resultados" (HU.24 C)
    function actualizarMigaListado() {
        if (listView.hidden || pageTitle.textContent !== 'Gestión de cursos') return;
        const sinResultados = !listEmpty.hidden && Boolean(searchInput.value.trim() || gradeFilter.value);
        breadcrumbState.textContent = sinResultados ? 'Sin resultados' : 'Listado';
    }

    function mostrarFormulario() {
        ocultarBanner();
        limpiarFormulario();
        listView.hidden = true;
        detailView.hidden = true;
        formView.hidden = false;
        pageTitle.textContent = 'Crear nuevo curso';
        pageSubtitle.textContent = 'Prepara cursos predefinidos para los docentes.';
        breadcrumbState.textContent = 'Formulario';
        fields.nombre.input.focus();
    }

    // ---------- Listado ----------
    async function cargarCursos() {
        try {
            const res = await fetch(`${BASE_URL}/admin/cursos`, { headers: authHeaders() });
            if (res.status === 401) return sesionVencida();
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Error al cargar');
            cursos = data.cursos || [];
            renderListado();
        } catch (err) {
            console.error('Error cargando cursos:', err);
            listCount.textContent = 'No se pudo cargar el listado';
            tbody.innerHTML = '';
            listEmpty.hidden = false;
            $('listEmptyTitle').textContent = 'No pudimos conectar con el servidor';
            $('listEmptyText').textContent = 'Revisa tu conexión e intenta de nuevo.';
        }
    }

    function renderListado() {
        const q = normalizar(searchInput.value.trim());
        const g = gradeFilter.value;
        const filtrando = Boolean(q || g);
        const visibles = cursos.filter((c) =>
            (!q || normalizar(c.titulo_curso).includes(q)) && (!g || String(c.grado) === g));

        const n = visibles.length;
        listCount.textContent = filtrando
            ? `${n} ${n === 1 ? 'curso encontrado' : 'cursos encontrados'}`
            : `${n} ${n === 1 ? 'curso disponible' : 'cursos disponibles'}`;

        tbody.innerHTML = visibles.map((c) => `
            <tr data-id="${c.id_curso}" class="${c.id_curso === idResaltado ? 'is-new' : ''}">
                <td class="col-nombre">${esc(c.titulo_curso)}</td>
                <td class="col-grado">${gradoTexto(c.grado)}</td>
                <td class="col-desc">${esc(c.descripcion)}</td>
                <td class="col-acciones">
                    <button type="button" class="btn-detalle" data-id="${c.id_curso}" aria-label="Ver detalle de ${esc(c.titulo_curso)}">Ver detalle</button>
                </td>
                <td class="col-extra">${puedeEliminarse(c)
                    ? `<button type="button" class="btn-eliminar" data-id="${c.id_curso}" aria-label="Eliminar ${esc(c.titulo_curso)}">Eliminar</button>`
                    : `<span class="no-action" title="${esc(motivoNoEliminar(c))}" aria-label="${esc(motivoNoEliminar(c))}">—</span>`}
                </td>
            </tr>`).join('');

        listEmpty.hidden = n > 0;
        if (n === 0) {
            $('listEmptyTitle').textContent = filtrando ? 'No encontramos cursos' : 'Aún no hay cursos';
            $('listEmptyText').textContent = filtrando
                ? 'Prueba con otro nombre o vuelve a ver todos los cursos.'
                : 'Crea el primer curso predefinido para los docentes.';
        }
        btnClearSearch.hidden = !(n === 0 && filtrando);
        actualizarMigaListado();
    }

    // ---------- Eliminar (HU.26) ----------
    // Solo se eliminan cursos sin grupos asignados y sin contenido (para no borrar progreso de estudiantes)
    function puedeEliminarse(c) {
        return Number(c.total_grupos || 0) === 0 && Number(c.total_unidades || 0) === 0;
    }
    function motivoNoEliminar(c) {
        const m = [];
        if (Number(c.total_grupos) > 0) m.push('está asignado a grupos');
        if (Number(c.total_unidades) > 0) m.push('ya tiene contenido');
        return `No se puede eliminar: ${m.join(' y ')}`;
    }

    const deleteOverlay = $('deleteOverlay');
    const btnConfirmDelete = $('btnConfirmDelete');
    const btnCancelDelete = $('btnCancelDelete');
    let cursoAEliminar = null;
    let botonOrigen = null;

    function abrirConfirmacion(idCurso, boton) {
        const c = cursos.find((x) => String(x.id_curso) === String(idCurso));
        if (!c) return;
        cursoAEliminar = c;
        botonOrigen = boton;
        ocultarBanner();
        // El grado va en un bloque que no se parte ("Grado 2.°" nunca queda en dos líneas)
        const grado = document.createElement('span');
        grado.className = 'confirm-grade';
        grado.textContent = c.grado ? `Grado ${c.grado}.°` : 'Grado sin definir';
        $('deleteCourse').replaceChildren(document.createTextNode(`${c.titulo_curso} · `), grado);
        btnConfirmDelete.disabled = false;
        btnConfirmDelete.textContent = 'Eliminar curso';
        deleteOverlay.hidden = false;
        document.body.classList.add('modal-abierto');
        breadcrumbState.textContent = 'Confirmación';
        btnCancelDelete.focus();   // la opción segura queda enfocada
    }

    function cerrarConfirmacion() {
        deleteOverlay.hidden = true;
        document.body.classList.remove('modal-abierto');
        cursoAEliminar = null;
        actualizarMigaListado();
        if (botonOrigen && document.body.contains(botonOrigen)) botonOrigen.focus();
        else searchInput.focus();
        botonOrigen = null;
    }

    async function confirmarEliminacion() {
        if (!cursoAEliminar) return;
        const c = cursoAEliminar;
        btnConfirmDelete.disabled = true;
        btnConfirmDelete.textContent = 'Eliminando…';
        try {
            const res = await fetch(`${BASE_URL}/admin/cursos/${encodeURIComponent(c.id_curso)}`, {
                method: 'DELETE', headers: authHeaders()
            });
            if (res.status === 401) return sesionVencida();
            const data = await res.json().catch(() => ({}));
            cerrarConfirmacion();
            if (res.ok && data.success) {
                // CA-01: el curso sale del listado y se confirma
                cursos = cursos.filter((x) => x.id_curso !== c.id_curso);
                renderListado();
                breadcrumbState.textContent = 'Curso eliminado';
                mostrarBanner('success', data.message || `Se eliminó el curso ${c.titulo_curso}.`);
                searchInput.focus();
                return;
            }
            // 409 (en uso) o 404 (ya no existe): se avisa y se recarga el listado real
            mostrarBanner('error', data.message || 'No se pudo eliminar el curso. Intenta de nuevo.');
            await cargarCursos();
        } catch (err) {
            console.error('Error eliminando curso:', err);
            cerrarConfirmacion();
            mostrarBanner('error', 'No se pudo conectar con el servidor. Intenta de nuevo.');
        }
    }

    // ---------- Detalle (HU.24 B) ----------
    const gradoDetalle = (g) => (g ? `Grado ${g}.° de primaria` : 'Grado sin definir');
    const urlListado = () => window.location.pathname;

    async function abrirDetalle(idCurso, { agregarHistorial = true } = {}) {
        ocultarBanner();
        listView.hidden = true;
        formView.hidden = true;
        detailView.hidden = false;
        pageTitle.textContent = 'Gestión de cursos';
        pageSubtitle.textContent = 'Consulta los cursos disponibles en EduCore.';
        breadcrumbState.textContent = 'Detalle';
        $('detailTitle').textContent = 'Cargando curso…';
        $('detailGrade').textContent = '';
        $('detailDescription').textContent = '';
        if (agregarHistorial) history.pushState({ curso: idCurso }, '', `?curso=${idCurso}`);

        try {
            const res = await fetch(`${BASE_URL}/admin/cursos/${encodeURIComponent(idCurso)}`, { headers: authHeaders() });
            if (res.status === 401) return sesionVencida();
            const data = await res.json();
            if (res.status === 404) {
                volverAlListado({ reemplazar: true });
                mostrarBanner('error', data.message || 'No encontramos ese curso.');
                return;
            }
            if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo cargar el curso.');
            const c = data.curso;
            $('detailTitle').textContent = c.titulo_curso;
            $('detailGrade').textContent = gradoDetalle(c.grado);
            $('detailDescription').textContent = c.descripcion || 'Este curso no tiene descripción.';
            document.title = `EduCore - ${c.titulo_curso}`;
            $('btnBackToList').focus();
        } catch (err) {
            console.error('Error cargando el detalle:', err);
            volverAlListado({ reemplazar: true });
            mostrarBanner('error', err.message && err.message !== 'Failed to fetch'
                ? err.message : 'No se pudo conectar con el servidor. Intenta de nuevo.');
        }
    }

    function volverAlListado({ reemplazar = false } = {}) {
        document.title = 'EduCore - Gestión de cursos';
        if (reemplazar) history.replaceState({}, '', urlListado());
        else if (history.state && history.state.curso) history.back();   // vuelve a la entrada anterior
        else history.pushState({}, '', urlListado());
        mostrarListado();
    }

    function idCursoDeUrl() {
        const id = new URLSearchParams(window.location.search).get('curso');
        return id && /^\d+$/.test(id) ? id : null;
    }

    // ---------- Formulario ----------
    function limpiarFormulario() {
        form.reset();
        Object.keys(fields).forEach((k) => marcarCampo(k, null));
        btnSave.disabled = false;
        btnSave.textContent = 'Guardar curso';
    }

    function marcarCampo(clave, mensaje) {
        const f = fields[clave];
        const contenedor = f.input.closest('.field');
        if (mensaje) {
            f.error.textContent = mensaje;
            contenedor.classList.add('has-error');
            f.input.setAttribute('aria-invalid', 'true');
        } else {
            contenedor.classList.remove('has-error');
            f.input.removeAttribute('aria-invalid');
        }
    }

    function mensajeResumen(faltantes) {
        const etiquetas = faltantes.map((k) => fields[k].etiqueta);
        if (etiquetas.length === 1) return `Falta ${etiquetas[0]}. Completa el campo para guardar.`;
        return `Faltan ${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}. Completa los campos para guardar.`;
    }

    function aplicarErrores(errores, mensajeServidor) {
        Object.keys(fields).forEach((k) => marcarCampo(k, errores[k] || null));
        const faltantes = Object.keys(fields).filter((k) => errores[k] && !fields[k].input.value.trim());
        mostrarBanner('error', faltantes.length ? mensajeResumen(faltantes)
            : (mensajeServidor || 'Revisa los campos marcados para guardar el curso.'));
        const primero = Object.keys(fields).find((k) => errores[k]);
        if (primero) fields[primero].input.focus();
    }

    function validar() {
        const errores = {};
        Object.keys(fields).forEach((k) => {
            if (!fields[k].input.value.trim()) errores[k] = MENSAJES[k];
        });
        return errores;
    }

    // Al corregir un campo se quita su marca de error
    Object.keys(fields).forEach((k) => {
        const evento = fields[k].input.tagName === 'SELECT' ? 'change' : 'input';
        fields[k].input.addEventListener(evento, () => {
            if (fields[k].input.value.trim()) marcarCampo(k, null);
            if (!form.querySelector('.field.has-error')) ocultarBanner();
        });
    });

    // Autoajuste de altura de la descripción
    fields.descripcion.input.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = `${e.target.scrollHeight}px`;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errores = validar();
        if (Object.keys(errores).length) {
            aplicarErrores(errores);          // CA-02: indica obligatorios y NO guarda
            return;
        }

        const payload = {
            nombre: fields.nombre.input.value.trim(),
            grado: Number(fields.grado.input.value),
            descripcion: fields.descripcion.input.value.trim()
        };

        btnSave.disabled = true;
        btnSave.textContent = 'Guardando…';
        ocultarBanner();
        try {
            const res = await fetch(`${BASE_URL}/admin/cursos`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload)
            });
            if (res.status === 401) return sesionVencida();
            const data = await res.json();

            if (res.status === 400 && data.errores) {
                aplicarErrores(data.errores, data.message);
                return;
            }
            if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo guardar el curso.');

            // CA-01: el curso queda registrado y aparece en el listado de cursos disponibles
            idResaltado = data.curso.id_curso;
            history.replaceState({}, '', urlListado());
            searchInput.value = '';
            gradeFilter.value = '';
            await cargarCursos();
            mostrarListado({ trasGuardar: true });
            mostrarBanner('success', `${data.curso.titulo_curso} se guardó correctamente.`);
            limpiarFormulario();
        } catch (err) {
            console.error('Error guardando curso:', err);
            mostrarBanner('error', err.message && err.message !== 'Failed to fetch'
                ? err.message : 'No se pudo conectar con el servidor. Intenta de nuevo.');
        } finally {
            btnSave.disabled = false;
            btnSave.textContent = 'Guardar curso';
        }
    });

    // ---------- Eventos ----------
    $('btnShowCreate').addEventListener('click', mostrarFormulario);
    $('btnCancelCourse').addEventListener('click', () => {
        limpiarFormulario();
        ocultarBanner();
        mostrarListado();
    });
    searchInput.addEventListener('input', renderListado);
    gradeFilter.addEventListener('change', renderListado);

    // HU.24 · Ver detalle, volver y limpiar búsqueda
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-detalle');
        if (btn) { abrirDetalle(btn.dataset.id); return; }
        const del = e.target.closest('.btn-eliminar');
        if (del) abrirConfirmacion(del.dataset.id, del);
    });
    // HU.26 · CA-02: Cancelar (botón, Esc o clic fuera) deja el curso disponible
    btnCancelDelete.addEventListener('click', cerrarConfirmacion);
    btnConfirmDelete.addEventListener('click', confirmarEliminacion);
    deleteOverlay.addEventListener('click', (e) => { if (e.target === deleteOverlay) cerrarConfirmacion(); });
    document.addEventListener('keydown', (e) => {
        if (deleteOverlay.hidden) return;
        if (e.key === 'Escape') { e.preventDefault(); cerrarConfirmacion(); return; }
        if (e.key === 'Tab') {   // el foco se queda dentro de la confirmación
            const items = [btnCancelDelete, btnConfirmDelete].filter((b) => !b.disabled);
            const i = items.indexOf(document.activeElement);
            e.preventDefault();
            items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
        }
    });
    $('btnBackToList').addEventListener('click', () => volverAlListado());
    btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        gradeFilter.value = '';
        renderListado();
        searchInput.focus();
    });
    // Botones Atrás / Adelante del navegador
    window.addEventListener('popstate', () => {
        const id = idCursoDeUrl();
        if (id) abrirDetalle(id, { agregarHistorial: false });
        else { document.title = 'EduCore - Gestión de cursos'; ocultarBanner(); mostrarListado(); }
    });

    cargarCursos();
    const idInicial = idCursoDeUrl();
    if (idInicial) abrirDetalle(idInicial, { agregarHistorial: false });
    else mostrarListado();
});
