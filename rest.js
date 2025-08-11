/* Foody Mini-App — rest.js (полностью новый)
   — Telegram.WebApp.ready() + expand() (чтобы не было “load failed”)
   — Надёжное определение API (URL ?api=… → localStorage → DEFAULT_API)
   — Тосты, haptics, понятные ошибки (в т.ч. CORS/сеть)
   — ЛК ресторана: вход/выход, создание/выбор ресторана, офферы (CRUD), брони, фото (presigned PUT → /upload)
   — Совместим с разметкой предыдущих экранов (см. список ID в сообщении)
*/
(() => {
  // --- 0) Telegram init + API base -----------------------------------------
  try {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand?.();
    }
  } catch (_) {}

  const DEFAULT_API = 'https://foodyback-production.up.railway.app'; // <— при необходимости поменяй

  const params = new URLSearchParams(location.search);
  const urlApi = params.get('api');
  if (urlApi) localStorage.setItem('foody_api', urlApi);

  // Если открыто внутри Telegram и API ещё не задан — используем дефолт
  if (window.Telegram?.WebApp && !urlApi && !localStorage.getItem('foody_api')) {
    localStorage.setItem('foody_api', DEFAULT_API);
  }

  const API = (urlApi || localStorage.getItem('foody_api') || DEFAULT_API).replace(/\/+$/,'');
  window.FOODY_API = API;

  // --- 1) Утилиты UI/HTTP ---------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const els = {
    restInfo: $('restInfo'),
    loginBtn: $('loginBtn'),
    logoutBtn: $('logoutBtn'),
    settingsBtn: $('settingsBtn'),
    settingsModal: $('settingsModal'),
    settingsClose: $('settingsClose'),
    restSelect: $('restSelect'),
    newRestName: $('newRestName'),
    createRestBtn: $('createRestBtn'),
    saveSettings: $('saveSettings'),
    profileBanner: $('profileBanner'),
    createForm: $('createForm'),
    title: $('title'), desc: $('desc'),
    price: $('price'), qty: $('qty'),
    expires: $('expires'), photo: $('photo'),
    offers: $('offers'), empty: $('empty'),
    search: $('search'),
    resTable: $('resTable') ? $('resTable').querySelector('tbody') : null,
    resFilter: $('resFilter'), resEmpty: $('resEmpty'),
    addFloating: $('addFloating'),
    editModal: $('editModal'), editForm: $('editForm'),
    editClose: $('editClose'),
    editId: $('editId'), editTitle: $('editTitle'),
    editDesc: $('editDesc'), editPrice: $('editPrice'),
    editQty: $('editQty'), editExpires: $('editExpires'),
    editPhoto: $('editPhoto'),
    tipsCallout: $('tipsCallout'),
  };

  // Тосты + лёгкий haptic
  const toast = (msg) => {
    let node = $('toast');
    if (!node) { node = document.createElement('div'); node.id='toast'; node.className='toast'; document.body.appendChild(node); }
    node.textContent = msg;
    node.classList.remove('hidden');
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); } catch(_){}
    setTimeout(()=>node.classList.add('hidden'), 2600);
  };

  const setBusy = (btn, busy=true) => {
    if (!btn) return;
    btn.disabled = !!busy;
    if (busy) btn.setAttribute('aria-busy','true'); else btn.removeAttribute('aria-busy');
  };

  const fmtDT = (s) => {
    try { return new Date(s).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }
    catch { return s||'—'; }
  };
  const money = (v) => new Intl.NumberFormat('ru-RU').format(v) + ' ₽';

  // Обёртка над fetch с авто-JSON и понятными ошибками
  async function fetchJSON(input, init) {
    try {
      const res = await fetch(input, init);
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json().catch(()=>({})) : await res.text();
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok:false, status:0, data: { detail: e?.message || 'network_error' } };
    }
  }

  // --- 2) Авторизация/привязка через Telegram -------------------------------
  const TG_USER = window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  let restaurant = null;
  try { restaurant = JSON.parse(localStorage.getItem('foody_restaurant')||'null'); } catch {}

  async function whoami() {
    if (!TG_USER) throw new Error('not_in_telegram');
    const r = await fetchJSON(`${API}/whoami?telegram_id=${TG_USER.id}`);
    if (!r.ok) throw new Error(r.data?.detail || `whoami_${r.status}`);
    return r.data;
  }

  async function autologin() {
    const skip = localStorage.getItem('foody_skip_autologin') === '1';
    if (restaurant?.id) { await reloadAll(); return; }
    if (skip) {
      if (els.restInfo) els.restInfo.textContent = 'Вы вышли. Откройте «Настройки», чтобы выбрать ресторан, или «Войти».';
      if (els.loginBtn) els.loginBtn.style.display = 'inline-flex';
      return;
    }
    try {
      const d = await whoami();
      restaurant = { id: d.restaurant_id, name: d.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await reloadAll();
    } catch {
      if (els.restInfo) els.restInfo.textContent = 'Нет привязки к ресторану. Откройте «Настройки», создайте или выберите ресторан.';
      if (els.loginBtn) els.loginBtn.style.display = 'inline-flex';
    }
  }

  // --- 3) Настройки / создание ресторана -----------------------------------
  async function populateRestList() {
    if (!els.restSelect) return;
    els.restSelect.innerHTML = '';
    if (restaurant?.id) {
      const opt = new Option(`${restaurant.name} (id ${restaurant.id})`, restaurant.id, true, true);
      els.restSelect.add(opt);
    }
    if (!TG_USER) return;
    const r = await fetchJSON(`${API}/my_restaurants?telegram_id=${TG_USER.id}`);
    if (r.ok && Array.isArray(r.data)) {
      for (const x of r.data) {
        if (![...els.restSelect.options].some(o => Number(o.value)===x.id)) {
          els.restSelect.add(new Option(`${x.restaurant_name} (id ${x.id})`, x.id));
        }
      }
    }
  }

  async function openSettings() {
    await populateRestList();
    els.settingsModal?.showModal?.();
  }

  async function createRestaurant() {
    if (!els.newRestName) return;
    const name = (els.newRestName.value || '').trim() || 'Мой ресторан';
    if (!TG_USER) return toast('Откройте Mini App из Telegram');
    setBusy(els.createRestBtn, true);
    const res = await fetchJSON(`${API}/register_telegram?force_new=true`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, telegram_id: String(TG_USER.id) })
    });
    setBusy(els.createRestBtn, false);
    if (!res.ok) {
      const msg = typeof res.data === 'string' ? res.data : (res.data?.detail || 'Ошибка');
      if (els.tipsCallout && res.status === 0) {
        els.tipsCallout.style.display = 'block';
        els.tipsCallout.textContent = 'Сервер недоступен или домен не в CORS_ORIGINS бэкенда.';
      }
      return toast('Не удалось создать: ' + msg);
    }
    const data = res.data || {};
    if (data.restaurant_id) {
      restaurant = { id: data.restaurant_id, name: data.restaurant_name || name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      // пометим активным
      await fetchJSON(`${API}/set_active_restaurant?telegram_id=${TG_USER.id}&restaurant_id=${restaurant.id}`, { method:'POST' });
      els.settingsModal?.close?.();
      await reloadAll();
      toast(`Создан «${restaurant.name}» и выбран активным`);
    } else {
      toast('Не удалось создать (пустой ответ)');
    }
  }

  async function saveActiveRestaurant() {
    if (!els.restSelect || !TG_USER) { els.settingsModal?.close?.(); return; }
    const rid = parseInt(els.restSelect.value || '0', 10);
    if (!rid) { els.settingsModal?.close?.(); return; }
    setBusy(els.saveSettings, true);
    await fetchJSON(`${API}/set_active_restaurant?telegram_id=${TG_USER.id}&restaurant_id=${rid}`, { method:'POST' });
    // подтянем имя
    let name = `Ресторан ${rid}`;
    const prof = await fetchJSON(`${API}/restaurant/${rid}`);
    if (prof.ok) name = prof.data.restaurant_name || name;
    restaurant = { id: rid, name };
    localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
    els.settingsModal?.close?.();
    setBusy(els.saveSettings, false);
    await reloadAll();
    toast('Активный ресторан обновлён');
  }

  // --- 4) Профиль / статус --------------------------------------------------
  async function fetchProfile() {
    if (!restaurant?.id) throw 0;
    const r = await fetchJSON(`${API}/restaurant/${restaurant.id}`);
    if (!r.ok) throw 0;
    return r.data;
  }

  async function checkProfileAndStatus() {
    try {
      const p = await fetchProfile();
      const city = p.city ? `, ${p.city}` : '';
      if (els.restInfo) els.restInfo.textContent = `Вы вошли как: ${restaurant.name}${city} (id ${restaurant.id})`;
      const incomplete = !(p.phone && p.address && p.city);
      if (els.profileBanner) els.profileBanner.style.display = incomplete ? 'flex' : 'none';
      if (els.tipsCallout) {
        els.tipsCallout.style.display = incomplete ? 'block' : 'none';
        if (incomplete) els.tipsCallout.textContent = 'Заполните профиль (телефон, адрес, город), чтобы предложения стали видимы покупателям.';
      }
    } catch {
      if (els.restInfo) els.restInfo.textContent = `Ресторан id ${restaurant?.id||'—'}`;
    }
  }

  // --- 5) Офферы (CRUD) -----------------------------------------------------
  function renderOffers(items) {
    if (!els.offers) return;
    els.offers.innerHTML = '';
    const q = (els.search?.value || '').toLowerCase();
    let arr = items || [];
    if (q) arr = arr.filter(o => (o.title||'').toLowerCase().includes(q));
    if (!arr.length) { els.empty?.classList?.remove('hidden'); return; }
    els.empty?.classList?.add('hidden');
    for (const o of arr) {
      const wrap = document.createElement('div');
      wrap.className = 'card-item';
      const img = o.photo_url ? `<div style="margin:6px 0"><img src="${o.photo_url}" alt="" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px"/></div>` : '';
      wrap.innerHTML = `
        <div><b>${o.title || 'Без названия'}</b></div>
        ${img}
        <div class="meta">До: ${fmtDT(o.expires_at)} • Остаток: ${o.quantity}</div>
        <div><b>${money(o.price)}</b></div>
        <div class="actions">
          <button class="btn" data-edit="${o.id}">Редактировать</button>
          <button class="btn" data-del="${o.id}">Удалить</button>
        </div>`;
      wrap.querySelector('[data-edit]').onclick = () => openEdit(o);
      wrap.querySelector('[data-del]').onclick = () => delOffer(o.id);
      els.offers.appendChild(wrap);
    }
  }

  async function loadOffers() {
    try {
      const r = await fetchJSON(`${API}/offers`);
      if (!r.ok || !Array.isArray(r.data)) return;
      const my = restaurant?.id ? r.data.filter(o => o.restaurant_id === restaurant.id) : [];
      renderOffers(my);
    } catch {}
  }

  async function delOffer(id) {
    if (!confirm('Удалить предложение?')) return;
    const r = await fetchJSON(`${API}/offers/${id}`, { method:'DELETE' });
    if (r.ok) { toast('Удалено'); await loadOffers(); } else toast('Не удалось удалить');
  }

  // Создание оффера
  async function uploadFile(file) {
    if (!file) return null;
    // presigned
    try {
      const init = await fetchJSON(`${API}/upload_init`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ filename: file.name, content_type: file.type || 'image/jpeg' })
      });
      if (init.ok && init.data?.upload_url) {
        await fetch(init.data.upload_url, { method:'PUT', headers: init.data.headers || {'Content-Type': file.type||'image/jpeg'}, body:file });
        return init.data.public_url;
      }
    } catch {}
    // fallback /upload
    try {
      const fd = new FormData(); fd.append('file', file);
      const up = await fetchJSON(`${API}/upload`, { method:'POST', body: fd });
      if (up.ok && up.data?.url) return up.data.url;
    } catch {}
    return null;
  }

  els.createForm?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!restaurant?.id) return toast('Нет ресторана');
    setBusy(els.createForm.querySelector('button[type="submit"]'), true);
    const photo_url = els.photo?.files?.[0] ? await uploadFile(els.photo.files[0]) : null;
    const payload = {
      restaurant_id: restaurant.id,
      title: els.title?.value?.trim(),
      description: els.desc?.value?.trim() || null,
      price: Number(els.price?.value || 0),
      quantity: Number(els.qty?.value || 0),
      expires_at: els.expires?.value ? new Date(els.expires.value).toISOString() : null,
      photo_url
    };
    const r = await fetchJSON(`${API}/offers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    setBusy(els.createForm.querySelector('button[type="submit"]'), false);
    if (r.ok) { toast('Добавлено'); els.createForm.reset(); await loadOffers(); }
    else toast('Ошибка: ' + (typeof r.data==='string' ? r.data : (r.data?.detail || r.status)));
  });

  // Редактирование
  const e = {
    modal: els.editModal, form: els.editForm, close: els.editClose,
    id: els.editId, title: els.editTitle, desc: els.editDesc,
    price: els.editPrice, qty: els.editQty, exp: els.editExpires, photo: els.editPhoto
  };

  function openEdit(o) {
    if (!e.modal) return;
    e.id.value = o.id;
    e.title.value = o.title || '';
    e.desc.value = o.description || '';
    e.price.value = o.price;
    e.qty.value = o.quantity;
    try { e.exp.value = new Date(o.expires_at).toISOString().slice(0,16); } catch {}
    e.photo.value = null;
    e.modal.showModal?.();
  }
  e?.close?.addEventListener('click', () => e.modal?.close?.());

  e?.form?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = Number(e.id.value);
    const payload = {
      title: e.title.value.trim() || undefined,
      description: e.desc.value.trim() || undefined,
      price: e.price.value ? Number(e.price.value) : undefined,
      quantity: e.qty.value ? Number(e.qty.value) : undefined,
      expires_at: e.exp.value ? new Date(e.exp.value).toISOString() : undefined,
    };
    if (e.photo?.files?.[0]) {
      const url = await uploadFile(e.photo.files[0]);
      if (url) payload.photo_url = url; else toast('Фото не загружено');
    }
    const r = await fetchJSON(`${API}/offers/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (r.ok) { toast('Сохранено'); e.modal?.close?.(); await loadOffers(); }
    else toast('Ошибка: ' + (typeof r.data==='string' ? r.data : (r.data?.detail || r.status)));
  });

  // --- 6) Брони --------------------------------------------------------------
  function renderReservations(list) {
    if (!els.resTable) return;
    const tbody = els.resTable; tbody.innerHTML = '';
    const filter = els.resFilter?.value || 'all';
    let arr = Array.isArray(list) ? list : [];
    if (filter!=='all') arr = arr.filter(x => x.status === filter);
    if (!arr.length) { els.resEmpty?.classList?.remove('hidden'); return; }
    els.resEmpty?.classList?.add('hidden');
    for (const x of arr) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${x.code}</td><td>${x.offer_title}</td><td>${x.buyer_name||'—'}</td><td>${x.status}</td><td>${fmtDT(x.expires_at)}</td><td>${fmtDT(x.created_at)}</td>`;
      tbody.appendChild(tr);
    }
  }

  async function loadReservations() {
    if (!els.resTable || !restaurant?.id) return;
    const r = await fetchJSON(`${API}/restaurant_reservations/${restaurant.id}`);
    if (r.ok) renderReservations(r.data);
  }

  // --- 7) Перезагрузка экрана ------------------------------------------------
  async function reloadAll() {
    await Promise.allSettled([checkProfileAndStatus(), loadOffers(), loadReservations()]);
  }

  // --- 8) Навешиваем обработчики --------------------------------------------
  els.settingsBtn?.addEventListener('click', openSettings);
  els.settingsClose?.addEventListener('click', () => els.settingsModal?.close?.());
  els.createRestBtn?.addEventListener('click', createRestaurant);
  els.saveSettings?.addEventListener('click', saveActiveRestaurant);

  els.logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('foody_restaurant');
    localStorage.setItem('foody_skip_autologin','1');
    location.reload();
  });
  els.loginBtn?.addEventListener('click', async () => {
    localStorage.removeItem('foody_skip_autologin');
    try {
      const d = await whoami();
      restaurant = { id: d.restaurant_id, name: d.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await reloadAll();
    } catch { openSettings(); }
  });

  els.search?.addEventListener('input', loadOffers);
  els.resFilter?.addEventListener('change', loadReservations);
  els.addFloating?.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); els.title?.focus?.(); });

  // --- 9) Старт --------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    // Быстрый health-пинг — чисто для диагностики (необязательно)
    fetchJSON(`${API}/health`).then(r => {
      if (!r.ok) console.warn('Health check failed', r);
    });
  });

  autologin();
})();
