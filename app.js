(() => {
  const tg = window.Telegram?.WebApp; try { tg?.expand?.(); } catch(_) {}

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
    editExpires: document.getElementById('editExpires')
  };

  let restaurant = null;
  let allOffers = [];

  const showToast = (msg) => {
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    setTimeout(() => els.toast.classList.add('hidden'), 2200);
  };

  const fmtMoney = (v) => (isFinite(v) ? new Intl.NumberFormat('ru-RU').format(v) + ' ₽' : '—');
  const fmtDT = (s) => {
    try { return new Date(s).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }); }
    catch { return s || '—'; }
  };

  const card = (o) => {
    const div = document.createElement('div');
    div.className = 'offer';
    const img = o.photo_url ? `<img class="thumb" src="${o.photo_url}" alt="${o.title}">` : `<div class="thumb"></div>`;
    div.innerHTML = `
      ${img}
      <div class="body">
        <div class="title"><b>${o.title}</b></div>
        <div class="meta">${o.description || ''}</div>
        <div class="meta">Действует до: ${fmtDT(o.expires_at)}</div>
        <div class="price">${fmtMoney(o.price)} • шт: ${o.quantity}</div>
        <div class="ops">
          <button class="btn ghost" data-edit="${o.id}">Редактировать</button>
          <button class="btn ghost" data-del="${o.id}">Удалить</button>
        </div>
      </div>
    `;
    div.querySelector('[data-edit]').onclick = () => openEdit(o);
    div.querySelector('[data-del]').onclick = () => deleteOffer(o.id);
    return div;
  };

  const render = () => {
    const q = (els.search.value || '').trim().toLowerCase();
    const mine = allOffers.filter(o => !restaurant || o.restaurant === restaurant.name);
    const arr = q ? mine.filter(o => o.title.toLowerCase().includes(q)) : mine;
    els.offers.innerHTML = '';
    if (!arr.length) els.empty.classList.remove('hidden'); else els.empty.classList.add('hidden');
    arr.forEach(o => els.offers.appendChild(card(o)));
  };

  const init = async () => {
    if (!token) {
      els.restInfo.textContent = 'Сначала активируйте аккаунт по ссылке из бота.';
      return;
    }
    try {
      const r = await fetch(`${API}/verify/${token}`);
      const data = await r.json();
      if (data.restaurant_id) {
        restaurant = { id: data.restaurant_id, name: data.restaurant_name };
        els.restInfo.textContent = `Аккаунт активирован: ${restaurant.name} (id ${restaurant.id})`;
        await loadOffers();
      } else {
        els.restInfo.textContent = 'Ошибка активации: ' + JSON.stringify(data);
      }
    } catch (e) {
      els.restInfo.textContent = 'Сервер недоступен';
    }
  };

  const loadOffers = async () => {
    try {
      const r = await fetch(`${API}/offers`);
      allOffers = await r.json();
      render();
    } catch (e) {
      showToast('Не удалось загрузить предложения');
    }
  };

  // Upload helper
  const uploadImage = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(`${API}/upload`, { method: 'POST', body: fd });
    if (!r.ok) throw new Error('upload failed');
    const data = await r.json();
    return data.url;
  };

  // Create
  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!restaurant) return showToast('Нет доступа: аккаунт не активирован');

    // optional photo upload
    let photo_url = null;
    const file = els.photo.files?.[0];
    try {
      if (file) photo_url = await uploadImage(file);
    } catch {
      return showToast('Не удалось загрузить фото');
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
    if (!payload.title || !isFinite(payload.price) || !isFinite(payload.quantity)) {
      return showToast('Заполните обязательные поля');
    }
    try {
      const r = await fetch(`${API}/offers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (data.offer_id) {
        showToast('Сохранено ✅');
        els.form.reset();
        loadOffers();
      } else {
        showToast('Ошибка: ' + JSON.stringify(data));
      }
    } catch (e) {
      showToast('Ошибка сети');
    }
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

  els.editForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = Number(els.editId.value);
    const patch = {};
    if (els.editTitle.value.trim()) patch.title = els.editTitle.value.trim();
    if (els.editDesc.value.trim()) patch.description = els.editDesc.value.trim();
    if (els.editPrice.value !== '') patch.price = parseFloat(els.editPrice.value);
    if (els.editQty.value !== '') patch.quantity = parseInt(els.editQty.value);
    if (els.editExpires.value) patch.expires_at = new Date(els.editExpires.value).toISOString();

    // optional new photo
    if (els.editPhoto.files?.[0]) {
      try {
        patch.photo_url = await uploadImage(els.editPhoto.files[0]);
      } catch {
        return showToast('Не удалось загрузить новое фото');
      }
    }

    try {
      const r = await fetch(`${API}/offers/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch)});
      const data = await r.json();
      if (data.offer_id) {
        showToast('Обновлено ✅');
        els.editModal.close();
        loadOffers();
      } else {
        showToast('Ошибка: ' + JSON.stringify(data));
      }
    } catch {
      showToast('Ошибка сети');
    }
  });

  const deleteOffer = async (id) => {
    if (!confirm(`Удалить оффер #${id}?`)) return;
    try {
      const r = await fetch(`${API}/offers/${id}`, { method: 'DELETE' });
      const data = await r.json();
      if (data.status === 'deleted') {
        showToast('Удалено 🗑️'); loadOffers();
      } else {
        showToast('Ошибка: ' + JSON.stringify(data));
      }
    } catch {
      showToast('Ошибка сети');
    }
  };

  els.refresh.onclick = () => loadOffers();
  els.addFloating.onclick = () => document.getElementById('title').focus();
  els.search.addEventListener('input', render);

  init();
})();
