// HU.28 · Crear actividades interactivas en una unidad (Administrador)
// - En "Ver detalle" de un curso: lista de unidades + "Agregar unidad".
// - "Ver actividades" (?unidad=<id>): actividades de la unidad (estado C del mockup).
// - "Crear actividad" (?unidad=<id>&nueva=1): formulario con texto, imagen de la galería y sonido (voz del navegador).
// Depende de window.EduAdmin (js/adminCursos.js).
document.addEventListener('DOMContentLoaded', () => {
    const A = window.EduAdmin;
    if (!A) return;   // sin sesión de administrador, adminCursos.js ya redirigió al login
    const $ = (id) => document.getElementById(id);
    const { BASE_URL, authHeaders, esc } = A;
    const IMG = '../../img/files/EduCore_Identidad/04_decorativos/png/';
    const GALERIA = [
        ['ave_tuki', 'Ave Tuki'], ['banano', 'Banano'], ['coco', 'Coco'], ['estrella', 'Estrella'], ['flor_coral', 'Flor coral'],
        ['flor_lila', 'Flor lila'], ['flor_rosa', 'Flor rosa'], ['helecho', 'Helecho'], ['hoja_palma', 'Hoja de palma'],
        ['hoja_tropical', 'Hoja tropical'], ['mango', 'Mango'], ['manos', 'Manos'], ['mariposa', 'Mariposa'], ['nube', 'Nube'],
        ['papaya', 'Papaya'], ['piedra', 'Piedra'], ['pina', 'Piña'], ['rana_kokoi', 'Rana Kokoi'], ['sandia', 'Sandía']
    ];
    const nombreImagen = (k) => (GALERIA.find((g) => g[0] === k) || [k, k])[1];

    async function api(path, opciones = {}) {
        const res = await fetch(`${BASE_URL}${path}`, { ...opciones, headers: authHeaders(opciones.body ? { 'Content-Type': 'application/json' } : {}) });
        if (res.status === 401) { A.sesionVencida(); throw new Error('Sesión vencida'); }
        const data = await res.json().catch(() => ({}));
        return { res, data };
    }
    const errorRed = (err) => (err && err.message && err.message !== 'Failed to fetch' ? err.message : 'No se pudo conectar con el servidor. Intenta de nuevo.');

    // ======================= Unidades en el detalle del curso =======================
    let cursoActual = null;
    const unitsList = $('unitsList');
    const unitsStatus = $('unitsStatus');
    const unitForm = $('unitAddForm');
    const unitName = $('unitName');

    function marcarError(campo, contenedor, mensaje, errorEl) {
        if (mensaje) { if (errorEl) errorEl.textContent = mensaje; contenedor.classList.add('has-error'); campo?.setAttribute('aria-invalid', 'true'); }
        else { contenedor.classList.remove('has-error'); campo?.removeAttribute('aria-invalid'); }
    }

    async function cargarUnidades(curso) {
        cursoActual = curso;
        unitsList.innerHTML = '';
        unitsStatus.hidden = false;
        unitsStatus.textContent = 'Cargando unidades…';
        unitForm.reset();
        $('unitAddMsg').hidden = true;
        marcarError(unitName, unitForm.querySelector('.field'), null);
        try {
            const { res, data } = await api(`/admin/cursos/${curso.id_curso}/unidades`);
            if (!res.ok || !data.success) throw new Error(data.message || 'No se pudieron cargar las unidades.');
            pintarUnidades(data.unidades || []);
        } catch (err) {
            unitsStatus.textContent = errorRed(err);
        }
    }

    function pintarUnidades(unidades) {
        unitsStatus.hidden = unidades.length > 0;
        unitsStatus.textContent = unidades.length ? '' : 'Este curso todavía no tiene unidades. Agrega la primera para poder crear actividades.';
        unitsList.innerHTML = unidades.map((u, i) => `
            <li class="unit-row">
                <div class="unit-row-text">
                    <strong>Unidad ${i + 1} · ${esc(u.titulo_unidad)}</strong>
                    <span>${u.total_actividades} ${u.total_actividades === 1 ? 'actividad' : 'actividades'}</span>
                </div>
                <button type="button" class="btn-detalle btn-ver-actividades" data-unidad="${u.id_unidad}">Ver actividades</button>
            </li>`).join('');
    }

    document.addEventListener('educore:detalle-curso', (e) => cargarUnidades(e.detail.curso));

    unitsList.addEventListener('click', (e) => {
        const b = e.target.closest('.btn-ver-actividades');
        if (b) abrirUnidad(b.dataset.unidad);
    });

    unitName.addEventListener('input', () => { if (unitName.value.trim()) marcarError(unitName, unitForm.querySelector('.field'), null); });
    unitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titulo = unitName.value.trim();
        const campo = unitForm.querySelector('.field');
        if (!titulo) { marcarError(unitName, campo, 'Escribe el nombre de la unidad.', $('errorUnidad')); unitName.focus(); return; }
        const btn = $('btnAddUnit');
        btn.disabled = true;
        try {
            $('unitAddMsg').hidden = true;
            const { res, data } = await api(`/admin/cursos/${cursoActual.id_curso}/unidades`, { method: 'POST', body: JSON.stringify({ titulo }) });
            if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo crear la unidad.');
            await cargarUnidades(cursoActual);
            const msg = $('unitAddMsg');
            msg.textContent = `✓ ${data.message}`; msg.hidden = false;
            A.recargarCursos();   // el curso ahora tiene contenido (HU.26 ya no permite eliminarlo)
            unitName.focus();
        } catch (err) {
            A.mostrarBanner('error', errorRed(err));
        } finally {
            btn.disabled = false;
        }
    });

    // ======================= Actividades de la unidad (C) =======================
    const unitView = $('unitView');
    const formView = $('activityFormView');
    let unidadActual = null;
    let nuevaResaltada = null;

    const subtitulo = (u) => `${u.titulo_curso} / Unidad ${u.numero} · ${u.titulo_unidad}`;

    async function cargarUnidad(idUnidad) {
        const { res, data } = await api(`/admin/unidades/${encodeURIComponent(idUnidad)}/actividades`);
        if (res.status === 404) throw Object.assign(new Error(data.message || 'No encontramos esa unidad.'), { noExiste: true });
        if (!res.ok || !data.success) throw new Error(data.message || 'No se pudieron cargar las actividades.');
        unidadActual = data.unidad;
        return unidadActual;
    }

    async function abrirUnidad(idUnidad, { historial = 'push', banner = null } = {}) {
        try {
            const u = await cargarUnidad(idUnidad);
            if (historial === 'push') history.pushState({ unidad: u.id_unidad }, '', `?unidad=${u.id_unidad}`);
            if (historial === 'replace') history.replaceState({ unidad: u.id_unidad }, '', `?unidad=${u.id_unidad}`);
            A.mostrarVista(unitView, { titulo: 'Actividades de la unidad', subtitulo: subtitulo(u), miga: 'Actividades' });
            document.title = `EduCore - ${u.titulo_unidad}`;
            pintarUnidad(u);
            // Aviso arriba de la unidad, como en el mockup (C)
            const aviso = $('unitBanner');
            aviso.hidden = !banner;
            aviso.innerHTML = banner ? `<span aria-hidden="true">✓</span><span>${esc(banner)}</span>` : '';
            window.scrollTo(0, 0);
            $('btnNewActivity').focus({ preventScroll: true });
        } catch (err) {
            if (err.message === 'Sesión vencida') return;
            if (cursoActual) A.abrirDetalle(cursoActual.id_curso, { agregarHistorial: historial === 'push' });
            else { history.replaceState({}, '', window.location.pathname); window.dispatchEvent(new PopStateEvent('popstate')); }
            A.mostrarBanner('error', err.noExiste ? err.message : errorRed(err));
        }
    }

    function imagenCirculo(img, clase = 'activity-img') {
        if (!img || !img.i) return `<span class="${clase} is-empty" aria-hidden="true">🌱</span>`;
        return `<span class="${clase}"><img src="${IMG}${esc(img.i)}.png" alt="${esc(nombreImagen(img.i))}"></span>`;
    }

    function pintarUnidad(u) {
        $('unitCardTitle').textContent = `Unidad ${u.numero} · ${u.titulo_unidad}`;
        const n = u.actividades.length;
        $('unitCount').textContent = `${n} ${n === 1 ? 'actividad disponible' : 'actividades disponibles'}`;
        $('unitNote').hidden = n < 4;
        $('activityEmpty').hidden = n > 0;
        $('activityList').innerHTML = u.actividades.map((a) => {
            const teoria = !a.respuesta_correcta;
            const medios = ['Texto', a.imagen ? `${a.imagen.i}.png${a.imagen.n > 1 ? ' × ' + a.imagen.n : ''}` : null, 'voz'].filter(Boolean).join(' · ');
            const detalle = teoria
                ? `${a.tipo_contenido || 'Teoría'} · ${a.total_preguntas} ${a.total_preguntas === 1 ? 'tarjeta' : 'tarjetas'}`
                : `Respuesta correcta: ${esc(a.respuesta_correcta)} · Pista: ${a.pista ? esc(a.pista) : 'general'}`;
            return `<li class="activity-card${a.id_actividad === nuevaResaltada ? ' is-new' : ''}" data-id="${a.id_actividad}">
                ${imagenCirculo(a.imagen)}
                <div class="activity-text">
                    <h3>${esc(a.titulo_actividad)}</h3>
                    ${a.pregunta ? `<p class="activity-question">${esc(a.pregunta)}</p>` : ''}
                    <p class="activity-meta">${esc(medios)}</p>
                    <p class="activity-meta">${detalle}</p>
                    <button type="button" class="btn-white" disabled title="Editar una actividad estará disponible en la HU.29">Editar actividad</button>
                </div>
            </li>`;
        }).join('');
        nuevaResaltada = null;
    }

    $('btnNewActivity').addEventListener('click', () => abrirFormulario({ historial: 'push' }));
    $('btnBackToCourse').addEventListener('click', () => {
        if (!unidadActual) return;
        A.abrirDetalle(unidadActual.id_curso);
    });

    // ======================= Crear actividad (A / B) =======================
    const form = $('activityForm');
    const banner = $('activityBanner');
    const campos = {
        titulo: { el: $('actTitle'), err: $('errorActTitulo'), etiqueta: 'el título' },
        pregunta: { el: $('actQuestion'), err: $('errorActPregunta'), etiqueta: 'la pregunta' },
        correcta: { el: $('actCorrect'), err: $('errorActCorrecta'), etiqueta: 'la respuesta correcta' },
        otras: { el: $('actOther1'), err: $('errorActOtras'), etiqueta: 'las otras opciones' },
        pista: { el: $('actHint'), err: $('errorActPista'), etiqueta: 'la pista' },
        imagen: { el: $('btnToggleGallery'), err: $('errorActImagen'), etiqueta: 'la imagen' }
    };
    const otrasEls = [$('actOther1'), $('actOther2'), $('actOther3')];
    const galeria = $('mediaGallery');
    let imagenElegida = '';

    galeria.innerHTML = GALERIA.map(([k, nombre]) => `
        <button type="button" class="gallery-item" role="option" aria-selected="false" data-img="${k}" title="${esc(nombre)}">
            <img src="${IMG}${k}.png" alt="${esc(nombre)}">
        </button>`).join('');

    function pintarPrevia() {
        const n = Number($('actQuantity').value) || 1;
        $('mediaPreview').innerHTML = imagenElegida
            ? `<img src="${IMG}${imagenElegida}.png" alt="${esc(nombreImagen(imagenElegida))}">${n > 1 ? `<span class="media-qty-badge">× ${n}</span>` : ''}`
            : '<span class="media-empty">Elige una imagen</span>';
        $('mediaName').textContent = imagenElegida ? `${imagenElegida}.png · Imagen seleccionada` : 'Ninguna imagen seleccionada';
        galeria.querySelectorAll('.gallery-item').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.img === imagenElegida)));
    }
    function mostrarGaleria(visible) {
        galeria.hidden = !visible;
        $('btnToggleGallery').setAttribute('aria-expanded', String(visible));
        $('btnToggleGallery').textContent = visible ? 'Ocultar galería' : (imagenElegida ? 'Cambiar imagen' : 'Elegir imagen');
    }
    galeria.addEventListener('click', (e) => {
        const b = e.target.closest('.gallery-item');
        if (!b) return;
        imagenElegida = b.dataset.img;
        pintarPrevia();
        marcarCampo('imagen', null);
        mostrarGaleria(false);
        $('btnToggleGallery').focus();
    });
    $('btnToggleGallery').addEventListener('click', () => mostrarGaleria(galeria.hidden));
    $('actQuantity').addEventListener('change', pintarPrevia);

    // Sonido: la voz del navegador lee la pregunta (igual que en la actividad del estudiante)
    $('btnPlaySound').addEventListener('click', () => {
        const texto = campos.pregunta.el.value.trim();
        if (!texto) { $('soundNote').textContent = 'Escribe la pregunta para poder escucharla.'; return; }
        if (!('speechSynthesis' in window)) { $('soundNote').textContent = 'Este navegador no tiene voz; el estudiante podrá leer la pregunta.'; return; }
        speechSynthesis.cancel();
        const voz = new SpeechSynthesisUtterance(texto);
        voz.lang = 'es-CO'; voz.rate = 0.85;
        voz.onend = () => { $('soundNote').textContent = 'Audio de la pregunta · voz del navegador'; };
        $('soundNote').textContent = 'Reproduciendo…';
        speechSynthesis.speak(voz);
    });

    function marcarCampo(clave, mensaje) {
        const c = campos[clave];
        marcarError(c.el, c.el.closest('.field'), mensaje, c.err);
        if (clave === 'otras') otrasEls.forEach((el) => (mensaje ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid')));
    }
    function mostrarAvisoForm(texto) { banner.textContent = texto; banner.hidden = !texto; }

    function limpiarFormulario() {
        form.reset();
        imagenElegida = '';
        Object.keys(campos).forEach((k) => marcarCampo(k, null));
        mostrarAvisoForm('');
        pintarPrevia();
        mostrarGaleria(true);
        $('soundNote').textContent = 'La voz del navegador lee la pregunta en voz alta.';
        $('btnSaveActivity').disabled = false;
        $('btnSaveActivity').textContent = 'Guardar actividad';
    }

    function valores() {
        return {
            titulo: campos.titulo.el.value.trim(),
            pregunta: campos.pregunta.el.value.trim(),
            correcta: campos.correcta.el.value.trim(),
            otras: otrasEls.map((el) => el.value.trim()).filter(Boolean),
            pista: campos.pista.el.value.trim(),
            imagen: imagenElegida,
            cantidad: Number($('actQuantity').value) || 1
        };
    }

    // CA-02: indica los campos obligatorios y no crea la actividad
    function validar(v) {
        const e = {};
        if (!v.titulo) e.titulo = 'Escribe el título de la actividad.';
        if (!v.pregunta) e.pregunta = 'Escribe el texto de la pregunta.';
        if (!v.correcta) e.correcta = 'Escribe la respuesta correcta.';
        if (v.otras.length < 2) e.otras = 'Escribe al menos 2 opciones más para que el estudiante elija.';
        else {
            const todas = [v.correcta, ...v.otras].map((x) => x.toLowerCase());
            if (new Set(todas).size !== todas.length) e.otras = 'Las opciones no pueden repetirse ni ser iguales a la respuesta correcta.';
        }
        if (!v.imagen) e.imagen = 'Elige una imagen de la galería.';
        return e;
    }
    function resumen(errores, v) {
        const faltan = ['titulo', 'pregunta', 'correcta', 'otras', 'imagen']
            .filter((k) => errores[k] && (k === 'otras' ? v.otras.length < 2 : k === 'imagen' ? !v.imagen : !v[k]))
            .map((k) => campos[k].etiqueta);
        if (!faltan.length) return 'Revisa los campos marcados para guardar la actividad.';
        return faltan.length === 1 ? `Completa ${faltan[0]}.` : `Completa ${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}.`;
    }
    function aplicarErrores(errores, mensaje) {
        Object.keys(campos).forEach((k) => marcarCampo(k, errores[k] || null));
        mostrarAvisoForm(mensaje);
        const primero = ['titulo', 'pregunta', 'correcta', 'otras', 'pista', 'imagen'].find((k) => errores[k]);
        if (primero === 'imagen') { mostrarGaleria(true); galeria.querySelector('.gallery-item')?.focus(); }
        else if (primero) campos[primero].el.focus();
    }

    // Al corregir un campo se quita su marca
    [...Object.values(campos).map((c) => c.el).filter((el) => el.tagName !== 'BUTTON'), ...otrasEls].forEach((el) => {
        el.addEventListener('input', () => {
            const clave = otrasEls.includes(el) ? 'otras' : Object.keys(campos).find((k) => campos[k].el === el);
            const v = valores();
            const sigue = validar(v)[clave];
            if (!sigue) marcarCampo(clave, null);
            if (!form.querySelector('.field.has-error')) mostrarAvisoForm('');
        });
    });
    campos.pregunta.el.addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; });

    async function abrirFormulario({ historial = 'push' } = {}) {
        if (!unidadActual) return;
        if (historial === 'push') history.pushState({ unidad: unidadActual.id_unidad, nueva: true }, '', `?unidad=${unidadActual.id_unidad}&nueva=1`);
        A.mostrarVista(formView, { titulo: 'Crear actividad interactiva', subtitulo: subtitulo(unidadActual), miga: 'Crear actividad' });
        limpiarFormulario();
        window.scrollTo(0, 0);
        campos.titulo.el.focus({ preventScroll: true });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = valores();
        const errores = validar(v);
        if (Object.keys(errores).length) { aplicarErrores(errores, resumen(errores, v)); return; }
        const btn = $('btnSaveActivity');
        btn.disabled = true; btn.textContent = 'Guardando…';
        mostrarAvisoForm('');
        try {
            const { res, data } = await api(`/admin/unidades/${unidadActual.id_unidad}/actividades`, { method: 'POST', body: JSON.stringify(v) });
            if (res.status === 400 && data.errores) { aplicarErrores(data.errores, data.message); return; }
            if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo crear la actividad.');
            // CA-01: la actividad queda creada y se muestra dentro de la unidad
            nuevaResaltada = data.actividad.id_actividad;
            await abrirUnidad(unidadActual.id_unidad, { historial: 'replace', banner: data.message || 'Actividad creada en la unidad.' });
        } catch (err) {
            if (err.message !== 'Sesión vencida') mostrarAvisoForm(errorRed(err));
        } finally {
            btn.disabled = false; btn.textContent = 'Guardar actividad';
        }
    });

    $('btnCancelActivity').addEventListener('click', () => {
        if (history.state && history.state.nueva) history.back();
        else abrirUnidad(unidadActual.id_unidad, { historial: 'replace' });
    });

    // ======================= Navegación (URL, Atrás / Adelante) =======================
    function desdeUrl() {
        const p = new URLSearchParams(window.location.search);
        const id = p.get('unidad');
        if (!id || !/^\d+$/.test(id)) return false;
        if (p.has('nueva')) {
            const abrir = () => abrirFormulario({ historial: 'none' });
            if (unidadActual && String(unidadActual.id_unidad) === id) abrir();
            else cargarUnidad(id).then(abrir).catch(() => abrirUnidad(id, { historial: 'replace' }));
        } else {
            abrirUnidad(id, { historial: 'none' });
        }
        return true;
    }
    window.addEventListener('popstate', () => { if (new URLSearchParams(window.location.search).has('unidad')) desdeUrl(); });
    desdeUrl();
});
