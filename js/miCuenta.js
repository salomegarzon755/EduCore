(() => {
 const $=id=>document.getElementById(id), token=localStorage.getItem('authToken');
 if(!token){location.replace('Login.html');return;}
 let cuenta, busy=false;
 const fields=['nombre','apellidos'];
 const msg=(text,error=false)=>{$('mensaje').textContent=text;$('mensaje').classList.toggle('error',error);};
 function errors(values={}){fields.forEach(k=>{$('error-'+k).textContent=values[k]||'';$(k).setAttribute('aria-invalid',String(Boolean(values[k])));});}
 function mode(edit){fields.forEach(k=>$(k).readOnly=!edit);$('editar').hidden=edit;$('guardar').hidden=!edit;$('cancelar').hidden=!edit;$('titulo').textContent=edit?'Edita tus datos':'Información personal';$('ayuda').textContent=edit?'Los campos con * son obligatorios.':'Esta es la información registrada en tu cuenta.';}
 function render(){fields.forEach(k=>$(k).value=cuenta[k]??(k==='nombre'?cuenta.nombre_completo:''));$('rol').value=cuenta.rol;$('usuario').textContent=$('perfilNombre').textContent=cuenta.nombre_completo;const home=cuenta.rol==='Docente'?'PanelDocente/PanelPrincipal.html':'PanelEstudiante/Inicio.html';$('inicio').href=$('volver').href=home;}
 async function api(method,body){const r=await fetch(window.API_BASE_URL+'/cuenta',{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok||!d.success)throw d;return d.cuenta;}
 $('editar').onclick=()=>{mode(true);errors();msg(cuenta.apellidos===null?'Confirma tus nombres y apellidos por separado antes de guardar.':'');$('nombre').focus();};
 $('cancelar').onclick=()=>{if(busy)return;render();errors();mode(false);msg('');};
 $('form').onsubmit=async e=>{e.preventDefault();if(busy||$('nombre').readOnly)return;const data=Object.fromEntries(fields.map(k=>[k,$(k).value.trim()]));const invalid={};fields.forEach(k=>{if(!data[k]||data[k].length>100)invalid[k]='Escribe '+(k==='nombre'?'tu nombre':'tus apellidos')+' para guardar los cambios.';});errors(invalid);if(Object.keys(invalid).length){msg('Revisa los campos antes de continuar.',true);$(Object.keys(invalid)[0]).focus();return;}busy=true;$('guardar').disabled=$('cancelar').disabled=true;try{cuenta=await api('PATCH',data);let user=JSON.parse(localStorage.getItem('currentUser')||'{}');user.nombre=cuenta.nombre_completo;localStorage.setItem('currentUser',JSON.stringify(user));localStorage.setItem('loggedUserName',cuenta.nombre_completo);render();mode(false);msg('✓ Tu información se actualizó correctamente.');}catch(err){errors(err.errors);msg(err.message||'No fue posible guardar los cambios.',true);}finally{busy=false;$('guardar').disabled=$('cancelar').disabled=false;}};
 api('GET').then(c=>{cuenta=c;render();$('editar').disabled=false;}).catch(e=>msg(e.message||'No fue posible cargar tu cuenta.',true));
})();
