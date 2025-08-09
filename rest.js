(() => {
  const urlp = new URLSearchParams(location.search);
  const API = urlp.get('api') || 'http://localhost:8000';
  const token = urlp.get('token');

  const els = {
    restInfo: document.getElementById('restInfo'),
    form: document.getElementById('createForm'),
    photo: document.getElementById('photo'),
    title: document.getElementById('title'),
    desc: document.getElementById('desc'),
    price: document.getElementById('price'),
    qty: document.getElementById('qty'),
    expires: document.getElementById('expires'),
    offers: document.getElementById('offers'),
    toast: document.getElementById('toast'),
  };

  const toast = (msg) => { els.toast.textContent = msg; els.toast.style.display='block'; setTimeout(()=> els.toast.style.display='none', 2200); };

  const uploadImage = async (file) => {
    const initRes = await fetch(`${API}/upload_init`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ filename: file.name, content_type: file.type || 'image/jpeg' })
    });
    if (!initRes.ok) throw new Error('upload_init failed');
    const initData = await initRes.json();
    if (file.size > (initData.max_mb||4)*1024*1024) throw new Error('too_large');
    // Простой PUT без заголовков — максимальная совместимость
    const putRes = await fetch(initData.upload_url, { method:'PUT', body: file });
    if (!putRes.ok) throw new Error('put_failed');
    return initData.public_url;
  };

  let restaurant = null;

  const loadOffers = async () => {
    try {
      const r = await fetch(`${API}/offers`);
      const items = await r.json();
      const cont = els.offers; cont.innerHTML='';
      items.forEach(o => {
        const div = document.createElement('div');
        div.innerHTML = `<div><b>${o.title}</b> — ${o.price} ₽ (${o.quantity})</div>` + (o.photo_url ? `<img src="${o.photo_url}" style="max-width:200px;margin-top:6px">` : '');
        cont.appendChild(div);
      });
    } catch {}
  };

  const init = async () => {
    if (!token){ els.restInfo.textContent = 'Активируйте аккаунт по ссылке из бота'; return; }
    try {
      const r = await fetch(`${API}/verify/${token}`);
      const data = await r.json();
      if (data.restaurant_id){ restaurant = { id:data.restaurant_id, name:data.restaurant_name }; els.restInfo.textContent = `Аккаунт активирован: ${restaurant.name}`; loadOffers(); }
      else els.restInfo.textContent = 'Ошибка активации';
    } catch { els.restInfo.textContent = 'Сервер недоступен'; }
  };

  els.form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!restaurant) return toast('Нет доступа');
    let photo_url = null;
    if (els.photo.files?.[0]){
      try { photo_url = await uploadImage(els.photo.files[0]); }
      catch(e){ return toast('Не удалось загрузить фото'); }
    }
    const payload = {
      restaurant_id: restaurant.id,
      title: els.title.value.trim(),
      description: els.desc.value.trim(),
      price: parseFloat(els.price.value),
      quantity: parseInt(els.qty.value),
      expires_at: els.expires.value ? new Date(els.expires.value).toISOString() : null,
      photo_url
    };
    try {
      const r = await fetch(`${API}/offers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const data = await r.json();
      if (data.offer_id){ toast('Сохранено'); els.form.reset(); loadOffers(); } else { toast('Ошибка'); }
    } catch { toast('Ошибка сети'); }
  });

  init();
})();
