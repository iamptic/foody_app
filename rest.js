// Restaurant LK (auto-link + logout-close + minimal offers list placeholder)
(() => {
  const urlp = new URLSearchParams(location.search);
  const API = urlp.get('api') || 'http://localhost:8000';

  const els = {
    restInfo: document.getElementById('restInfo'),
    logoutBtn: document.getElementById('logoutBtn'),
    loginBtn: document.getElementById('loginBtn'),
    offers: document.getElementById('offers'),
    empty: document.getElementById('empty'),
    toast: document.getElementById('toast'),
  };

  const LOGOUT_KEY = 'foody_logged_out';
  const loggedOut = () => sessionStorage.getItem(LOGOUT_KEY) === '1';
  const setLoggedOut = (v) => v ? sessionStorage.setItem(LOGOUT_KEY, '1') : sessionStorage.removeItem(LOGOUT_KEY);

  let restaurant = null;
  try { restaurant = JSON.parse(localStorage.getItem('foody_restaurant') || 'null'); } catch {}

  const toast = (msg) => { els.toast.textContent = msg; els.toast.classList.remove('hidden'); setTimeout(()=> els.toast.classList.add('hidden'), 2200); };

  const showLoggedUI = () => {
    els.restInfo.textContent = `Вы вошли как: ${restaurant.name} (id ${restaurant.id})`;
    els.logoutBtn.style.display = 'inline-flex';
    els.loginBtn.style.display = 'none';
  };
  const showLoggedOutUI = () => {
    els.restInfo.textContent = 'Вы вышли. Нажмите «Войти» для авторизации через Telegram.';
    els.logoutBtn.style.display = 'none';
    els.loginBtn.style.display = 'inline-flex';
  };

  async function autoLinkIfPossible(){
    try{
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if(!u || !restaurant?.id) return;
      await fetch(`${API}/link_telegram_auto`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ telegram_id: String(u.id), restaurant_id: restaurant.id })
      });
    }catch(e){}
  }

  const waitTgUser = () => new Promise((resolve) => {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if (u || tries > 10) { clearInterval(t); resolve(u || null); }
    }, 100);
  });

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

  async function init(){
    if (loggedOut()) { localStorage.removeItem('foody_restaurant'); showLoggedOutUI(); return; }
    if (restaurant?.id){ await autoLinkIfPossible(); showLoggedUI(); return; }
    const ok = await tryTelegramLogin();
    if (ok) return;
    els.restInfo.textContent = 'Сначала активируйте аккаунт по ссылке из бота или откройте Mini App из бота.';
    els.loginBtn.style.display = 'inline-flex';
  }

  els.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('foody_restaurant');
    setLoggedOut(true);
    try { if (window.Telegram && Telegram.WebApp) { Telegram.WebApp.close(); return; } } catch {}
    location.reload();
  });
  els.loginBtn.addEventListener('click', () => { setLoggedOut(false); location.reload(); });

  init();
})();
