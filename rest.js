(() => {
  const urlp = new URLSearchParams(location.search);
  const API = urlp.get('api') || 'http://localhost:8000';
  const token = urlp.get('token');

  const els = {
    restInfo: document.getElementById('restInfo'),
    createForm: document.getElementById('createForm'),
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
    resFilter: document.getElementById('resFilter'),
    resRefresh: document.getElementById('resRefresh'),
    resTable: document.getElementById('resTable') ? document.getElementById('resTable').querySelector('tbody') : null,
    resEmpty: document.getElementById('resEmpty'),
    toast: document.getElementById('toast'),
    tabOffers: document.getElementById('tabOffers'),
    tabReservations: document.getElementById('tabReservations'),
    offersSection: document.getElementById('offersSection'),
    reservationsSection: document.getElementById('reservationsSection'),
  };

  let restaurant = null;
  let allOffers = [];
  let reservations = [];
  let autoTimer = null;

  const toast = (msg) => { els.toast.textContent = msg; els.toast.classList.add('show'); setTimeout(()=> els.toast.classList.remove('show'), 2000); };
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
          <button class="btn ghost" data-del="${o.id}">Удалить</button>
        </div>
      </div>`;
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
    if (!els.resTable) return;
    els.resTable.innerHTML = '';
    if (!arr.length) { els.resEmpty.classList.remove('hidden'); return; } else { els.resEmpty.classList.add('hidden'); }
    arr.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><b>${r.code}</b></td><td>${r.offer_title}</td><td>${r.buyer_name || '—'}</td><td>${badge(r.status)}</td><td>${fmtDT(r.expires_at)}</td><td>${fmtDT(r.created_at)}</td><td>${r.status==='active' ? '<button class="btn primary" data-redeem="'+r.code+'">Погасить</button>' : ''}</td>`;
      els.resTable.appendChild(tr);
    });
    document.querySelectorAll('[data-redeem]').forEach(btn => {
      btn.onclick = async () => {
        try {
          const rq = await fetch(`${API}/reservations/${btn.dataset.redeem}/redeem`, { method:'POST' });
          const out = await rq.json();
          if (out.status === 'redeemed') { toast('Погашено ✅'); loadReservations(); }
          else { toast('Ошибка: ' + JSON.stringify(out)); }
        } catch { toast('Ошибка сети'); }
      };
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

  const startAutoRefresh = () => {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => loadReservations(), 15000);
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
        startAutoRefresh();
      } else { els.restInfo.textContent = 'Ошибка активации: ' + JSON.stringify(data); }
    } catch { els.restInfo.textContent = 'Сервер недоступен'; }
  };

  // Create
  els.createForm.addEventListener('submit', async (ev) => {
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

  const deleteOffer = async (id) => {
    if (!confirm(`Удалить оффер #${id}?`)) return;
    try { const r = await fetch(`${API}/offers/${id}`, { method:'DELETE' }); const data = await r.json();
      if (data.status === 'deleted'){ toast('Удалено 🗑️'); loadOffers(); } else { toast('Ошибка: ' + JSON.stringify(data)); }
    } catch { toast('Ошибка сети'); }
  };

  // Tabs & controls
  const switchTab = (tab) => {
    if (tab === 'offers') {
      els.offersSection.classList.remove('hidden');
      els.reservationsSection.classList.add('hidden');
      els.tabOffers.classList.add('primary'); els.tabReservations.classList.remove('primary');
    } else {
      els.offersSection.classList.add('hidden');
      els.reservationsSection.classList.remove('hidden');
      els.tabOffers.classList.remove('primary'); els.tabReservations.classList.add('primary');
      loadReservations();
    }
  };
  document.getElementById('tabOffers').onclick = () => switchTab('offers');
  document.getElementById('tabReservations').onclick = () => switchTab('reservations');
  els.refresh.onclick = () => { loadOffers(); loadReservations(); };
  document.getElementById('search').addEventListener('input', renderOffers);

  init();
})();
