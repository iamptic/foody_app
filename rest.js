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
    empty: document.getElementById('empty'),
    search: document.getElementById('search'),
    refresh: document.getElementById('refreshBtn'),
    addFloating: document.getElementById('addFloating'),
    toast: document.getElementById('toast'),
    editModal: document.getElementById('editModal'),
    editForm: document.getElementById('editForm'),
    editId: document.getElementById('editId'),
    editPhoto: document.getElementById('editPhoto'),
    editTitle: document.getElementById('editTitle'),
    editDesc: document.getElementById('editDesc'),
    editPrice: document.getElementById('editPrice'),
    editQty: document.getElementById('editQty'),
    editExpires: document.getElementById('editExpires'),
    resFilter: document.getElementById('resFilter'),
    resRefresh: document.getElementById('resRefresh'),
    resTable: document.getElementById('resTable').querySelector('tbody'),
    resEmpty: document.getElementById('resEmpty'),
  };

  let restaurant = null;
  let allOffers = [];
  let reservations = [];

  const toast = (msg) => { els.toast.textContent = msg; els.toast.style.display='block'; setTimeout(()=> els.toast.style.display='none', 2200); };
  const money = (v) => (isFinite(v) ? new Intl.NumberFormat('ru-RU').format(v) + ' ₽' : '—');
  const fmtDT = (s) => { try { return new Date(s).toLocaleString('ru-RU',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});} catch { return s||'—'; } };
  const badge = (status) => `<span class="badge-status ${status}">${status}</span>`;

  const uploadImage = async (file) => {
    const initRes = await fetch(`${API}/upload_init`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ filename: file.name, content_type: file.type || 'image/jpeg' })
    });
    if (!initRes.ok) throw new Error('upload_init failed');
    const initData = await initRes.json();
    if (file.size > (initData.max_mb||4)*1024*1024) throw new Error('too_large');
    const putRes = await fetch(initData.upload_url, { method:'PUT', headers: initData.headers||{'Content-Type': file.type||'image/jpeg'}, body: file });
    if (!putRes.ok) throw new Error('put_failed');
    return initData.public_url;
  };

  const card = (o) => {
    const div = document.createElement('div');
    div.className = 'offer';
    const img = o.photo_url ? `<img class="thumb" src="${o.photo_url}" alt="${o.title}">` : `<div class="thumb"></div>`;
    div.innerHTML = `${img}
      <div class="body">
        <div class="title"><b>${o.title}</b></div>
        <div class="meta">${o.description || ''}</div>
        <div class="meta">До: ${fmtDT(o.expires_at)}</div>
        <div class="price">${money(o.price)} • шт: ${o.quantity}</div>
        <div class="ops">
          <button class="btn ghost" data-edit="${o.id}">Редактировать</button>
          <button class="btn ghost" data-del="${o.id}">Удалить</button>
        </div>
      </div>`;
    div.querySelector('[data-edit]').onclick = () => openEdit(o);
    div.querySelector('[data-del]').onclick = () => deleteOffer(o.id);
    return div;
  };

  const renderOffers = () => {
    const q = (els.search.value || '').trim().toLowerCase();
    const arr = q ? allOffers.filter(o => o.title.toLowerCase().includes(q)) : allOffers;
    els.offers.innerHTML = '';
    if (!arr.length) els.empty.classList.remove('hidden'); else els.empty.classList.add('hidden');
    arr.forEach(o => els.offers.appendChild(card(o)));
  };

  const renderReservations = () => {
    const f = els.resFilter.value;
    const arr = reservations.filter(r => f === 'all' ? true : r.status === f);
    els.resTable.innerHTML = '';
    if (!arr.length) { els.resEmpty.classList.remove('hidden'); return; } else { els.resEmpty.classList.add('hidden'); }
    arr.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${r.code}</b></td><td>${r.offer_title}</td><td>${r.buyer_name || '—'}</td><td>${badge(r.status)}</td><td>${fmtDT(r.expires_at)}</td><td>${fmtDT(r.created_at)}</td>`;
      els.resTable.appendChild(tr);
    });
  };

  const loadOffers = async () => {
    try { const r = await fetch(`${API}/offers`); allOffers = await r.json(); renderOffers(); }
    catch { toast('Не удалось загрузить предложения'); }
  };
  const loadReservations = async () => {
    if (!restaurant) return;
    try { const r = await fetch(`${API}/restaurant_reservations/${restaurant.id}`); reservations = await r.json(); renderReservations(); }
    catch { toast('Не удалось загрузить брони'); }
  };

  const init = async () => {
    if (!token) { els.restInfo.textContent = 'Сначала активируйте аккаунт по ссылке из бота.'; return; }
    try {
      const r = await fetch(`${API}/verify/${token}`);
      const data = await r.json();
      if (data.restaurant_id){
        restaurant = { id: data.restaurant_id, name: data.restaurant_name };
        els.restInfo.textContent = `Аккаунт активирован: ${restaurant.name} (id ${restaurant.id})`;
        await loadOffers();
        await loadReservations();
      } else { els.restInfo.textContent = 'Ошибка активации: ' + JSON.stringify(data); }
    } catch { els.restInfo.textContent = 'Сервер недоступен'; }
  };

  // Create
  document.getElementById('createForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!restaurant) return toast('Нет доступа: аккаунт не активирован');
    const photoInput = document.getElementById('photo');
    let photo_url = null;
    if (photoInput.files?.[0]) {
      try { photo_url = await uploadImage(photoInput.files[0]); } catch { return toast('Не удалось загрузить фото'); }
    }
    const payload = {
      restaurant_id: restaurant.id,
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('desc').value.trim(),
      price: parseFloat(document.getElementById('price').value),
      quantity: parseInt(document.getElementById('qty').value),
      expires_at: document.getElementById('expires').value ? new Date(document.getElementById('expires').value).toISOString() : null,
      photo_url
    };
    if (!payload.title || !isFinite(payload.price) || !isFinite(payload.quantity)) return toast('Заполните обязательные поля');
    try {
      const r = await fetch(`${API}/offers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const data = await r.json();
      if (data.offer_id){ toast('Сохранено ✅'); ev.target.reset(); loadOffers(); }
      else { toast('Ошибка: ' + JSON.stringify(data)); }
    } catch { toast('Ошибка сети'); }
  });

  const openEdit = (o) => {
    document.getElementById('editId').value = o.id;
    document.getElementById('editTitle').value = o.title || '';
    document.getElementById('editDesc').value = o.description || '';
    document.getElementById('editPrice').value = o.price ?? '';
    document.getElementById('editQty').value = o.quantity ?? '';
    try {
      const d = new Date(o.expires_at);
      const iso = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
      document.getElementById('editExpires').value = iso;
    } catch { document.getElementById('editExpires').value = ''; }
    document.getElementById('editModal').showModal();
  };

  document.getElementById('editForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = Number(document.getElementById('editId').value);
    const patch = {};
    const f = document.getElementById('editPhoto').files?.[0];
    if (f){ try { patch.photo_url = await uploadImage(f); } catch { return toast('Не удалось загрузить новое фото'); } }
    const t = document.getElementById('editTitle').value.trim(); if (t) patch.title = t;
    const d = document.getElementById('editDesc').value.trim(); if (d) patch.description = d;
    const p = document.getElementById('editPrice').value; if (p !== '') patch.price = parseFloat(p);
    const q = document.getElementById('editQty').value; if (q !== '') patch.quantity = parseInt(q);
    const e = document.getElementById('editExpires').value; if (e) patch.expires_at = new Date(e).toISOString();
    try {
      const r = await fetch(`${API}/offers/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch)});
      const data = await r.json();
      if (data.offer_id){ toast('Обновлено ✅'); document.getElementById('editModal').close(); loadOffers(); }
      else { toast('Ошибка: ' + JSON.stringify(data)); }
    } catch { toast('Ошибка сети'); }
  });

  const deleteOffer = async (id) => {
    if (!confirm(`Удалить оффер #${id}?`)) return;
    try { const r = await fetch(`${API}/offers/${id}`, { method:'DELETE' }); const data = await r.json();
      if (data.status === 'deleted'){ toast('Удалено 🗑️'); loadOffers(); } else { toast('Ошибка: ' + JSON.stringify(data)); }
    } catch { toast('Ошибка сети'); }
  };

  // Controls
  document.getElementById('refreshBtn').onclick = () => { loadOffers(); loadReservations(); };
  document.getElementById('addFloating').onclick = () => document.getElementById('title').focus();
  document.getElementById('search').addEventListener('input', renderOffers);

  init();
})();
