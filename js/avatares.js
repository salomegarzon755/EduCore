(() => {
    const base = new URL('../img/', document.currentScript.src);
    const nombres = {kokoi:'Kokoi', oso:'Oso de anteojos', serpiente:'Serpiente', guacamaya:'Guacamaya bandera', ballena:'Ballena', perro:'Perro', gato:'Gato', leopardo:'Leopardo', tortuga:'Tortuga'};
    const valido = id => Object.prototype.hasOwnProperty.call(nombres,id);
    const url = id => new URL(id === 'kokoi' || !valido(id) ? 'files/EduCore_Identidad/03_personajes/png/kokoi_saludo.png' : `perfiles/${id}.png`, base).href;
    function imagen(id) { const img = document.createElement('img'); img.src=url(id); img.alt=nombres[id] || 'Kokoi'; return img; }
    function usuario() { try { return JSON.parse(localStorage.getItem('currentUser') || '{}') || {}; } catch { return {}; } }
    function actualizar(id) { const u=usuario(); u.avatar=id; localStorage.setItem('currentUser',JSON.stringify(u)); }
    function galeria(root, inicial, onSelect) {
        let selected = valido(inicial) ? inicial : null;
        const botones = Object.keys(nombres).map(id => {
            const b=document.createElement('button'); b.type='button'; b.className='avatar-opcion';
            b.append(imagen(id)); const label=document.createElement('span'); label.textContent=nombres[id]; b.append(label);
            b.addEventListener('click',()=>{selected=id; pintar(); onSelect(id);}); root.append(b); return [id,b];
        });
        function pintar(){ botones.forEach(([id,b])=>{b.setAttribute('aria-pressed',String(id===selected));}); }
        pintar(); return {get value(){return selected;}};
    }
    function encabezados(){
        const u=usuario(); if(!['Estudiante','Docente'].includes(u.rol) || localStorage.getItem('userRole')==='Padre o Madre') return;
        document.querySelectorAll('.user-avatar, .hu17-header-avatar').forEach(el=>{el.replaceChildren(imagen(u.avatar || 'kokoi')); el.classList.add('hu17-avatar-mini');});
    }
    window.EduAvatares={nombres,url,imagen,galeria,usuario,actualizar,encabezados};
    document.addEventListener('DOMContentLoaded',encabezados);
    window.addEventListener('pageshow',encabezados);
})();
