document.addEventListener('DOMContentLoaded',async()=>{
 const base=window.API_BASE_URL||'http://localhost:5000/api';
 const authHeaders={Authorization:`Bearer ${localStorage.getItem('authToken')||''}`};
 const user=JSON.parse(localStorage.getItem('currentUser')||'{}');const id=Number(user.id_estudiante||user.id_usuario||user.id);
 const list=document.getElementById('familyProgressList'),summary=document.getElementById('familyProgressSummary'),empty=document.getElementById('familyProgressEmpty'),error=document.getElementById('familyProgressError');
 const grupo=Number(localStorage.getItem('familyGroupId'));
 if(!grupo){if(error) {error.hidden=false;error.textContent='Selecciona un grupo desde el ingreso familiar.';}return;}
 if(!id||!list){if(error)error.hidden=false;return;}
 try{const r=await fetch(`${base}/estudiantes/${id}/seguimiento?id_grupo=${grupo}`,{headers:authHeaders});const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||'Error de consulta');const rows=d.actividades||[];empty.hidden=!!rows.length;summary.innerHTML=`<article class="hu15-stat"><strong>${rows.length}</strong><span>Actividades realizadas</span></article><article class="hu15-stat"><strong>${rows.reduce((n,a)=>n+a.intentos,0)}</strong><span>Intentos registrados</span></article>`;list.innerHTML=rows.map(a=>activityCard(a)).join('');}
 catch(err){console.error(err);if(error)error.hidden=false;}
});
