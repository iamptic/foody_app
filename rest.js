// LK logic with photo upload fallback, settings fixes, and no timezone in profile
(() => {
  const API = new URLSearchParams(location.search).get('api') || 'http://localhost:8000';

  const els = {
    restInfo: document.getElementById('restInfo'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    createForm: document.getElementById('createForm'),
    title: document.getElementById('title'), desc: document.getElementById('desc'),
    price: document.getElementById('price'), qty: document.getElementById('qty'),
    expires: document.getElementById('expires'), photo: document.getElementById('photo'),
    offers: document.getElementById('offers'), empty: document.getElementById('empty'),
    search: document.getElementById('search'), reloadOffers: document.getElementById('reloadOffers'),
    resTable: document.getElementById('resTable')?.querySelector('tbody'),
    resFilter: document.getElementById('resFilter'), resRefresh: document.getElementById('resRefresh'),
    resEmpty: document.getElementById('resEmpty'), addFloating: document.getElementById('addFloating'),
    toast: document.getElementById('toast'), profileBanner: document.getElementById('profileBanner'),
    refreshBtn: document.getElementById('refreshBtn'), settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'), restSelect: document.getElementById('restSelect'),
    newRestName: document.getElementById('newRestName'), createRestBtn: document.getElementById('createRestBtn'),
    saveSettings: document.getElementById('saveSettings'),
  };

  let restaurant = null;
  try { restaurant = JSON.parse(localStorage.getItem('foody_restaurant')||'null'); } catch {}

  const toast = (msg) => { els.toast.textContent = msg; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'), 2000); };
  const fmtDT = (s) => { try { return new Date(s).toLocaleString('ru-RU',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});} catch { return s||'—'; } };
  const money = (v) => new Intl.NumberFormat('ru-RU').format(v) + ' ₽';

  async function whoami(){
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) throw 0;
    const r = await fetch(`${API}/whoami?telegram_id=${u.id}`);
    if (!r.ok) throw 0;
    return r.json();
  }

  async function autoLink(){
    try{
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if(!u || !restaurant?.id) return;
      await fetch(`${API}/set_active_restaurant?telegram_id=${u.id}&restaurant_id=${restaurant.id}`, { method:'POST' });
    }catch{}
  }

  async function checkProfileAndStatus(){
    try{
      const r = await fetch(`${API}/restaurant/${restaurant.id}`);
      if(!r.ok) throw 0;
      const p = await r.json();
      const city = p.city ? `, ${p.city}` : '';
      els.restInfo.textContent = `Вы вошли как: ${restaurant.name}${city} (id ${restaurant.id})`;
      const incomplete = !(p.phone && p.address && p.city);
      els.profileBanner.style.display = incomplete ? 'flex' : 'none';
    }catch{
      els.restInfo.textContent = `Ресторан id ${restaurant?.id||'—'}`;
    }
  }

  async function loadOffers(){
    try{
      const r = await fetch(`${API}/offers`);
      const list = await r.json();
      const my = (restaurant?.id) ? list.filter(o => o.restaurant_id === restaurant.id) : [];
      renderOffers(my);
    }catch{ toast('Ошибка загрузки офферов'); }
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
      if(r.ok){ toast('Удалено'); loadOffers(); } else toast('Не удалось удалить');
    }catch{ toast('Ошибка сети'); }
  }

  // Edit modal
  const modal = document.getElementById('editModal');
  const ef = document.getElementById('editForm');
  const eId = document.getElementById('editId');
  const eTitle = document.getElementById('editTitle');
  const eDesc = document.getElementById('editDesc');
  const ePrice = document.getElementById('editPrice');
  const eQty = document.getElementById('editQty');
  const eExp = document.getElementById('editExpires');

  function openEdit(o){
    eId.value = o.id;
    eTitle.value = o.title || '';
    eDesc.value = o.description || '';
    ePrice.value = o.price;
    eQty.value = o.quantity;
    try { const d = new Date(o.expires_at); eExp.value = d.toISOString().slice(0,16); } catch {}
    modal.showModal();
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
    try{
      const r = await fetch(`${API}/offers/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if(r.ok){ toast('Сохранено'); modal.close(); loadOffers(); } else { const t = await r.text(); toast('Ошибка: ' + t); }
    }catch{ toast('Ошибка сети'); }
  });

  async function uploadPhoto(){
    const f = els.photo?.files?.[0];
    if(!f) return null;
    // try s3 presign first
    try{
      const init = await fetch(`${API}/upload_init`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ filename: f.name, content_type: f.type || 'image/jpeg' })
      });
      if (init.ok){
        const initData = await init.json();
        await fetch(initData.upload_url, { method:'PUT', headers:initData.headers || {'Content-Type': f.type || 'image/jpeg'}, body:f });
        return initData.public_url;
      }
    }catch{}
    // fallback /upload
    try{
      const fd = new FormData(); fd.append('file', f);
      const r = await fetch(`${API}/upload`, { method:'POST', body: fd });
      const d = await r.json();
      if(d.url) return d.url;
    }catch{}
    toast('Фото не загружено');
    return null;
  }

  els.createForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if(!restaurant?.id) return toast('Нет ресторана');
    const photo_url = await uploadPhoto();
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
      if(r.ok){ toast('Добавлено'); els.createForm.reset(); loadOffers(); }
      else { const t = await r.text(); toast('Ошибка: ' + t); }
    }catch{ toast('Ошибка сети'); }
  });

  // Reservations list
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

  // ---------- Settings modal ----------
  async function openSettings(){
    await populateRestList();
    els.settingsModal.showModal();
  }
  async function populateRestList(){
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    els.restSelect.innerHTML = '';
    let addedActive = false;
    if (restaurant?.id) {
      const opt = document.createElement('option');
      opt.value = restaurant.id; opt.textContent = `${restaurant.name} (id ${restaurant.id})`;
      opt.selected = true; els.restSelect.appendChild(opt); addedActive = True;
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

  els.createRestBtn?.addEventListener('click', async () => {
    const name = (els.newRestName.value || '').trim() || 'Мой ресторан';
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if(!u) return toast('Откройте из Telegram');
    try {
      const r = await fetch(`${API}/register_telegram?force_new=true`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, telegram_id: String(u.id) })
      });
      const data = await r.json();
      if (r.ok) {
        restaurant = { id: data.restaurant_id, name: data.restaurant_name };
        localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
        await fetch(`${API}/set_active_restaurant?telegram_id=${u.id}&restaurant_id=${restaurant.id}`, { method:'POST' });
        toast('Создан и выбран активным');
        els.settingsModal.close();
        await reloadAll();
      } else { toast('Не удалось создать'); }
    } catch { toast('Ошибка сети'); }
  });

  els.saveSettings?.addEventListener('click', async () => {
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const rid = parseInt(els.restSelect.value || '0', 10);
    if (!u || !rid) { els.settingsModal.close(); return; }
    try {
      await fetch(`${API}/set_active_restaurant?telegram_id=${u.id}&restaurant_id=${rid}`, { method:'POST' });
      const label = els.restSelect.options[els.restSelect.selectedIndex].textContent;
      restaurant = { id: rid, name: label.split(' (id')[0] };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      toast('Активный ресторан обновлён');
      els.settingsModal.close();
      await reloadAll();
    } catch { toast('Ошибка сети'); }
  });

  els.settingsBtn.addEventListener('click', openSettings);

  // ---------- Auth ----------
  els.logoutBtn.addEventListener('click', () => { localStorage.removeItem('foody_restaurant'); location.reload(); });
  els.loginBtn.addEventListener('click', async () => {
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

  async function init(){
    if (restaurant?.id){ await reloadAll(); return; }
    try{
      const d = await whoami();
      restaurant = { id: d.restaurant_id, name: d.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await reloadAll();
    }catch{
      els.restInfo.textContent = 'Нет привязки к ресторану. Откройте «Настройки», создайте или выберите ресторан.';
      els.loginBtn.style.display = 'none';
      openSettings();
    }
  }

  document.getElementById('refreshBtn')?.addEventListener('click', ()=>reloadAll());
  document.getElementById('search')?.addEventListener('input', ()=>loadOffers());
  document.getElementById('reloadOffers')?.addEventListener('click', ()=>loadOffers());
  document.getElementById('resFilter')?.addEventListener('change', ()=>loadReservations());
  document.getElementById('resRefresh')?.addEventListener('click', ()=>loadReservations());
  document.getElementById('addFloating')?.addEventListener('click', ()=>{ window.scrollTo({top:0, behavior:'smooth'}); document.getElementById('title').focus(); });

  init();
})();
