// Menú compartido de los paneles; no altera la navegación ni la sesión.
(() => {
    const menu = document.getElementById('ecDrawer');
    const button = document.getElementById('ecMenuButton');
    const close = document.getElementById('ecDrawerClose');
    const backdrop = document.getElementById('ecDrawerBackdrop');
    if (!menu || !button || !close || !backdrop) return;
    const mobile = window.matchMedia('(max-width: 900px)');
    let opened = false;
    const focusable = () => [...menu.querySelectorAll('a[href], button:not([disabled])')]
        .filter(el => el.getAttribute('aria-disabled') !== 'true' && el.getClientRects().length);
    function render() {
        menu.classList.toggle('ec-open', opened);
        menu.inert = mobile.matches && !opened;
        if (mobile.matches) menu.setAttribute('aria-hidden', String(!opened));
        else menu.removeAttribute('aria-hidden');
        button.setAttribute('aria-expanded', String(opened));
        backdrop.hidden = !opened;
        document.body.classList.toggle('ec-menu-open', opened);
    }
    function hide(restore = true) {
        if (!opened) return;
        opened = false;
        if (restore && mobile.matches) button.focus();
        render();
    }
    button.addEventListener('click', () => {
        if (opened) return hide();
        if (!mobile.matches) return;
        opened = true;
        render();
        close.focus();
    });
    close.addEventListener('click', () => hide());
    backdrop.addEventListener('click', () => hide());
    menu.addEventListener('click', event => {
        if (event.target.closest('.logout-btn')) hide();
        else if (event.target.closest('a[href]:not([aria-disabled="true"])')) hide(false);
    });
    document.addEventListener('keydown', event => {
        if (!opened) return;
        if (event.key === 'Escape') { event.preventDefault(); hide(); }
        if (event.key !== 'Tab') return;
        const items = focusable();
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (!menu.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
            event.preventDefault(); first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last.focus();
        }
    });
    mobile.addEventListener('change', () => { opened = false; render(); });
    render();
})();
