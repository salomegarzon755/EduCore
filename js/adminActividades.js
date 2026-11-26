// HU.28 · Crear actividades interactivas en una unidad · HU.29 · Editar el contenido de una actividad (Administrador)
// - En "Ver detalle" de un curso: lista de unidades + "Agregar unidad".
// - "Ver actividades" (?unidad=<id>): actividades de la unidad (estado C del mockup).
// - "Crear actividad" (?unidad=<id>&nueva=1): formulario con texto, imagen de la galería y sonido (voz del navegador).
// - "Editar actividad" (?unidad=<id>&editar=<idActividad>): el mismo formulario con el título y una de sus preguntas.
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

    async function abrirUnidad(idUnidad, { historial = 'push', banner = null, titulo = 'Actividades de la unidad' } = {}) {
        try {
            const u = await cargarUnidad(idUnidad);
            if (historial === 'push') history.pushState({ unidad: u.id_unidad }, '', `?unidad=${u.id_unidad}`);
            if (historial === 'replace') history.replaceState({ unidad: u.id_unidad }, '', `?unidad=${u.id_unidad}`);
            A.mostrarVista(unitView, { titulo, subtitulo: subtitulo(u), miga: titulo === 'Actividades de la unidad' ? 'Actividades' : titulo });
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
                    <button type="button" class="btn-white btn-editar-actividad" data-editar="${a.id_actividad}" aria-label="Editar ${esc(a.titulo_actividad)}">Editar actividad</button>
                </div>
            </li>`;
        }).join('');
        nuevaResaltada = null;
    }

    $('btnNewActivity').addEventListener('click', () => abrirFormulario({ historial: 'push' }));
    $('activityList').addEventListener('click', (e) => {
        const b = e.target.closest('.btn-editar-actividad');
        if (b) abrirEdicion(b.dataset.editar, { historial: 'push' });
    });
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
    // HU.29 · estado del modo editar
    let modo = 'crear';            // 'crear' | 'editar'
    let actEdit = null;            // actividad cargada (título + preguntas)
    let idxPregunta = 0;
    let tipoActual = 'pregunta';   // 'pregunta' | 'opinion' | 'teoria'
    let imagenCambiada = false;    // la imagen solo se envía si se elige una nueva
    let instantanea = '';          // para saber si hay cambios sin guardar

    galeria.innerHTML = GALERIA.map(([k, nombre]) => `
        <button type="button" class="gallery-item" role="option" aria-selected="false" data-img="${k}" title="${esc(nombre)}">
            <img src="${IMG}${k}.png" alt="${esc(nombre)}">
        </button>`).join('');

    function pintarPrevia() {
        const n = Number($('actQuantity').value) || 1;
        const p = modo === 'editar' && actEdit ? actEdit.preguntas[idxPregunta] : null;
        const compuesta = p && !imagenElegida && p.tiene_visual;   // imagen con varias partes (p. ej. 8 estrellas + 2)
        $('mediaPreview').innerHTML = imagenElegida
            ? `<img src="${IMG}${imagenElegida}.png" alt="${esc(nombreImagen(imagenElegida))}">${n > 1 ? `<span class="media-qty-badge">× ${n}</span>` : ''}`
            : compuesta ? '<span class="media-current">Imagen actual</span>'
            : `<span class="media-empty">${modo === 'editar' ? 'Sin imagen' : 'Elige una imagen'}</span>`;
        $('mediaName').textContent = imagenElegida ? `${imagenElegida}.png · Imagen seleccionada`
            : compuesta ? 'Imagen compuesta actual · se conserva si no la cambias'
            : (modo === 'editar' ? 'Esta pregunta no tiene imagen' : 'Ninguna imagen seleccionada');
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
        imagenCambiada = true;
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

    // HU.29 · ajusta el formulario al tipo de pregunta
    function configurarTipo(tipo) {
        tipoActual = tipo;
        const esPregunta = tipo === 'pregunta', esOpinion = tipo === 'opinion';
        $('fieldCorrect').hidden = !(esPregunta || esOpinion);
        $('fieldOptions').hidden = !(esPregunta || esOpinion);
        $('fieldHint').hidden = !esPregunta;
        $('actQuestionLabel').textContent = tipo === 'teoria' ? 'Texto de la tarjeta *' : 'Texto sencillo de la pregunta *';
        $('actCorrectLabel').textContent = esOpinion ? 'Opción 1 *' : 'Respuesta correcta *';
        $('actOptionsLegend').innerHTML = esOpinion ? 'Más opciones * <span>(mínimo 2 en total)</span>' : 'Otras opciones para elegir * <span>(mínimo 2)</span>';
        $('actOther1Label').textContent = esOpinion ? 'Opción 2 *' : 'Opción 2 *';
        $('actOther2Label').textContent = esOpinion ? 'Opción 3 (opcional)' : 'Opción 3 *';
        $('actOther3Label').textContent = 'Opción 4 (opcional)';
        $('questionType').textContent = tipo === 'teoria' ? 'Tarjeta de teoría: solo tiene texto (y su imagen).'
            : esOpinion ? 'Encuesta de opinión: no tiene respuesta correcta ni pista.' : 'Pregunta con respuesta correcta.';
    }

    function limpiarFormulario() {
        form.reset();
        imagenElegida = '';
        imagenCambiada = false;
        if (modo === 'crear') { configurarTipo('pregunta'); $('questionPicker').hidden = true; }
        $('mediaFoot').textContent = modo === 'editar' ? 'Los cambios se guardan en la actividad.' : 'Se guardará dentro de la unidad.';
        Object.keys(campos).forEach((k) => marcarCampo(k, null));
        mostrarAvisoForm('');
        pintarPrevia();
        mostrarGaleria(true);
        $('soundNote').textContent = 'La voz del navegador lee la pregunta en voz alta.';
        $('btnSaveActivity').disabled = false;
        $('btnSaveActivity').textContent = modo === 'editar' ? 'Guardar cambios' : 'Guardar actividad';
    }

    function valores() {
        const v = {
            titulo: campos.titulo.el.value.trim(),
            pregunta: campos.pregunta.el.value.trim(),
            correcta: campos.correcta.el.value.trim(),
            otras: otrasEls.map((el) => el.value.trim()).filter(Boolean),
            pista: campos.pista.el.value.trim(),
            imagen: imagenElegida,
            cantidad: Number($('actQuantity').value) || 1
        };
        if (tipoActual === 'opinion') { v.otras = [v.correcta, ...v.otras].filter(Boolean); v.correcta = ''; v.pista = ''; }
        if (tipoActual === 'teoria') { v.correcta = ''; v.otras = []; v.pista = ''; }
        return v;
    }

    // CA-02: indica los campos obligatorios y no crea la actividad
    function validar(v) {
        const e = {};
        if (!v.titulo) e.titulo = 'Escribe el título de la actividad.';
        if (!v.pregunta) e.pregunta = tipoActual === 'teoria' ? 'Escribe el texto de la tarjeta.' : 'Escribe el texto de la pregunta.';
        if (tipoActual === 'pregunta') {
            if (!v.correcta) e.correcta = 'Escribe la respuesta correcta.';
            if (v.otras.length < 2) e.otras = 'Escribe al menos 2 opciones más para que el estudiante elija.';
            else {
                const todas = [v.correcta, ...v.otras].map((x) => x.toLowerCase());
                if (new Set(todas).size !== todas.length) e.otras = 'Las opciones no pueden repetirse ni ser iguales a la respuesta correcta.';
            }
        } else if (tipoActual === 'opinion') {
            if (v.otras.length < 2) e.otras = 'Escribe al menos 2 opciones.';
            else if (new Set(v.otras.map((x) => x.toLowerCase())).size !== v.otras.length) e.otras = 'Las opciones no pueden repetirse.';
        }
        if (modo === 'crear' && !v.imagen) e.imagen = 'Elige una imagen de la galería.';   // al editar, la imagen actual se conserva
        return e;
    }
    // HU.29 (CA-02): mensajes como el mockup, p. ej. "Texto vacío. No se guardaron cambios."
    function resumenEdicion(errores, v) {
        const vacios = { titulo: 'Título vacío', pregunta: 'Texto vacío', correcta: 'Respuesta vacía', otras: 'Faltan opciones' };
        const faltan = Object.keys(vacios).filter((k) => errores[k] && (k === 'otras' ? v.otras.length < 2 : !v[k]));
        if (faltan.length === 1) return `${vacios[faltan[0]]}. No se guardaron cambios.`;
        if (faltan.length > 1) return 'Hay campos vacíos. No se guardaron cambios.';
        return 'Contenido inválido. No se guardaron cambios.';
    }
    function resumen(errores, v) {
        if (modo === 'editar') return resumenEdicion(errores, v);
        const faltan = ['titulo', 'pregunta', 'correcta', 'otras', 'imagen']
            .filter((k) => errores[k] && (k === 'otras' ? v.otras.length < 2 : k === 'imagen' ? !v.imagen : !v[k]))
            .map((k) => campos[k].etiqueta);
        if (!faltan.length) return 'Revisa los campos marcados para guardar la actividad.';
        return faltan.length === 1 ? `Completa ${faltan[0]}.` : `Completa ${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}.`;
    }
    function aplicarErrores(errores, mensaje) {
        if (errores.enunciado && !errores.pregunta) errores = { ...errores, pregunta: errores.enunciado };   // nombre del servidor (HU.29)
        Object.keys(campos).forEach((k) => marcarCampo(k, errores[k] || null));
        mostrarAvisoForm(mensaje);
        if (modo === 'editar') $('mediaFoot').textContent = 'Se conserva la versión anterior.';
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
        modo = 'crear'; actEdit = null;
        if (historial === 'push') history.pushState({ unidad: unidadActual.id_unidad, nueva: true }, '', `?unidad=${unidadActual.id_unidad}&nueva=1`);
        A.mostrarVista(formView, { titulo: 'Crear actividad interactiva', subtitulo: subtitulo(unidadActual), miga: 'Crear actividad' });
        limpiarFormulario();
        window.scrollTo(0, 0);
        campos.titulo.el.focus({ preventScroll: true });
    }

    // ======================= Editar actividad (HU.29 A / B / C) =======================
    const select = $('actQuestionSelect');
    const resumenPregunta = (p, i) => {
        const tipo = p.tipo === 'teoria' ? 'Teoría' : p.tipo === 'opinion' ? 'Opinión' : 'Pregunta';
        const texto = p.enunciado.length > 60 ? p.enunciado.slice(0, 57) + '…' : p.enunciado;
        return `${i + 1} de ${actEdit.preguntas.length} · ${tipo}: ${texto}`;
    };

    function cargarPregunta(i) {
        idxPregunta = i;
        const p = actEdit.preguntas[i];
        limpiarFormulario();
        configurarTipo(p.tipo);
        campos.titulo.el.value = actEdit.titulo_actividad;
        campos.pregunta.el.value = p.enunciado || '';
        if (p.tipo === 'pregunta') {
            campos.correcta.el.value = p.correcta || '';
            otrasEls.forEach((el, k) => { el.value = p.otras[k] || ''; });
            campos.pista.el.value = p.pista || '';
        } else if (p.tipo === 'opinion') {
            campos.correcta.el.value = p.otras[0] || '';
            otrasEls.forEach((el, k) => { el.value = p.otras[k + 1] || ''; });
        }
        imagenElegida = p.imagen ? p.imagen.i : '';
        $('actQuantity').value = String(p.imagen ? Math.min(Math.max(p.imagen.n || 1, 1), 12) : 1);
        imagenCambiada = false;
        pintarPrevia();
        mostrarGaleria(false);
        campos.pregunta.el.dispatchEvent(new Event('input'));   // ajusta la altura del texto
        Object.keys(campos).forEach((k) => marcarCampo(k, null));
        mostrarAvisoForm('');
        select.value = String(i);
        instantanea = JSON.stringify(valores());
    }
    const hayCambios = () => modo === 'editar' && (imagenCambiada || JSON.stringify(valores()) !== instantanea);

    async function abrirEdicion(idActividad, { historial = 'push', pregunta = 0 } = {}) {
        try {
            const { res, data } = await api(`/admin/actividades/${encodeURIComponent(idActividad)}`);
            if (res.status === 404) throw Object.assign(new Error(data.message || 'No encontramos esa actividad.'), { noExiste: true });
            if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo cargar la actividad.');
            actEdit = data.actividad;
            if (!actEdit.preguntas.length) throw new Error('Esta actividad no tiene contenido para editar.');
            if (!unidadActual || unidadActual.id_unidad !== actEdit.id_unidad) await cargarUnidad(actEdit.id_unidad);
            modo = 'editar';
            const url = `?unidad=${actEdit.id_unidad}&editar=${actEdit.id_actividad}`;
            if (historial === 'push') history.pushState({ unidad: actEdit.id_unidad, editar: actEdit.id_actividad }, '', url);
            if (historial === 'replace') history.replaceState({ unidad: actEdit.id_unidad, editar: actEdit.id_actividad }, '', url);
            A.mostrarVista(formView, { titulo: 'Editar actividad', subtitulo: subtitulo(unidadActual), miga: 'Editar actividad' });
            document.title = `EduCore - Editar ${actEdit.titulo_actividad}`;
            select.innerHTML = actEdit.preguntas.map((p, i) => `<option value="${i}">${esc(resumenPregunta(p, i))}</option>`).join('');
            $('questionPicker').hidden = actEdit.preguntas.length < 2;
            cargarPregunta(Math.min(pregunta, actEdit.preguntas.length - 1));
            window.scrollTo(0, 0);
            campos.titulo.el.focus({ preventScroll: true });
        } catch (err) {
            if (err.message === 'Sesión vencida') return;
            modo = 'crear';
            if (unidadActual) abrirUnidad(unidadActual.id_unidad, { historial: 'replace' });
            A.mostrarBanner('error', err.noExiste ? err.message : errorRed(err));
        }
    }

    select.addEventListener('change', () => {
        const nueva = Number(select.value);
        if (hayCambios() && !window.confirm('Tienes cambios sin guardar en esta pregunta. ¿Quieres descartarlos y cambiar de pregunta?')) {
            select.value = String(idxPregunta);
            return;
        }
        cargarPregunta(nueva);
    });

    async function guardarEdicion(v) {
        const p = actEdit.preguntas[idxPregunta];
        const cuerpo = { titulo: v.titulo, id_punto: p.id_punto, enunciado: v.pregunta, correcta: v.correcta,
                         otras: v.otras, pista: v.pista, cantidad: v.cantidad };
        if (imagenCambiada && v.imagen) cuerpo.imagen = v.imagen;
        else if (p.imagen && Number($('actQuantity').value) !== (p.imagen.n || 1)) { cuerpo.imagen = p.imagen.i; }   // cambió solo la cantidad
        const { res, data } = await api(`/admin/actividades/${actEdit.id_actividad}`, { method: 'PUT', body: JSON.stringify(cuerpo) });
        if (res.status === 400 && data.errores) { aplicarErrores(data.errores, data.message); return; }
        if (!res.ok || !data.success) throw new Error(data.message || 'No se pudieron guardar los cambios. Se conserva la versión anterior.');
        // CA-01: los cambios quedan guardados y se muestran en la actividad (mockup C)
        nuevaResaltada = actEdit.id_actividad;
        const idUnidad = actEdit.id_unidad;
        modo = 'crear'; actEdit = null;
        await abrirUnidad(idUnidad, { historial: 'replace', banner: data.message || 'Cambios guardados.', titulo: 'Actividad actualizada' });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = valores();
        const errores = validar(v);
        if (Object.keys(errores).length) { aplicarErrores(errores, resumen(errores, v)); return; }
        const btn = $('btnSaveActivity');
        const textoBoton = btn.textContent;
        btn.disabled = true; btn.textContent = 'Guardando…';
        mostrarAvisoForm('');
        if (modo === 'editar') {
            try { await guardarEdicion(v); }
            catch (err) {
                if (err.message !== 'Sesión vencida') { mostrarAvisoForm(errorRed(err)); $('mediaFoot').textContent = 'Se conserva la versión anterior.'; }
            } finally { btn.disabled = false; btn.textContent = textoBoton; }
            return;
        }
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
        modo = 'crear'; actEdit = null;
        if (history.state && (history.state.nueva || history.state.editar)) history.back();
        else abrirUnidad(unidadActual.id_unidad, { historial: 'replace' });
    });

    // ======================= Navegación (URL, Atrás / Adelante) =======================
    function desdeUrl() {
        const p = new URLSearchParams(window.location.search);
        const id = p.get('unidad');
        if (!id || !/^\d+$/.test(id)) return false;
        const editar = p.get('editar');
        if (editar && /^\d+$/.test(editar)) {
            abrirEdicion(editar, { historial: 'none' });
        } else if (p.has('nueva')) {
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
