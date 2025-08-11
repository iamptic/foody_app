// Foody LK — create restaurant robust, CORS diagnostics, improved tips
(() => {
  const urlApi = new URLSearchParams(location.search).get('api');
  if (urlApi) localStorage.setItem('foody_api', urlApi);
  const API = urlApi || localStorage.getItem('foody_api') || 'http://localhost:8000';

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href$="onboarding.html"]').forEach(a => a.href = `./onboarding.html?api=${encodeURIComponent(API)}`);
  });

  const els = {
    restInfo: document.getElementById('restInfo'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    createForm: document.getElementById('createForm'),
    title: document.getElementById('title'), desc: document.getElementById('desc'),
    price: document.getElementById('price'), qty: document.getElementById('qty'),
    expires: document.getElementById('expires'), photo: document.getElementById('photo'),
    offers: document.getElementById('offers'), empty: document.getElementById('empty'),
    search: document.getElementById('search'),
    resTable: document.getElementById('resTable')?.querySelector('tbody'),
    resFilter: document.getElementById('resFilter'),
    resEmpty: document.getElementById('resEmpty'), addFloating: document.getElementById('addFloating'),
    profileBanner: document.getElementById('profileBanner'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'), restSelect: document.getElementById('restSelect'),
    settingsClose: document.getElementById('settingsClose'),
    newRestName: document.getElementById('newRestName'), createRestBtn: document.getElementById('createRestBtn'),
    saveSettings: document.getElementById('saveSettings'),
    tipsCallout: document.getElementById('tipsCallout'),
  };

  let restaurant = null;
  try { restaurant = JSON.parse(localStorage.getItem('foody_restaurant')||'null'); } catch {}

  const toast = (msg) => {
    let node = document.getElementById('toast');
    if (!node) { node = document.createElement('div'); node.id='toast'; node.className='toast'; document.body.appendChild(node); }
    node.textContent = msg; node.classList.remove('hidden');
    setTimeout(()=>node.classList.add('hidden'), 2600);
  };
  const fmtDT = (s) => { try { return new Date(s).toLocaleString('ru-RU',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});} catch { return s||'—'; } };
  const money = (v) => new Intl.NumberFormat('ru-RU').format(v) + ' ₽';

  // --- Diagnostics helper for fetch ---
  async function fetchJSON(input, init){
    try{
      const res = await fetch(input, init);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')){
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      } else {
        const text = await res.text();
        return { ok: res.ok, status: res.status, data: { text } };
      }
    }catch(e){
      return { ok:false, status:0, data:{ error: (e && e.message) ? e.message : 'network_error' } };
    }
  }

  // --- API helpers ---
  async function whoami(){
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) throw 0;
    const r = await fetch(`${API}/whoami?telegram_id=${u.id}`);
    if (!r.ok) throw 0;
    return r.json();
  }

  async function fetchProfile(){
    const r = await fetch(`${API}/restaurant/${restaurant.id}`);
    if(!r.ok) throw 0;
    return r.json();
  }

  async function checkProfileAndStatus(){
    try{
      const p = await fetchProfile();
      const city = p.city ? `, ${p.city}` : '';
      els.restInfo.textContent = `Вы вошли как: ${restaurant.name}${city} (id ${restaurant.id})`;
      const incomplete = !(p.phone && p.address && p.city);
      els.profileBanner.style.display = incomplete ? 'flex' : 'none';
    }catch{
      els.restInfo.textContent = `Ресторан id ${restaurant?.id||'—'}`;
    }
  }

  // --- Offers ---
  async function loadOffers(){
    try{
      const r = await fetch(`${API}/offers`);
      const list = await r.json();
      const my = (restaurant?.id) ? list.filter(o => o.restaurant_id === restaurant.id) : [];
      renderOffers(my);
    }catch{}
  }

  function renderOffers(items){
    els.offers.innerHTML='';
    let arr = items;
    const q = (els.search.value||'').toLowerCase();
    if(q) arr = arr.filter(o => (o.title||'').toLowerCase().includes(q));
    if(!arr.length){ els.empty.classList.remove('hidden'); return; } else els.empty.classList.add('hidden');
    for(const o of arr){
      const img = o.photo_url ? `<div style="margin:6px 0"><img src="${o.photo_url}" alt="" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px"/></div>` : '';
      const card = document.createElement('div');
      card.className='card-item';
      card.innerHTML = `
        <div><b>${o.title}</b></div>
        ${img}
        <div class="meta">До: ${fmtDT(o.expires_at)} • Остаток: ${o.quantity}</div>
        <div><b>${money(o.price)}</b></div>
        <div class="actions">
          <button class="btn" data-edit="${o.id}">Редактировать</button>
          <button class="btn" data-del="${o.id}">Удалить</button>
        </div>`;
      card.querySelector('[data-edit]').onclick = () => openEdit(o);
      card.querySelector('[data-del]').onclick = () => delOffer(o.id);
      els.offers.appendChild(card);
    }
  }

  async function delOffer(id){
    if(!confirm('Удалить предложение?')) return;
    try{
      const r = await fetch(`${API}/offers/${id}`, { method:'DELETE' });
      if(r.ok){ toast('Удалено'); await loadOffers(); } else toast('Не удалось удалить');
    }catch{ toast('Ошибка сети'); }
  }

  // --- Edit modal ---
  const modal = document.getElementById('editModal');
  const ef = document.getElementById('editForm');
  const eId = document.getElementById('editId');
  const eTitle = document.getElementById('editTitle');
  const eDesc = document.getElementById('editDesc');
  const ePrice = document.getElementById('editPrice');
  const eQty = document.getElementById('editQty');
  const eExp = document.getElementById('editExpires');
  const ePhoto = document.getElementById('editPhoto');

  function openEdit(o){
    eId.value = o.id;
    eTitle.value = o.title || '';
    eDesc.value = o.description || '';
    ePrice.value = o.price;
    eQty.value = o.quantity;
    try { const d = new Date(o.expires_at); eExp.value = d.toISOString().slice(0,16); } catch {}
    ePhoto.value = null;
    modal.showModal();
  }
  document.getElementById('editClose').onclick = ()=> modal.close();

  async function uploadFile(file){
    if(!file) return null;
    // Try presigned first
    try{
      const init = await fetch(`${API}/upload_init`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ filename: file.name, content_type: file.type || 'image/jpeg' })
      });
      if (init.ok){
        const info = await init.json();
        await fetch(info.upload_url, { method:'PUT', headers:info.headers || {'Content-Type': file.type || 'image/jpeg'}, body:file });
        return info.public_url;
      }
    }catch{ /* fall back */ }
    // Fallback direct upload
    try{
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch(`${API}/upload`, { method:'POST', body: fd });
      if (r.ok){ const d = await r.json(); return d.url || null; }
    }catch{}
    return null;
  }

  ef.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = Number(eId.value);
    const payload = {
      title: eTitle.value.trim() || undefined,
      description: eDesc.value.trim() || undefined,
      price: ePrice.value ? Number(ePrice.value) : undefined,
      quantity: eQty.value ? Number(eQty.value) : undefined,
      expires_at: eExp.value ? new Date(eExp.value).toISOString() : undefined,
    };
    const file = ePhoto.files?.[0];
    if (file){
      const url = await uploadFile(file);
      if (url) payload.photo_url = url;
      else toast('Фото не загружено');
    }
    try{
      const r = await fetch(`${API}/offers/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(r.ok){ toast('Сохранено'); modal.close(); await loadOffers(); } else { const t = await r.text(); toast('Ошибка: ' + t); }
    }catch{ toast('Ошибка сети'); }
  });

  // --- Create offer ---
  async function uploadCreatePhoto(){
    const f = els.photo?.files?.[0];
    if(!f) return null;
    return await uploadFile(f);
  }

  els.createForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if(!restaurant?.id) return toast('Нет ресторана');
    const photo_url = await uploadCreatePhoto();
    const payload = {
      restaurant_id: restaurant.id,
      title: els.title.value.trim(),
      description: els.desc.value.trim() || null,
      price: Number(els.price.value),
      quantity: Number(els.qty.value),
      expires_at: els.expires.value ? new Date(els.expires.value).toISOString() : null,
      photo_url: photo_url || null
    };
    try{
      const r = await fetch(`${API}/offers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(r.ok){ toast('Добавлено'); els.createForm.reset(); await loadOffers(); }
      else { const t = await r.text(); toast('Ошибка: ' + t); }
    }catch{ toast('Ошибка сети'); }
  });

  // --- Reservations ---
  async function loadReservations(){
    if(!els.resTable) return;
    try{
      const r = await fetch(`${API}/restaurant_reservations/${restaurant.id}`);
      const list = await r.json();
      renderReservations(list);
    }catch{}
  }
  function renderReservations(list){
    const tbody = els.resTable; tbody.innerHTML='';
    const filter = els.resFilter.value;
    let arr = list;
    if(filter!=='all') arr = arr.filter(x => x.status === filter);
    if(!arr.length){ els.resEmpty.classList.remove('hidden'); return;} else els.resEmpty.classList.add('hidden');
    for(const x of arr){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${x.code}</td><td>${x.offer_title}</td><td>${x.buyer_name||'—'}</td>
                      <td>${x.status}</td><td>${fmtDT(x.expires_at)}</td><td>${fmtDT(x.created_at)}</td>`;
      tbody.appendChild(tr);
    }
  }

  // --- Settings ---
  async function openSettings(){
    await populateRestList();
    els.settingsModal.showModal();
  }
  async function populateRestList(){
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    els.restSelect.innerHTML = '';
    if (restaurant?.id) {
      const opt = document.createElement('option');
      opt.value = restaurant.id; opt.textContent = `${restaurant.name} (id ${restaurant.id})`;
      opt.selected = true; els.restSelect.appendChild(opt);
    }
    if(!u) return;
    try {
      const r = await fetch(`${API}/my_restaurants?telegram_id=${u.id}`);
      const list = await r.json();
      for(const x of list){
        const exists = Array.from(els.restSelect.options).some(o => Number(o.value)===x.id);
        if (!exists) {
          const opt = document.createElement('option');
          opt.value = x.id; opt.textContent = `${x.restaurant_name} (id ${x.id})`;
          els.restSelect.appendChild(opt);
        }
      }
    } catch {}
  }

  // Create restaurant with diagnostics
  els.createRestBtn?.addEventListener('click', async (ev) => {
    ev.preventDefault();
    const name = (els.newRestName.value || '').trim() || 'Мой ресторан';
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if(!u){ toast('Откройте из Telegram'); return; }
    els.createRestBtn.disabled = true;
    const res = await fetchJSON(`${API}/register_telegram?force_new=true`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, telegram_id: String(u.id) })
    });
    if (!res.ok){
      const msg = (res.data && (res.data.detail || res.data.text || res.data.error)) ? String(res.data.detail || res.data.text || res.data.error) : 'Ошибка';
      toast('Не удалось создать: ' + msg);
      // CORS hint
      if (res.status === 0){
        els.tipsCallout.style.display = 'block';
        els.tipsCallout.textContent = 'Похоже, сервер недоступен или домен Mini App не добавлен в CORS_ORIGINS на бэкенде.';
      }
      els.createRestBtn.disabled = false;
      return;
    }
    const data = res.data || {};
    if (data.restaurant_id){
      restaurant = { id: data.restaurant_id, name: data.restaurant_name || name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      try { await fetch(`${API}/set_active_restaurant?telegram_id=${u.id}&restaurant_id=${restaurant.id}`, { method:'POST' }); } catch {}
      els.settingsModal.close();
      await reloadAll();
      toast(`Создан «${restaurant.name}» и выбран активным`);
    } else {
      toast('Не удалось создать (пустой ответ)');
    }
    els.createRestBtn.disabled = false;
  });

  // Save settings (switch active restaurant robust)
  els.saveSettings?.addEventListener('click', async () => {
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const rid = parseInt(els.restSelect.value || '0', 10);
    if (!u || !rid) { els.settingsModal.close(); return; }
    els.saveSettings.disabled = true;
    try {
      await fetch(`${API}/set_active_restaurant?telegram_id=${u.id}&restaurant_id=${rid}`, { method:'POST' });
      // fetch restaurant to get canonical name
      try{
        const r = await fetch(`${API}/restaurant/${rid}`);
        if (r.ok){
          const p = await r.json();
          restaurant = { id: rid, name: p.restaurant_name || `Ресторан ${rid}` };
        } else {
          restaurant = { id: rid, name: `Ресторан ${rid}` };
        }
      } catch { restaurant = { id: rid, name: `Ресторан ${rid}` }; }
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      els.settingsModal.close();
      await reloadAll();
      toast('Активный ресторан обновлён');
    } catch {
      toast('Ошибка сети');
    } finally {
      els.saveSettings.disabled = false;
    }
  });

  // Settings close (X)
  document.getElementById('settingsClose')?.addEventListener('click', () => els.settingsModal.close());

  // --- Auth / Logout ---
  els.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('foody_restaurant');
    localStorage.setItem('foody_skip_autologin', '1');
    location.reload();
  });
  els.loginBtn.addEventListener('click', async () => {
    localStorage.removeItem('foody_skip_autologin');
    try {
      const d = await whoami();
      restaurant = { id: d.restaurant_id, name: d.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await reloadAll();
    } catch { openSettings(); }
  });

  async function reloadAll(){
    await Promise.all([checkProfileAndStatus(), loadOffers(), loadReservations()]);
  }

  // Dynamic tips: show CORS hint if needed, show profile tip if not completed
  async function dynamicTips(){
    try{
      if (!restaurant?.id) return;
      const p = await fetchProfile();
      if (!(p.phone && p.address && p.city)){
        els.tipsCallout.style.display = 'block';
        els.tipsCallout.textContent = 'Заполните профиль (телефон, адрес, город), чтобы предложения стали видимы покупателям.';
      }
    }catch{}
  }

  async function init(){
    if (restaurant?.id){ await reloadAll(); dynamicTips(); return; }
    const skip = localStorage.getItem('foody_skip_autologin') === '1';
    if (skip){
      els.restInfo.textContent = 'Вы вышли. Откройте «Настройки», чтобы выбрать ресторан, или нажмите «Войти».';
      els.loginBtn.style.display = 'inline-flex';
      return;
    }
    try{
      const d = await whoami();
      restaurant = { id: d.restaurant_id, name: d.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await reloadAll();
      dynamicTips();
    }catch{
      els.restInfo.textContent = 'Нет привязки к ресторану. Откройте «Настройки», создайте или выберите ресторан.';
      els.loginBtn.style.display = 'inline-flex';
    }
  }

  document.getElementById('settingsBtn')?.addEventListener('click', openSettings);
  document.getElementById('search')?.addEventListener('input', ()=>loadOffers());
  document.getElementById('resFilter')?.addEventListener('change', ()=>loadReservations());
  document.getElementById('addFloating')?.addEventListener('click', ()=>{ window.scrollTo({top:0, behavior:'smooth'}); document.getElementById('title').focus(); });

  init();
})();
