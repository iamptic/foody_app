/* Foody webapp: buyer + merchant */
(() => {
  // ---- helpers ----
  const $ = (id) => document.getElementById(id);
  const els = {
    // tabs
    tabBuyer: $('tabBuyer'), tabMerchant: $('tabMerchant'),
    buyerView: $('buyerView'), merchantView: $('merchantView'),
    // buyer
    citySelect: $('citySelect'), refreshBuyer: $('refreshBuyer'),
    buyerList: $('buyerList'), buyerEmpty: $('buyerEmpty'),
    // merchant top
    restInfo: $('restInfo'), profileBanner: $('profileBanner'),
    settingsBtn: $('settingsBtn'), settingsBtn2: $('settingsBtn2'),
    loginBtn: $('loginBtn'), logoutBtn: $('logoutBtn'),
    // settings modal
    settingsModal: $('settingsModal'), settingsClose: $('settingsClose'),
    restSelect: $('restSelect'), saveSettings: $('saveSettings'),
    newRestName: $('newRestName'), createRestBtn: $('createRestBtn'),
    tipsCallout: $('tipsCallout'),
    // offers
    createForm: $('createForm'), title: $('title'), desc: $('desc'),
    price: $('price'), qty: $('qty'), expires: $('expires'), photo: $('photo'),
    offers: $('offers'), empty: $('empty'), search: $('search'),
    // reservations
    resFilter: $('resFilter'), resTable: $('resTable')?.querySelector('tbody'),
    resEmpty: $('resEmpty'),
    // edit
    editModal: $('editModal'), editForm: $('editForm'), editClose: $('editClose'),
    editId: $('editId'), editTitle: $('editTitle'), editDesc: $('editDesc'),
    editPrice: $('editPrice'), editQty: $('editQty'), editExpires: $('editExpires'),
    editPhoto: $('editPhoto'),
    // misc
    addFloating: $('addFloating'),
    toast: $('toast')
  };

  const API = (window.FOODY_API || '').replace(/\/+$/,'');
  const TG_USER = window.Telegram?.WebApp?.initDataUnsafe?.user || null;

  const toast = (msg) => {
    if (!els.toast) return alert(msg);
    els.toast.textContent = msg;
    els.toast.classList.remove('hidden');
    setTimeout(() => els.toast.classList.add('hidden'), 2600);
    try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.('success'); } catch(e){}
  };

  const setBusy = (node, busy=true) => {
    if (!node) return;
    node.disabled = !!busy;
    if (busy) node.setAttribute('aria-busy','true'); else node.removeAttribute('aria-busy');
  };

  const fmtDT = (s) => { try { return new Date(s).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});} catch { return s||'—'; } };
  const money = (v) => new Intl.NumberFormat('ru-RU').format(v) + ' ₽';

  async function fetchJSON(url, init){
    try {
      const r = await fetch(url, init);
      const ct = r.headers.get('content-type')||'';
      const data = ct.includes('application/json') ? await r.json().catch(()=> ({})) : await r.text();
      return { ok:r.ok, status:r.status, data };
    } catch (e) {
      return { ok:false, status:0, data:{ detail: e?.message || 'failed to fetch' } };
    }
  }

  // ---- tabs ----
  function switchTab(tab){
    if (tab==='buyer'){
      els.tabBuyer.classList.add('active'); els.tabMerchant.classList.remove('active');
      els.buyerView.classList.remove('hidden'); els.merchantView.classList.add('hidden');
      localStorage.setItem('foody_tab','buyer');
    } else {
      els.tabMerchant.classList.add('active'); els.tabBuyer.classList.remove('active');
      els.merchantView.classList.remove('hidden'); els.buyerView.classList.add('hidden');
      localStorage.setItem('foody_tab','merchant');
    }
  }
  els.tabBuyer?.addEventListener('click', ()=>switchTab('buyer'));
  els.tabMerchant?.addEventListener('click', ()=>switchTab('merchant'));

  // ---- buyer view ----
  async function loadCities(){
    const r = await fetchJSON(`${API}/config`);
    if (r.ok && r.data?.cities){
      els.citySelect.innerHTML = '';
      for (const c of r.data.cities){
        const opt = new Option(c, c);
        els.citySelect.add(opt);
      }
      const saved = localStorage.getItem('foody_city');
      if (saved && [...els.citySelect.options].some(o=>o.value===saved)){
        els.citySelect.value = saved;
      } else if (r.data.cities.includes('Томск')) {
        els.citySelect.value = 'Томск';
      }
    }
  }

  function renderBuyerOffers(items){
    const city = els.citySelect.value;
    localStorage.setItem('foody_city', city);
    els.buyerList.innerHTML='';
    let arr = Array.isArray(items) ? items : [];
    if (!arr.length){ els.buyerEmpty.classList.remove('hidden'); return; }
    els.buyerEmpty.classList.add('hidden');
    for (const o of arr){
      const card = document.createElement('div');
      card.className='card-item';
      card.innerHTML = `
        <div><b>${o.title}</b></div>
        ${o.photo_url ? `<div><img src="${o.photo_url}" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px"></div>`:''}
        <div class="meta">${o.restaurant}</div>
        <div class="meta">До: ${fmtDT(o.expires_at)} • Остаток: ${o.quantity}</div>
        <div><b>${money(o.price)}</b></div>
        <div class="row">
          <input type="number" min="1" max="${o.quantity}" value="1" style="width:80px" id="qty_${o.id}">
          <input type="text" placeholder="Ваше имя" style="flex:1" id="name_${o.id}">
          <button class="btn" data-reserve="${o.id}">Забронировать</button>
        </div>
      `;
      card.querySelector('[data-reserve]').onclick = async () => {
        const qty = Math.max(1, Number(card.querySelector(`#qty_${o.id}`).value||1));
        const buyer_name = (card.querySelector(`#name_${o.id}`).value||'').trim() || null;
        const rr = await fetchJSON(`${API}/reserve`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ offer_id:o.id, qty, buyer_name })
        });
        if (rr.ok){
          toast(`Бронь ${rr.data.code}: держим ${qty} шт.`);
          await refreshBuyer();
        } else {
          toast(`Ошибка брони: ${typeof rr.data==='string'? rr.data : rr.data?.detail || rr.status}`);
        }
      };
      els.buyerList.appendChild(card);
    }
  }

  async function refreshBuyer(){
    const city = els.citySelect.value || '';
    const url = city ? `${API}/offers?city=${encodeURIComponent(city)}` : `${API}/offers`;
    const r = await fetchJSON(url);
    if (r.ok) renderBuyerOffers(r.data);
    else toast('Ошибка загрузки предложений');
  }

  els.citySelect?.addEventListener('change', refreshBuyer);
  els.refreshBuyer?.addEventListener('click', refreshBuyer);

  // ---- merchant view ----
  let restaurant = null;
  try{ restaurant = JSON.parse(localStorage.getItem('foody_restaurant')||'null'); }catch{}

  async function whoami(){
    if (!TG_USER) throw new Error('not_in_telegram');
    const r = await fetchJSON(`${API}/whoami?telegram_id=${TG_USER.id}`);
    if (!r.ok) throw new Error(r.data?.detail || `whoami_${r.status}`);
    return r.data;
  }

  async function autologin(){
    const skip = localStorage.getItem('foody_skip_autologin')==='1';
    if (restaurant?.id){ await reloadAll(); return; }
    if (skip){ els.restInfo.textContent='Вы вышли. Откройте «Настройки», чтобы выбрать ресторан, или «Войти».'; els.loginBtn.classList.remove('hidden'); return; }
    try{
      const d = await whoami();
      restaurant = { id:d.restaurant_id, name:d.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await reloadAll();
    }catch{
      els.restInfo.textContent='Нет привязки к ресторану. Откройте «Настройки», создайте или выберите ресторан.';
      els.loginBtn.classList.remove('hidden');
    }
  }

  async function checkProfileAndStatus(){
    if (!restaurant?.id) return;
    const r = await fetchJSON(`${API}/restaurant/${restaurant.id}`);
    if (r.ok){
      const p = r.data;
      const city = p.city ? `, ${p.city}` : '';
      els.restInfo.textContent = `Вы вошли как: ${restaurant.name}${city} (id ${restaurant.id})`;
      const incomplete = !(p.phone && p.address && p.city);
      els.profileBanner.classList.toggle('hidden', !incomplete);
    }
  }

  async function populateRestList(){
    els.restSelect.innerHTML='';
    if (restaurant?.id){
      els.restSelect.add(new Option(`${restaurant.name} (id ${restaurant.id})`, restaurant.id, true, true));
    }
    if (!TG_USER) return;
    const r = await fetchJSON(`${API}/my_restaurants?telegram_id=${TG_USER.id}`);
    if (r.ok && Array.isArray(r.data)){
      for (const x of r.data){
        if (![...els.restSelect.options].some(o=>Number(o.value)===x.id)){
          els.restSelect.add(new Option(`${x.restaurant_name} (id ${x.id})`, x.id));
        }
      }
    }
  }
  async function openSettings(){ await populateRestList(); els.settingsModal.showModal(); }
  els.settingsBtn?.addEventListener('click', openSettings);
  els.settingsBtn2?.addEventListener('click', openSettings);
  els.settingsClose?.addEventListener('click', ()=>els.settingsModal.close());

  async function saveActiveRestaurant(){
    if (!TG_USER) return;
    const rid = parseInt(els.restSelect.value||'0',10);
    if (!rid) return els.settingsModal.close();
    setBusy(els.saveSettings,true);
    await fetchJSON(`${API}/set_active_restaurant?telegram_id=${TG_USER.id}&restaurant_id=${rid}`, { method:'POST' });
    const prof = await fetchJSON(`${API}/restaurant/${rid}`);
    const name = prof.ok ? (prof.data.restaurant_name || `Ресторан ${rid}`) : `Ресторан ${rid}`;
    restaurant = { id: rid, name };
    localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
    setBusy(els.saveSettings,false);
    els.settingsModal.close();
    await reloadAll();
    toast('Активный ресторан обновлён');
  }
  els.saveSettings?.addEventListener('click', saveActiveRestaurant);

  async function createRestaurant(){
    if (!TG_USER) return toast('Откройте Mini App из Telegram');
    const name = (els.newRestName.value||'').trim() || 'Мой ресторан';
    setBusy(els.createRestBtn,true);
    const r = await fetchJSON(`${API}/register_telegram?force_new=true`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, telegram_id: String(TG_USER.id) })
    });
    setBusy(els.createRestBtn,false);
    if (!r.ok){
      const msg = typeof r.data==='string' ? r.data : (r.data?.detail || 'Ошибка');
      if (els.tipsCallout && r.status===0){
        els.tipsCallout.classList.remove('hidden');
        els.tipsCallout.textContent = 'Сервер недоступен или домен MiniApp не в CORS_ORIGINS на бэкенде.';
      }
      return toast('Не удалось создать: ' + msg);
    }
    const data = r.data||{};
    if (data.restaurant_id){
      restaurant = { id:data.restaurant_id, name:data.restaurant_name || name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await fetchJSON(`${API}/set_active_restaurant?telegram_id=${TG_USER.id}&restaurant_id=${restaurant.id}`, { method:'POST' });
      els.settingsModal.close();
      await reloadAll();
      toast(`Создан «${restaurant.name}»`);
    } else {
      toast('Не удалось создать (пустой ответ)');
    }
  }
  els.createRestBtn?.addEventListener('click', createRestaurant);

  async function uploadFile(file){
    if (!file) return null;
    try {
      const init = await fetchJSON(`${API}/upload_init`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ filename:file.name, content_type: file.type||'image/jpeg' })
      });
      if (init.ok && init.data?.upload_url){
        await fetch(init.data.upload_url, { method:'PUT', headers: init.data.headers || {'Content-Type': file.type||'image/jpeg'}, body:file });
        return init.data.public_url;
      }
    } catch {}
    // fallback
    try {
      const fd = new FormData(); fd.append('file', file);
      const up = await fetchJSON(`${API}/upload`, { method:'POST', body: fd });
      if (up.ok && up.data?.url) return up.data.url;
    } catch {}
    return null;
  }

  function renderOffers(items){
    els.offers.innerHTML='';
    let arr = Array.isArray(items) ? items : [];
    const q = (els.search?.value||'').toLowerCase();
    if (q) arr = arr.filter(o => (o.title||'').toLowerCase().includes(q));
    if (!arr.length){ els.empty.classList.remove('hidden'); return; }
    els.empty.classList.add('hidden');
    for (const o of arr){
      const wrap = document.createElement('div');
      wrap.className='card-item';
      wrap.innerHTML = `
        <div><b>${o.title}</b></div>
        ${o.photo_url ? `<div><img src="${o.photo_url}" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px"></div>`:''}
        <div class="meta">До: ${fmtDT(o.expires_at)} • Остаток: ${o.quantity}</div>
        <div><b>${money(o.price)}</b></div>
        <div class="actions">
          <button class="btn" data-edit="${o.id}">Редактировать</button>
          <button class="btn danger" data-del="${o.id}">Удалить</button>
        </div>
      `;
      wrap.querySelector('[data-edit]').onclick = () => openEdit(o);
      wrap.querySelector('[data-del]').onclick = () => delOffer(o.id);
      els.offers.appendChild(wrap);
    }
  }

  async function loadOffers(){
    const r = await fetchJSON(`${API}/offers`);
    if (!r.ok) return;
    const my = restaurant?.id ? r.data.filter(x => x.restaurant_id === restaurant.id) : [];
    renderOffers(my);
  }

  async function delOffer(id){
    if (!confirm('Удалить предложение?')) return;
    const r = await fetchJSON(`${API}/offers/${id}`, { method:'DELETE' });
    if (r.ok){ toast('Удалено'); await loadOffers(); } else toast('Не удалось удалить');
  }

  els.createForm?.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    if (!restaurant?.id) return toast('Нет ресторана');
    const btn = els.createForm.querySelector('button[type="submit"]');
    setBusy(btn,true);
    const photo_url = els.photo?.files?.[0] ? await uploadFile(els.photo.files[0]) : null;
    const payload = {
      restaurant_id: restaurant.id,
      title: els.title.value.trim(),
      description: (els.desc.value||'').trim()||null,
      price: Number(els.price.value||0),
      quantity: Number(els.qty.value||0),
      expires_at: els.expires.value ? new Date(els.expires.value).toISOString() : null,
      photo_url
    };
    const r = await fetchJSON(`${API}/offers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    setBusy(btn,false);
    if (r.ok){ toast('Добавлено'); els.createForm.reset(); await loadOffers(); } else { toast('Ошибка: ' + (typeof r.data==='string'?r.data:(r.data?.detail||r.status))); }
  });

  // edit
  const e = { modal: els.editModal, form: els.editForm, close: els.editClose, id: els.editId, title: els.editTitle, desc: els.editDesc, price: els.editPrice, qty: els.editQty, exp: els.editExpires, photo: els.editPhoto };
  function openEdit(o){
    e.id.value=o.id; e.title.value=o.title||''; e.desc.value=o.description||''; e.price.value=o.price; e.qty.value=o.quantity;
    try{ e.exp.value=new Date(o.expires_at).toISOString().slice(0,16); }catch{}
    e.photo.value=null;
    e.modal.showModal();
  }
  e.close?.addEventListener('click', ()=>e.modal.close());
  e.form?.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const id = Number(e.id.value);
    const payload = {
      title: e.title.value.trim() || undefined,
      description: e.desc.value.trim() || undefined,
      price: e.price.value ? Number(e.price.value) : undefined,
      quantity: e.qty.value ? Number(e.qty.value) : undefined,
      expires_at: e.exp.value ? new Date(e.exp.value).toISOString() : undefined
    };
    if (e.photo?.files?.[0]){
      const url = await uploadFile(e.photo.files[0]);
      if (url) payload.photo_url = url;
    }
    const r = await fetchJSON(`${API}/offers/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    if (r.ok){ toast('Сохранено'); e.modal.close(); await loadOffers(); } else toast('Ошибка: ' + (typeof r.data==='string'?r.data:(r.data?.detail||r.status)));
  });

  // reservations
  function renderReservations(list){
    if (!els.resTable) return;
    els.resTable.innerHTML='';
    const filter = els.resFilter?.value || 'all';
    let arr = Array.isArray(list) ? list : [];
    if (filter!=='all') arr = arr.filter(x => x.status === filter);
    if (!arr.length){ els.resEmpty.classList.remove('hidden'); return; }
    els.resEmpty.classList.add('hidden');
    for (const x of arr){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${x.code}</td><td>${x.offer_title}</td><td>${x.buyer_name||'—'}</td><td>${x.status}</td><td>${fmtDT(x.expires_at)}</td><td>${fmtDT(x.created_at)}</td>`;
      els.resTable.appendChild(tr);
    }
  }
  async function loadReservations(){
    if (!restaurant?.id || !els.resTable) return;
    const r = await fetchJSON(`${API}/restaurant_reservations/${restaurant.id}`);
    if (r.ok) renderReservations(r.data);
  }
  els.resFilter?.addEventListener('change', loadReservations);

  // misc
  els.logoutBtn?.addEventListener('click', ()=>{
    localStorage.removeItem('foody_restaurant');
    localStorage.setItem('foody_skip_autologin','1');
    location.reload();
  });
  els.loginBtn?.addEventListener('click', async ()=>{
    localStorage.removeItem('foody_skip_autologin');
    try{
      const d = await whoami();
      restaurant = { id:d.restaurant_id, name:d.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await reloadAll();
    }catch{ openSettings(); }
  });
  els.addFloating?.addEventListener('click', ()=>{ window.scrollTo({top:0,behavior:'smooth'}); els.title?.focus?.(); });
  els.search?.addEventListener('input', loadOffers);

  async function reloadAll(){
    await Promise.allSettled([checkProfileAndStatus(), loadOffers(), loadReservations()]);
  }

  async function init(){
    // tab init
    switchTab(localStorage.getItem('foody_tab') || 'buyer');
    await loadCities();
    await refreshBuyer();
    // merchant init
    await autologin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();