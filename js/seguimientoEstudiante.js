document.addEventListener('DOMContentLoaded',async()=>{
 const base=window.API_BASE_URL||'http://localhost:5000/api';
 const user=JSON.parse(localStorage.getItem('currentUser')||'{}');const id=Number(user.id_estudiante||user.id_usuario||user.id);
 const list=document.getElementById('studentProgressList'),summary=document.getElementById('studentProgressSummary'),empty=document.getElementById('studentProgressEmpty'),error=document.getElementById('studentProgressError');
 if(!id||!list){if(error)error.hidden=false;return;}
 try{const r=await fetch(`${base}/estudiantes/${id}/seguimiento`);const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||'Error de consulta');const rows=d.actividades||[];empty.hidden=!!rows.length;summary.innerHTML=`<article class="hu15-stat"><strong>${rows.length}</strong><span>Actividades realizadas</span></article><article class="hu15-stat"><strong>${rows.reduce((n,a)=>n+a.intentos,0)}</strong><span>Intentos registrados</span></article>`;list.innerHTML=rows.map(a=>activityCard(a)).join('');}
 catch(err){console.error(err);if(error)error.hidden=false;}
});
