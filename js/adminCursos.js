// HU.23 · Crear curso predefinido (Administrador)
// Vistas: listado de cursos disponibles (C) y formulario "Crear nuevo curso" (A / B).
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
        listView.hidden = false;
        if (trasGuardar) {
            pageTitle.textContent = 'Crear nuevo curso';
            pageSubtitle.textContent = 'Prepara cursos predefinidos para los docentes.';
            breadcrumbState.textContent = 'Curso guardado';
        } else {
            pageTitle.textContent = 'Gestión de cursos';
            pageSubtitle.textContent = 'Consulta los cursos disponibles en EduCore.';
            breadcrumbState.textContent = 'Listado';
        }
    }

    function mostrarFormulario() {
        ocultarBanner();
        limpiarFormulario();
        listView.hidden = true;
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
                    <button type="button" class="btn-detalle" disabled title="El detalle del curso estará disponible en HU.24">Ver detalle</button>
                </td>
                <td class="col-extra">${Number(c.total_grupos) > 0
                    ? '<span class="no-action" title="Asignado a grupos">—</span>'
                    : '<button type="button" class="btn-eliminar" disabled title="Eliminar un curso estará disponible en HU.26">Eliminar</button>'}
                </td>
            </tr>`).join('');

        listEmpty.hidden = n > 0;
        if (n === 0) {
            $('listEmptyTitle').textContent = filtrando ? 'No encontramos cursos' : 'Aún no hay cursos';
            $('listEmptyText').textContent = filtrando
                ? 'Prueba con otro nombre o vuelve a ver todos los cursos.'
                : 'Crea el primer curso predefinido para los docentes.';
        }
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

    mostrarListado();
    cargarCursos();
});
