// Foody Restaurant LK with offer CRUD + profile banner + autolink + logout-close
(() => {
  const urlp = new URLSearchParams(location.search);
  const API = urlp.get('api') || 'http://localhost:8000';

  const els = {
    restInfo: document.getElementById('restInfo'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    profileBanner: document.getElementById('profileBanner'),
    openOnboarding: document.getElementById('openOnboarding'),
    createForm: document.getElementById('createForm'),
    title: document.getElementById('title'),
    desc: document.getElementById('desc'),
    price: document.getElementById('price'),
    qty: document.getElementById('qty'),
    expires: document.getElementById('expires'),
    offers: document.getElementById('offers'),
    empty: document.getElementById('empty'),
    search: document.getElementById('search'),
    addFloating: document.getElementById('addFloating'),
    editModal: document.getElementById('editModal'),
    editForm: document.getElementById('editForm'),
    editId: document.getElementById('editId'),
    editTitle: document.getElementById('editTitle'),
    editDesc: document.getElementById('editDesc'),
    editPrice: document.getElementById('editPrice'),
    editQty: document.getElementById('editQty'),
    editExpires: document.getElementById('editExpires'),
    toast: document.getElementById('toast'),
  };

  const LOGOUT_KEY = 'foody_logged_out';
  const loggedOut = () => sessionStorage.getItem(LOGOUT_KEY) === '1';
  const setLoggedOut = (v) => v ? sessionStorage.setItem(LOGOUT_KEY, '1') : sessionStorage.removeItem(LOGOUT_KEY);

  let restaurant = null;
  try { restaurant = JSON.parse(localStorage.getItem('foody_restaurant') || 'null'); } catch {}

  const notify = (msg) => { els.toast.textContent = msg; els.toast.classList.remove('hidden'); setTimeout(()=> els.toast.classList.add('hidden'), 2200); };

  const waitTgUser = () => new Promise((resolve) => {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (u || tries > 15) { clearInterval(t); resolve(u || null); }
    }, 100);
  });

  async function autoLinkIfPossible(){
    try{
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if(!u || !restaurant?.id) return;
      await fetch(`${API}/link_telegram_auto`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ telegram_id: String(u.id), restaurant_id: restaurant.id })
      });
    }catch(e){}
  }

  function showLoggedUI(){
    els.restInfo.textContent = `Вы вошли как: ${restaurant.name} (id ${restaurant.id})`;
    els.loginBtn.style.display = 'none';
    els.logoutBtn.style.display = 'inline-flex';
  }
  function showLoggedOutUI(){
    els.restInfo.textContent = 'Вы вышли. Нажмите «Войти» для авторизации через Telegram.';
    els.loginBtn.style.display = 'inline-flex';
    els.logoutBtn.style.display = 'none';
  }

  async function tryTelegramLogin(){
    if (loggedOut()) return false;
    const u = await waitTgUser();
    if (!u) return false;
    try{
      const r = await fetch(`${API}/whoami?telegram_id=${u.id}`);
      if (!r.ok) return false;
      const data = await r.json();
      restaurant = { id: data.restaurant_id, name: data.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      await autoLinkIfPossible();
      showLoggedUI();
      return true;
    }catch{return false;}
  }

  function isProfileComplete(profile){
    return Boolean((profile?.phone || '').trim() && (profile?.address || '').trim());
  }

  async function loadProfileBanner(){
    if (!restaurant?.id) return;
    try{
      const r = await fetch(`${API}/restaurant/${restaurant.id}`);
      if (!r.ok) throw 0;
      const prof = await r.json();
      if (isProfileComplete(prof)) els.profileBanner.classList.add('hidden');
      else els.profileBanner.classList.remove('hidden');
    } catch { /* silent */ }
  }

  function money(v){ try { return new Intl.NumberFormat('ru-RU').format(v) + ' ₽'; } catch { return v + ' ₽'; } }
  function fmtDT(s){ try { return new Date(s).toLocaleString('ru-RU', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});} catch { return s || '—'; } }

  async function loadOffers(){
    if (!restaurant?.id) return;
    const q = await fetch(`${API}/offers?restaurant_id=${restaurant.id}`);
    const arr = await q.json();
    els.offers.innerHTML='';
    const qstr = (els.search?.value || '').toLowerCase();
    const items = qstr ? arr.filter(o => (o.title||'').toLowerCase().includes(qstr)) : arr;
    if (!items.length) els.empty.classList.remove('hidden'); else els.empty.classList.add('hidden');
    for (const o of items){
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="muted small">ID ${o.id}</div>
        <div style="font-weight:600">${o.title}</div>
        <div class="muted">${o.description||''}</div>
        <div class="muted">До: ${fmtDT(o.expires_at)}</div>
        <div style="margin:8px 0"><b>${money(o.price)}</b> • Остаток: ${o.quantity}</div>
        <div class="row" style="grid-template-columns:auto auto;gap:8px">
          <button class="btn" data-edit="${o.id}">Редактировать</button>
          <button class="btn" data-del="${o.id}">Удалить</button>
        </div>`;
      card.querySelector('[data-edit]').onclick = () => openEdit(o);
      card.querySelector('[data-del]').onclick = () => delOffer(o.id);
      els.offers.appendChild(card);
    }
  }

  async function delOffer(id){
    if (!confirm('Удалить предложение?')) return;
    try{ await fetch(`${API}/offers/${id}`, { method:'DELETE' }); notify('Удалено'); loadOffers(); }catch{ notify('Ошибка удаления'); }
  }

  function openEdit(o){
    els.editId.value = o.id;
    els.editTitle.value = o.title || '';
    els.editDesc.value = o.description || '';
    els.editPrice.value = o.price;
    els.editQty.value = o.quantity;
    els.editExpires.value = o.expires_at ? new Date(o.expires_at).toISOString().slice(0,16) : '';
    els.editModal.showModal();
  }

  els.editForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const id = Number(els.editId.value);
    const payload = {
      title: els.editTitle.value.trim() || undefined,
      description: els.editDesc.value.trim() || undefined,
      price: els.editPrice.value ? Number(els.editPrice.value) : undefined,
      quantity: els.editQty.value ? Number(els.editQty.value) : undefined,
      expires_at: els.editExpires.value ? new Date(els.editExpires.value).toISOString() : undefined,
    };
    try{
      await fetch(`${API}/offers/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      els.editModal.close(); notify('Сохранено'); loadOffers();
    }catch{ notify('Ошибка сохранения'); }
  });

  els.createForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!restaurant?.id) return notify('Нет ресторана');
    const payload = {
      restaurant_id: restaurant.id,
      title: els.title.value.trim(),
      description: els.desc.value.trim() || null,
      price: Number(els.price.value),
      quantity: Number(els.qty.value),
      expires_at: els.expires.value ? new Date(els.expires.value).toISOString() : null,
    };
    try{
      const r = await fetch(`${API}/offers`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!r.ok) throw 0;
      notify('Добавлено'); els.createForm.reset(); loadOffers();
    }catch{ notify('Ошибка добавления'); }
  });

  els.refreshBtn.addEventListener('click', () => { loadOffers(); loadProfileBanner(); });
  els.addFloating.addEventListener('click', () => document.getElementById('title').focus());
  els.search?.addEventListener('input', () => loadOffers());
  els.openOnboarding.addEventListener('click', (e) => {
    e.preventDefault();
    const url = new URL('./onboarding.html', location.href);
    url.searchParams.set('api', API);
    location.href = url.toString();
  });

  els.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('foody_restaurant');
    setLoggedOut(true);
    try { if (window.Telegram && Telegram.WebApp) { Telegram.WebApp.close(); return; } } catch {}
    location.reload();
  });
  els.loginBtn.addEventListener('click', () => { setLoggedOut(false); location.reload(); });

  async function init(){
    if (loggedOut()) { showLoggedOutUI(); return; }
    if (restaurant?.id){ await autoLinkIfPossible(); showLoggedUI(); await loadProfileBanner(); await loadOffers(); return; }
    const ok = await tryTelegramLogin();
    if (ok){ await loadProfileBanner(); await loadOffers(); return; }
    els.restInfo.textContent = 'Откройте Mini App из бота для авторизации.';
    els.loginBtn.style.display = 'inline-flex';
  }

  init();
})();
