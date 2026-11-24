document.addEventListener('DOMContentLoaded', () => {
    const $ = id => document.getElementById(id);
    if (!$('homeDashboard')) return;
    const node = (tag, text, cls) => {
        const el = document.createElement(tag);
        el.textContent = text;
        if (cls) el.className = cls;
        return el;
    };
    function link(text, href) {
        const el = node('a', text, 'home-action');
        el.href = href;
        return el;
    }
    function card(parent, title, detail) {
        const el = node('article', '', 'home-card');
        el.append(node('h3', title), node('p', detail));
        parent.append(el);
        return el;
    }
    async function load() {
        $('homeDashboard').hidden = true;
        $('emptyHomeContainer').hidden = true;
        $('homeRetry').hidden = true;
        $('homeStatus').textContent = 'Cargando tu aventura...';
        try {
            const token = localStorage.getItem('authToken');
            if (!token) throw new Error('Inicia sesión nuevamente.');
            const res = await fetch(`${window.API_BASE_URL}/estudiantes/inicio`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.status === 401 || res.status === 403) throw new Error('Tu sesión no permite consultar el panel. Inicia sesión nuevamente.');
            if (!res.ok) throw new Error('No se pudo consultar tu información académica.');
            const data = await res.json();
            if (!data.success || !Array.isArray(data.grupos) || !Array.isArray(data.cursos)) throw new Error('Respuesta académica inválida.');
            const { grupos, cursos } = data;
            $('homeStatus').textContent = '';
            if (!grupos.length && !cursos.length) {
                $('emptyHomeContainer').hidden = false;
                return;
            }
            const completed = cursos.reduce((n, c) => n + c.completadas, 0);
            const pending = cursos.reduce((n, c) => n + c.pendientes.length, 0);
            for (const id of ['studentHomeSummary', 'homeGroups', 'homeCourses', 'homePending']) $(id).replaceChildren();
            for (const [label, count] of [['Mis grupos', grupos.length], ['Cursos activos', cursos.length], ['Completadas', completed], ['Pendientes', pending]]) {
                const stat = node('article', '', 'home-stat');
                stat.append(node('strong', String(count)), node('span', label));
                $('studentHomeSummary').append(stat);
            }
            for (const g of grupos) card($('homeGroups'), g.nombre, `Grado ${g.grado || 'sin definir'}`).append(link('Ver grupo', `DetalleGrupo.html?id=${g.id_grupo}`));
            for (const c of cursos) {
                const el = card($('homeCourses'), c.titulo, `${c.completadas} de ${c.total} actividades completadas`);
                const progress = document.createElement('progress');
                progress.max = c.total || 1;
                progress.value = c.completadas;
                progress.setAttribute('aria-label', `Progreso de ${c.titulo}`);
                el.append(progress, link('Continuar curso', `MiCamino.html?id_curso=${c.id_curso}`));
                for (const a of c.pendientes) card($('homePending'), a.titulo, c.titulo).append(link('Ver camino', `MiCamino.html?id_curso=${c.id_curso}`));
            }
            if (!grupos.length) $('homeGroups').append(node('p', 'No tienes grupos asignados.'));
            if (!cursos.length) $('homeCourses').append(node('p', 'Tu grupo todavía no tiene cursos asignados.'));
            if (!pending) $('homePending').append(node('p', cursos.length ? 'No tienes actividades pendientes.' : 'Todavía no hay actividades asignadas.'));
            $('homeDashboard').hidden = false;
        } catch (error) {
            $('homeStatus').textContent = error.message || 'No se pudo cargar tu aventura.';
            $('homeRetry').hidden = false;
        }
    }
    $('homeRetry').addEventListener('click', load);
    load();
});
