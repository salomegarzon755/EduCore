document.addEventListener('DOMContentLoaded',async()=>{
 const box=document.getElementById('studentHomeSummary');if(!box)return;
 const user=JSON.parse(localStorage.getItem('currentUser')||'{}');const id=Number(user.id_usuario||user.id);
 if(!id)return;
 try{const r=await fetch(`${window.API_BASE_URL||'http://localhost:5000/api'}/estudiantes/${id}/seguimiento`);const d=await r.json();if(!r.ok||!d.success)throw Error();const acts=d.actividades||[];
 const good=acts.filter(a=>a.estado==='buen_desempeno').length;
 box.innerHTML=`<article class="hu15-stat"><strong>${acts.length}</strong><span>Actividades realizadas</span></article><article class="hu15-stat"><strong>${acts.reduce((n,a)=>n+a.intentos,0)}</strong><span>Intentos</span></article><article class="hu15-stat"><strong>${good}</strong><span>Actividades en verde</span></article>`;
 }catch(e){box.textContent='No se pudo cargar el resumen de actividades.';}
});
