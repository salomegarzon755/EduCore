/* EduCore · Módulo de actividades (HU.09, HU.11, HU.12, HU.13, HU.14, HU.27)
   Sin datos predefinidos: textos, opciones, imágenes, explicaciones y resultados viven en la
   base de datos y llegan por la API (config.js -> API_BASE_URL).
   Endpoints: GET /actividades/:id · GET /actividades/:id/puntos · POST /resultados
   HU.31: al terminar la última actividad pendiente del módulo aparece "Ver resumen del módulo"
          (GET /estudiantes/:id/unidades/:id/resumen, con la sesión del estudiante).          */
(() => {
'use strict';
const API = () => (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '/api');
const IMG = '../../img/files/EduCore_Identidad/';
const asset = (p) => (window.EDUCORE_ASSETS && window.EDUCORE_ASSETS[p]) || IMG + p;   // EDUCORE_ASSETS: solo para la vista previa
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function http(path, opt) {
    const r = await fetch(API() + path, opt);
    const d = await r.json();
    if (!r.ok || d.success === false) throw new Error(d.message || r.status);
    return d;
}
function idEstudiante() {
    try { const u = JSON.parse(localStorage.getItem('currentUser')); return u && (u.id_usuario || u.id); } catch (e) { return null; }
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- Estado ---------- */
const S = { root: null, salir: null, meta: null, puntos: [], view: 'cargando', step: 0, q: 0, pick: null, qs: [], log: [], audio: 'idle', tok: 0, res: null, guardando: false, moduloCompleto: false,
    // HU.27: sel = opción elegida sin comprobar · fase = elegir | pista | ok | revelado · fallos/probadas de la pregunta actual
    sel: null, fase: 'elegir', fallos: 0, probadas: [] };
const MAX_FALLOS = 2;   // tras 2 errores en la misma pregunta se muestra la respuesta correcta
const PISTA_GENERAL = 'Mira bien la imagen y vuelve a contar con calma, uno por uno.';
const PISTA_APOYO = 'Puedes escuchar la pregunta otra vez o contar con tus dedos.';

/* ---------- Audio local (Web Speech) ---------- */
function hablar(texto) {
    const k = ++S.tok;
    if (!('speechSynthesis' in window)) { S.audio = 'na'; return render(); }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto); u.lang = 'es-CO'; u.rate = 0.85;
    u.onend = () => { if (k === S.tok) { S.audio = 'done'; render(); } };
    S.audio = 'play'; speechSynthesis.speak(u); render();
}
const detenerAudio = () => { S.tok++; if ('speechSynthesis' in window) speechSynthesis.cancel(); S.audio = 'idle'; };

/* ============ COMPONENTES ============ */
const Mascota = (pose, msg) => `<div class="mascot"><img src="${asset(`03_personajes/png/kokoi_${pose}.png`)}" alt=""><p class="bubble">${msg}</p></div>`;
const HeaderActivity = (etiqueta, pct) => `<header class="bar"><button class="back" data-a="back">← Mi camino</button><span class="brand">🌱 EduCore</span><span class="chip">${esc(etiqueta)}</span><div class="prog" role="progressbar" aria-valuenow="${Math.round(pct * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct * 100}%"></i></div></header>`;

/* Imágenes del enunciado: tokens {i,n} | {num} | operadores mat_suma/mat_resta/mat_igual (04_decorativos) */
const nombre = (k) => k.replace('mat_', '').replace(/_/g, ' ');
const describir = (ts) => ts.map((t) => t.num != null ? String(t.num) : { mat_suma: 'más', mat_resta: 'menos', mat_igual: 'igual a' }[t.i] || `${t.n || 1} ${nombre(t.i)}`).join(', ');
const imagen = (k, alt) => `<img src="${asset(`04_decorativos/png/${k}.png`)}" alt="${esc(alt)}" onerror="this.outerHTML='<span class=miss>${esc(alt)}</span>'">`;
function Token(t) {
    if (t.num != null) return (t.num >= 1 && t.num <= 3) ? `<span class="grp">${imagen('mat_num' + t.num, t.num)}</span>` : `<span class="pill">${esc(t.num)}</span>`;
    if (/^mat_(suma|resta|igual)$/.test(t.i)) return `<span class="grp op">${imagen(t.i, nombre(t.i))}</span>`;
    const n = t.n || 1;
    if (n > 12) return `<span class="grp big">${imagen(t.i, nombre(t.i))}<b class="x">× ${n}</b></span>`;   // muchas unidades: una imagen + cantidad
    return `<span class="grp">${Array.from({ length: n }, () => imagen(t.i, nombre(t.i))).join('')}</span>`;
}
function Visual(ts, cls = '') {
    if (!Array.isArray(ts) || !ts.length) return '';
    const total = ts.reduce((s, t) => s + (t.i && t.n > 1 && t.n <= 12 ? t.n : 1), 0);
    const sz = total > 16 ? 40 : total > 9 ? 52 : 72;
    return `<div class="vis ${cls}" style="--sz:${sz}px" role="img" aria-label="${esc(describir(ts))}">${ts.map(Token).join('')}</div>`;
}
const AudioBar = (a) => {
    const L = { idle: ['🔊 Escuchar', 'play', 'Audio disponible sin conexión'], play: ['⏸ Pausar', 'pause', 'Reproduciendo…'], paused: ['▶ Reanudar', 'resume', 'En pausa'], done: ['🔊 Escuchar de nuevo', 'play', 'Audio escuchado'], na: ['🔊 Escuchar', 'play', 'Tu navegador no tiene audio'] }[a];
    return `<div class="audio"><button class="btn" data-a="${L[1]}">${L[0]}</button>${a === 'play' ? '<span class="wv" aria-hidden="true"><i></i><i style="animation-delay:.15s"></i><i style="animation-delay:.3s"></i></span>' : ''}<span>${L[2]}</span></div>${a === 'done' ? '<p class="fb ok" role="status">✅ ¡Muy bien! Ya escuchaste la explicación.</p>' : ''}<p class="note">Contenido y audio disponibles sin conexión</p>`;
};
const OptionButton = (o, i, st) => {
    const bloqueada = S.fase === 'ok' || S.fase === 'revelado' || S.fase === 'pista' || S.probadas.includes(i);
    return `<button class="opt c${i} ${st}" data-a="pick" data-i="${i}" ${bloqueada ? 'disabled' : ''} aria-pressed="${S.sel === i}"><span class="ltr">${'ABCD'[i]}</span>${esc(o.t)}<span class="mark">${st === 'ok' || st === 'reveal' ? '✓' : st === 'bad' || st === 'tried' ? '✕' : ''}</span></button>`;
};
const QuestionCard = (q) => `<div class="card"><div class="qcard"><p class="q">${esc(q.t)}</p><button class="btn ghost" data-a="hear">🔊 Escuchar pregunta</button></div>${Visual(q.visual && q.visual.q)}</div>`;
function FeedbackBanner(q) {
    const sol = Visual(q.visual && q.visual.a, 'sol');
    if (q.opinion) return `<p class="fb ok" role="status">💛 ¡Gracias por contarnos cómo te sientes!</p>`;
    const bien = q.o[S.pick].ok, right = q.o.find((o) => o.ok).t;
    return bien
        ? `<div class="fb ok" role="status">🎉 ¡Muy bien! Respuesta correcta.${q.exp ? ' ' + esc(q.exp) : ''}${sol}</div>`
        : `<div class="fb bad" role="status">🌟 ¡Casi! La respuesta correcta es «${esc(right)}». ${esc(q.exp || 'Mira bien la imagen y vuelve a contar con calma.')}${sol}</div>`;
}
/* HU.27 · Retroalimentación con pistas */
function BloquePista(q) {
    return `<div class="hu27-feedback">
        <p class="hu27-aviso hu27-mal" role="status">Aún no. Inténtalo otra vez.</p>
        <div class="hu27-pista-row">
            <div class="hu27-pista" role="note">
                <p class="hu27-pista-titulo">Pista: ${esc(q.pista || PISTA_GENERAL)}</p>
                <p class="hu27-pista-apoyo">${PISTA_APOYO}</p>
            </div>
            <button class="btn" data-a="reintentar">Reintentar</button>
        </div>
    </div>`;
}
function BloqueCorrecto(q) {
    if (q.opinion) return `<p class="fb ok" role="status">💛 ¡Gracias por contarnos cómo te sientes!</p>`;
    return `<div class="hu27-feedback"><p class="hu27-aviso hu27-bien" role="status">¡Correcto!${q.exp ? ' ' + esc(q.exp) : ''}</p>${Visual(q.visual && q.visual.a, 'sol')}</div>`;
}
const ScoreStars = (n) => [1, 2, 3].map((i) => `<span class="star ${i <= n ? 'on' : ''}" style="animation-delay:${i * 0.25}s">⭐</span>`).join('');

/* ============ VISTAS ============ */
function Teoria() {
    const n = S.puntos.length, p = S.puntos[S.step];
    return `${HeaderActivity('Teoría', (S.step + 1) / n)}<main><h2>${esc(S.meta.titulo_actividad)}</h2><p class="sub">${esc(S.meta.titulo_unidad)}</p>
    <div class="lesson-grid"><div class="card">${Visual(p.visual && p.visual.q)}<p class="say">${esc(p.enunciado)}</p></div>${Mascota('explicacion', 'Señala cada cosa mientras contamos.')}</div>
    ${AudioBar(S.audio)}<div class="actions"><button class="btn" data-a="next">${S.step < n - 1 ? 'Continuar' : 'Seguir aprendiendo'} →</button></div></main>`;
}
const Intro = () => `${HeaderActivity('Actividad', 0)}<main class="card center">${Mascota('orientacion', '¡Tú puedes!')}<h2>¡Vamos a practicar!</h2><p class="sub">Observa, cuenta y elige. Puedes escuchar la pregunta las veces que quieras.</p><p><span class="chip">${S.puntos.length} preguntas · A tu ritmo</span></p><button class="btn" data-a="begin">▶ Comenzar</button></main>`;
function Pregunta() {
    const q = S.qs[S.q], n = S.qs.length, terminada = S.fase === 'ok' || S.fase === 'revelado';
    const st = (i) => {
        if (S.fase === 'elegir') return S.probadas.includes(i) ? 'tried' : (S.sel === i ? 'sel' : '');
        if (S.fase === 'pista') return i === S.pick ? 'bad' : (S.probadas.includes(i) ? 'tried' : '');
        if (S.fase === 'ok') return i === S.pick ? 'ok' : 'dim';
        return i === S.pick ? 'bad' : (q.o[i].ok ? 'reveal' : 'dim');   // revelado: se muestra la correcta (HU.14)
    };
    const siguiente = `<button class="btn" data-a="nq">${S.q < n - 1 ? 'Continuar' : 'Ver mi resultado'} →</button>`;
    let abajo = '';
    if (S.fase === 'elegir') {
        abajo = `<p class="hu27-instruccion">${S.sel == null ? 'Selecciona una respuesta y comprueba.' : 'Cuando estés listo, pulsa «Comprobar».'}</p>
            <div class="actions hu27-actions-left"><button class="btn" data-a="comprobar" ${S.sel == null ? 'disabled' : ''}>Comprobar</button></div>`;
    } else if (S.fase === 'pista') {
        abajo = BloquePista(q);
    } else if (S.fase === 'ok') {
        abajo = `${BloqueCorrecto(q)}<div class="hu27-cierre"><p class="hu27-registrada">Tu respuesta quedó registrada.</p>${siguiente}</div>`;
    } else {
        abajo = `${FeedbackBanner(q)}<div class="actions">${siguiente}</div>`;
    }
    return `${HeaderActivity(`Pregunta ${S.q + 1} de ${n}`, (S.q + (terminada ? 1 : 0)) / n)}<main>${QuestionCard(q)}<div class="opts">${q.o.map((o, i) => OptionButton(o, i, st(i))).join('')}</div>${abajo}</main>`;
}
function Fin() {
    const r = S.res;
    if (!r) return `${HeaderActivity('Resultado', 1)}<main class="card center"><p>No pudimos guardar tu resultado. Revisa tu conexión e inténtalo otra vez.</p><button class="btn" data-a="guardar">Guardar de nuevo</button></main>`;
    const msg = ['', '¡Buen intento! Practicando vas a mejorar. 🌱', '¡Muy buen trabajo! Casi lo logras todo. 💪', '¡Eres un explorador increíble! 🌟'][r.estrellas];
    return `${HeaderActivity('Completada', 1)}<main class="card center">${Mascota(r.estrellas === 3 ? 'celebracion' : 'saludo', msg)}<div class="stars" aria-label="${r.estrellas} de 3 estrellas">${ScoreStars(r.estrellas)}</div><h2>${r.aciertos} de ${r.total} correctas</h2><p><span class="light ${r.semaforo}">Tu docente verá: ${{ verde: '🟢', amarillo: '🟡', rojo: '🔴' }[r.semaforo]}</span></p><div class="actions" style="justify-content:center"><button class="btn ghost" data-a="retry">↺ Intentar de nuevo</button><button class="btn" data-a="back">Volver a mi camino</button></div>${S.moduloCompleto ? `<div class="actions hu31-fin" style="justify-content:center"><a class="btn hu31-btn" href="ResumenModulo.html?unidad=${encodeURIComponent(S.meta.id_unidad)}">📋 Ver resumen del módulo</a></div>` : ''}</main>`;
}
const Vistas = { cargando: () => '<p class="card center">Cargando…</p>', teoria: Teoria, intro: Intro, pregunta: Pregunta, fin: Fin, error: () => `<div class="card err"><p>${esc(S.error)}</p><button class="btn" data-a="back">Volver a mi camino</button></div>` };
function render(mantenerScroll) { S.root.innerHTML = Vistas[S.view](); if (!mantenerScroll) window.scrollTo(0, 0); }   // HU.27: elegir/comprobar no saltan arriba

/* ============ LÓGICA ============ */
function armarPreguntas() {
    S.qs = shuffle([...S.puntos]).map((p) => ({
        id: p.id_punto, t: p.enunciado, exp: p.explicacion, pista: p.pista, visual: p.visual, opinion: !!p.es_opinion,
        // La API no garantiza el orden de las opciones: se barajan para que la correcta no sea siempre la misma
        o: shuffle(['A', 'B', 'C', 'D'].map((L) => ({ L, t: p['opcion_' + L.toLowerCase()], ok: p.respuesta_correcta === L }))
            .filter((o) => o.t && o.t !== 'NULL'))
    }));
    S.q = 0; S.log = []; S.res = null; S.moduloCompleto = false; S.view = 'pregunta'; reiniciarPregunta(); render();
}
async function guardar() {
    const aciertos = S.log.filter((r) => r.correcta).length;
    try {
        const d = await http('/resultados', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_estudiante: idEstudiante(), id_actividad: S.meta.id_actividad, aciertos, total: S.log.length, respuestas: S.log }) });
        S.res = d.resultado;
    } catch (e) { S.res = null; }
    S.moduloCompleto = S.res ? await moduloCompleto() : false;
    S.view = 'fin'; render();
}
// HU.31 · ¿Con esta actividad el estudiante terminó todas las del módulo (unidad)?
async function moduloCompleto() {
    if (!S.meta || !S.meta.id_unidad) return false;
    try {
        const r = await fetch(`${API()}/estudiantes/${idEstudiante()}/unidades/${S.meta.id_unidad}/resumen`,
            { headers: { Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` } });
        const d = await r.json();
        return !!(r.ok && d.success && d.resumen && d.resumen.completo && d.resumen.preguntas.length);
    } catch (e) { return false; }
}
const volver = () => { detenerAudio(); S.salir(S.meta); };
function reiniciarPregunta() { S.pick = null; S.sel = null; S.fase = 'elegir'; S.fallos = 0; S.probadas = []; }
const ACCION = {
    back: volver, begin: armarPreguntas, retry: armarPreguntas, guardar,
    hear: () => hablar(S.qs[S.q].t), play: () => hablar(S.puntos[S.step].enunciado),
    pause: () => { speechSynthesis.pause(); S.audio = 'paused'; render(); }, resume: () => { speechSynthesis.resume(); S.audio = 'play'; render(); },
    next: async () => {
        detenerAudio();
        if (S.step < S.puntos.length - 1) { S.step++; return render(); }
        try { await http('/resultados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_estudiante: idEstudiante(), id_actividad: S.meta.id_actividad, aciertos: 0, total: 0, respuestas: [] }) }); } catch (e) { /* el progreso se reintenta al volver */ }
        volver();
    },
    pick: (b) => {
        if (S.fase !== 'elegir') return;
        const i = +b.dataset.i;
        if (S.probadas.includes(i)) return;
        S.sel = i; render(true);
        S.root.querySelector(`[data-a="pick"][data-i="${i}"]`)?.focus();
    },
    // HU.27 · Comprobar: correcta -> se confirma sin pista (CA-02); incorrecta -> pista (CA-01)
    comprobar: () => {
        if (S.fase !== 'elegir' || S.sel == null) return;
        const q = S.qs[S.q], o = q.o[S.sel];
        // El puntaje usa solo el PRIMER intento de cada pregunta; los reintentos son para aprender
        if (!S.log.some((r) => r.id_punto === q.id)) S.log.push({ id_punto: q.id, elegida: o.L, correcta: q.opinion || o.ok });
        S.pick = S.sel; S.sel = null;
        if (q.opinion || o.ok) { S.fase = 'ok'; }
        else {
            S.fallos++; S.probadas.push(S.pick);
            S.fase = S.fallos >= MAX_FALLOS ? 'revelado' : 'pista';
        }
        render(true);
        S.root.querySelector(S.fase === 'pista' ? '[data-a="reintentar"]' : '[data-a="nq"]')?.focus();
    },
    reintentar: () => {
        if (S.fase !== 'pista') return;
        S.fase = 'elegir'; S.pick = null; render(true);
        S.root.querySelector('[data-a="pick"]:not([disabled])')?.focus();
    },
    nq: () => { reiniciarPregunta(); if (S.q < S.qs.length - 1) { S.q++; render(); } else guardar(); }
};

async function abrir(idActividad, { contenedor, alSalir }) {
    S.root = contenedor; S.salir = alSalir; S.view = 'cargando';
    contenedor.onclick = (e) => { const b = e.target.closest('[data-a]'); if (b) ACCION[b.dataset.a](b); };
    render();
    try {
        if (!idEstudiante()) throw new Error('Inicia sesión para jugar.');
        const [m, p] = await Promise.all([http(`/actividades/${idActividad}`), http(`/actividades/${idActividad}/puntos`)]);
        S.meta = m.actividad; S.puntos = p.puntos || [];
        if (!S.puntos.length) throw new Error('Esta actividad todavía no tiene contenido.');
        S.step = 0; S.view = S.puntos.every((x) => !x.opcion_a) ? 'teoria' : 'intro';
    } catch (e) { S.error = e.message.length > 80 ? 'No pudimos cargar la actividad. Revisa que el servidor esté encendido.' : e.message; S.view = 'error'; }
    render();
}
window.EduActividad = { abrir };
})();
