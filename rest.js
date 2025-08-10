// Restaurant LK script with profile banner + presigned uploads + auto-login
(() => {
  const urlp = new URLSearchParams(location.search);
  const API = urlp.get('api') || 'http://localhost:8000';
  const token = urlp.get('token');
  const saved = localStorage.getItem('foody_restaurant');
  let restaurant = saved ? JSON.parse(saved) : null;

  const els = {
    restInfo: document.getElementById('restInfo'),
    offers: document.getElementById('offers'),
    empty: document.getElementById('empty'),
    refresh: document.getElementById('refreshBtn'),
    addFloating: document.getElementById('addFloating'),
    toast: document.getElementById('toast'),
    logoutBtn: document.getElementById('logoutBtn'),
    resFilter: document.getElementById('resFilter'),
    resRefresh: document.getElementById('resRefresh'),
    resTable: document.getElementById('resTable')?.querySelector('tbody'),
    resEmpty: document.getElementById('resEmpty'),
    search: document.getElementById('search'),
    profileBanner: document.getElementById('profileBanner'),
    fillProfileBtn: document.getElementById('fillProfileBtn'),
    photo: document.getElementById('photo'),
    title: document.getElementById('title'),
    desc: document.getElementById('desc'),
    price: document.getElementById('price'),
    qty: document.getElementById('qty'),
    expires: document.getElementById('expires'),
    editModal: document.getElementById('editModal'),
    editId: document.getElementById('editId'),
    editPhoto: document.getElementById('editPhoto'),
    editTitle: document.getElementById('editTitle'),
    editDesc: document.getElementById('editDesc'),
    editPrice: document.getElementById('editPrice'),
    editQty: document.getElementById('editQty'),
    editExpires: document.getElementById('editExpires'),
  };

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

  const showLoggedUI = () => {
    els.restInfo.textContent = `Вы вошли как: ${restaurant.name} (id ${restaurant.id})`;
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.style.display = 'inline-flex';
  };

  const waitTgUser = () => new Promise((resolve) => {
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (u || tries > 10) { clearInterval(timer); resolve(u || null); }
    }, 100);
  });

  const tryTelegramLogin = async () => {
    const u = await waitTgUser();
    if (!u) return false;
    try {
      const r = await fetch(`${API}/whoami?telegram_id=${u.id}`);
      if (!r.ok) return false;
      const data = await r.json();
      restaurant = { id: data.restaurant_id, name: data.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      showLoggedUI();
      await Promise.all([loadOffers(), loadReservations(), checkProfile()]);
      return true;
    } catch { return false; }
  };

  const checkProfile = async () => {
    if (!restaurant) return;
    try {
      const r = await fetch(`${API}/restaurant/${restaurant.id}`);
      if (!r.ok) return;
      const prof = await r.json();
      const incomplete = !prof.phone || !prof.address;
      const href = `onboarding.html?api=${encodeURIComponent(API)}&from=lk`;
      els.fillProfileBtn.setAttribute('href', href);
      if (incomplete) {
        els.profileBanner.classList.remove('hidden');
        const inTG = !!(window.Telegram && Telegram.WebApp);
        const seen = localStorage.getItem('foody_profile_prompted');
        if (inTG && !seen) { localStorage.setItem('foody_profile_prompted', '1'); location.href = href; return; }
      } else {
        els.profileBanner.classList.add('hidden');
        localStorage.setItem('foody_profile_prompted', '1');
      }
    } catch {}
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

  let allOffers = [];
  let reservations = [];

  const renderOffers = () => {
    const q = (document.getElementById('search')?.value || '').trim().toLowerCase();
    const arr = q ? allOffers.filter(o => o.title.toLowerCase().includes(q)) : allOffers;
    els.offers.innerHTML = '';
    if (!arr.length) els.empty.classList.remove('hidden'); else els.empty.classList.add('hidden');
    arr.forEach(o => els.offers.appendChild(card(o)));
  };

  const renderReservations = () => {
    if (!els.resTable) return;
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

  // Create
  document.getElementById('createForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!restaurant) return toast('Нет доступа: аккаунт не активирован');
    let photo_url = null;
    const f = els.photo.files?.[0];
    if (f){ try { photo_url = await uploadImage(f); } catch { return toast('Не удалось загрузить фото'); } }
    const payload = {
      restaurant_id: restaurant.id,
      title: els.title.value.trim(),
      description: els.desc.value.trim(),
      price: parseFloat(els.price.value),
      quantity: parseInt(els.qty.value),
      expires_at: els.expires.value ? new Date(els.expires.value).toISOString() : null,
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
    els.editId.value = o.id;
    els.editTitle.value = o.title || '';
    els.editDesc.value = o.description || '';
    els.editPrice.value = o.price ?? '';
    els.editQty.value = o.quantity ?? '';
    try {
      const d = new Date(o.expires_at);
      const iso = new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
      els.editExpires.value = iso;
    } catch { els.editExpires.value = ''; }
    els.editModal.showModal();
  };

  document.getElementById('editForm')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = Number(els.editId.value);
    const patch = {};
    const f = els.editPhoto.files?.[0];
    if (f){ try { patch.photo_url = await uploadImage(f); } catch { return toast('Не удалось загрузить новое фото'); } }
    const t = els.editTitle.value.trim(); if (t) patch.title = t;
    const d = els.editDesc.value.trim(); if (d) patch.description = d;
    const p = els.editPrice.value; if (p !== '') patch.price = parseFloat(p);
    const q = els.editQty.value; if (q !== '') patch.quantity = parseInt(q);
    const e = els.editExpires.value; if (e) patch.expires_at = new Date(e).toISOString();
    try {
      const r = await fetch(`${API}/offers/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch)});
      const data = await r.json();
      if (data.offer_id){ toast('Обновлено ✅'); els.editModal.close(); loadOffers(); }
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
  els.refresh?.addEventListener('click', () => { loadOffers(); loadReservations(); checkProfile(); });
  els.addFloating?.addEventListener('click', () => els.title.focus());
  document.getElementById('search')?.addEventListener('input', renderOffers);
  els.logoutBtn?.addEventListener('click', () => { localStorage.removeItem('foody_restaurant'); location.reload(); });

  const init = async () => {
    if (token) {
      try {
        const r = await fetch(`${API}/verify/${token}`);
        const data = await r.json();
        if (data.restaurant_id){
          restaurant = { id: data.restaurant_id, name: data.restaurant_name };
          localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
          showLoggedUI();
          await Promise.all([loadOffers(), loadReservations(), checkProfile()]);
          return;
        }
      } catch {}
    }
    if (restaurant?.id){
      showLoggedUI();
      await Promise.all([loadOffers(), loadReservations(), checkProfile()]);
      return;
    }
    const ok = await tryTelegramLogin();
    if (ok) return;
    els.restInfo.textContent = 'Сначала активируйте аккаунт по ссылке из бота или привяжите Telegram.';
  };

  init();
})();
