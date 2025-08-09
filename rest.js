(() => {
  const API = new URLSearchParams(location.search).get('api') || 'http://localhost:8000';
  const token = new URLSearchParams(location.search).get('token');
  const $ = (id)=>document.getElementById(id);
  const toast=(m)=>{const t=$('toast');t.textContent=m;t.style.display='block';setTimeout(()=>t.style.display='none',2000)};
  let restaurant=null, offers=[], reservations=[];

  async function uploadImage(file){
    const r=await fetch(`${API}/upload_init`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:file.name,content_type:file.type||'image/jpeg'})});
    if(!r.ok) throw new Error('upload_init'); const j=await r.json();
    if(file.size>(j.max_mb||4)*1024*1024) throw new Error('too_large');
    const put=await fetch(j.upload_url,{method:'PUT',headers:j.headers||{'Content-Type':file.type||'image/jpeg'},body:file});
    if(!put.ok) throw new Error('put_failed'); return j.public_url;
  }

  async function init(){
    if(!token){$('restInfo').textContent='Сначала активируйте аккаунт по ссылке из бота.';return;}
    try{const r=await fetch(`${API}/verify/${token}`);const j=await r.json(); if(j.restaurant_id){restaurant={id:j.restaurant_id,name:j.restaurant_name};$('restInfo').textContent=`Аккаунт активирован: ${restaurant.name}`}else{$('restInfo').textContent='Ошибка активации';}}catch{ $('restInfo').textContent='Сервер недоступен';}
    loadOffers(); loadReservations();
  }

  async function loadOffers(){ try{const r=await fetch(`${API}/offers`); offers=await r.json(); renderOffers(); }catch{toast('Не удалось загрузить офферы');} }
  function renderOffers(){
    const q=($('search').value||'').toLowerCase(); const arr=q?offers.filter(o=>o.title.toLowerCase().includes(q)):offers;
    const wrap=$('offers'); wrap.innerHTML='';
    arr.forEach(o=>{const d=document.createElement('div');d.className='offer';d.innerHTML=`${o.photo_url?`<img class="thumb" src="${o.photo_url}">`:'<div class="thumb"></div>'}<div class="body"><b>${o.title}</b><div>${o.description||''}</div><div>До: ${new Date(o.expires_at).toLocaleString('ru-RU')}</div><div><b>${o.price}</b> ₽ • шт: ${o.quantity}</div></div>`; wrap.appendChild(d);});
  }

  async function loadReservations(){ if(!restaurant) return; try{const r=await fetch(`${API}/restaurant_reservations/${restaurant.id}`); reservations=await r.json(); renderReservations(); }catch{toast('Не удалось загрузить брони');} }
  function renderReservations(){
    const f=$('resFilter').value; const arr=reservations.filter(r=>f==='all'?true:r.status===f);
    const tb=$('resTable'); tb.innerHTML=''; arr.forEach(r=>{const tr=document.createElement('tr'); tr.innerHTML=`<td><b>${r.code}</b></td><td>${r.offer_title}</td><td>${r.buyer_name||'—'}</td><td>${r.status}</td><td>${new Date(r.expires_at).toLocaleString('ru-RU')}</td><td>${new Date(r.created_at).toLocaleString('ru-RU')}</td>`; tb.appendChild(tr); });
  }

  $('createForm').addEventListener('submit', async (e)=>{
    e.preventDefault(); if(!restaurant) return toast('Нет доступа');
    let photo_url=null; const f=$('photo').files?.[0]; if(f){ try{photo_url=await uploadImage(f);}catch{ return toast('Не удалось загрузить фото'); } }
    const payload={restaurant_id:restaurant.id,title:$('title').value.trim(),description:$('desc').value.trim(),price:parseFloat($('price').value),quantity:parseInt($('qty').value),expires_at:$('expires').value?new Date($('expires').value).toISOString():null,photo_url};
    try{const r=await fetch(`${API}/offers`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await r.json(); if(j.offer_id){toast('Сохранено'); e.target.reset(); loadOffers();} else toast('Ошибка');}catch{toast('Ошибка сети');}
  });

  $('refreshBtn').onclick=()=>{loadOffers();loadReservations();};
  $('resRefresh').onclick=()=>loadReservations();
  $('resFilter').onchange=()=>renderReservations();
  $('search').oninput=()=>renderOffers();
  init();
})();
