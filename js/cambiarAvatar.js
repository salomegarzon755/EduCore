(() => {
    const $=id=>document.getElementById(id), token=localStorage.getItem('authToken');
    if(!token || localStorage.getItem('userRole')==='Padre o Madre'){location.replace('Login.html');return;}
    const A=EduAvatares; let guardado, seleccionado, ocupado=false;
    const mensaje=(texto,error=false)=>{$('mensaje').textContent=texto;$('mensaje').classList.toggle('error',error);};
    async function api(path,method='GET',body){
        const r=await fetch(window.API_BASE_URL+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
        const d=await r.json(); if(!r.ok || !d.success) throw new Error(d.message || 'No fue posible completar la solicitud.'); return d;
    }
    function vista(id){seleccionado=id;$('preview').src=A.url(id);$('personaje').textContent=A.nombres[id] || 'Kokoi';$('guardar').disabled=ocupado || id===guardado;}
    api('/cuenta').then(d=>{guardado=d.cuenta.avatar || 'kokoi';A.actualizar(guardado);A.galeria($('galeria'),guardado,id=>{vista(id);mensaje('');});vista(guardado);}).catch(e=>mensaje(e.message,true));
    $('guardar').onclick=async()=>{if(ocupado || seleccionado===guardado)return;ocupado=true;const enviado=seleccionado;vista(seleccionado);try{const d=await api('/cuenta/avatar','PATCH',{avatar:enviado});guardado=d.avatar;A.actualizar(guardado);mensaje('✓ ¡Tu nuevo personaje está listo!');}catch(e){mensaje(e.message,true);}finally{ocupado=false;vista(seleccionado);}};
})();
