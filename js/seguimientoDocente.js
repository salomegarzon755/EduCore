document.addEventListener('DOMContentLoaded', async()=>{
 const base=window.API_BASE_URL||'http://localhost:5000/api';
 const authHeaders={Authorization:`Bearer ${localStorage.getItem('authToken')||''}`};
 const user=JSON.parse(localStorage.getItem('currentUser')||'{}');const id=Number(user.id_usuario||user.id);
 const list=document.getElementById('teacherFollowupList'), summary=document.getElementById('teacherFollowupSummary'),empty=document.getElementById('teacherFollowupEmpty');
 if(!id||!list)return;
 try {
  const response=await fetch(`${base}/docentes/${id}/seguimiento`,{headers:authHeaders});const data=await response.json();if(!response.ok||!data.success)throw Error(data.message||'Error de consulta');
  const rows=data.estudiantes||[];empty.hidden=!!rows.length;
  const active=rows.filter(x=>x.actividades>0).length;
  summary.innerHTML=`<article class="hu15-stat"><strong>${rows.length}</strong><span>Total estudiantes</span></article><article class="hu15-stat"><strong>${active}</strong><span>Con actividades</span></article><article class="hu15-stat"><strong>${rows.length-active}</strong><span>Pendientes</span></article>`;
  list.innerHTML=rows.map(x=>`<section class="hu15-student"><div class="hu15-card-head"><div><h2>${esc(x.nombre)}</h2><p>${esc(x.grupo)} · ${esc(x.grado)}</p></div><strong>${x.actividades} actividad(es)</strong></div>${x.resultados.length?`<div class="hu15-nested">${x.resultados.map(a=>activityCard(a,true,x.id_estudiante,x.id_grupo)).join('')}</div>`:'<p>Aún no tiene actividades registradas.</p>'}</section>`).join('');
 } catch(err){console.error(err);empty.hidden=false;empty.querySelector('.empty-state-title').textContent='No se pudo cargar el seguimiento';}
 list.addEventListener('click',async e=>{const btn=e.target.closest('[data-save]');if(!btn)return;
  const area=btn.parentElement.querySelector('[data-comment]');btn.disabled=true;btn.textContent='Guardando...';
  try{const r=await fetch(`${base}/docentes/${id}/seguimiento`,{method:'PUT',headers:{'Content-Type':'application/json',...authHeaders},body:JSON.stringify({id_estudiante:Number(btn.dataset.student),id_grupo:Number(btn.dataset.group),id_actividad:Number(btn.dataset.activity),comentario:area.value})});const d=await r.json();if(!r.ok||!d.success)throw Error(d.message||'No se pudo guardar');btn.textContent='Guardado ✓';}
  catch(err){alert(err.message);btn.textContent='Reintentar';}finally{btn.disabled=false;}
 });
});
