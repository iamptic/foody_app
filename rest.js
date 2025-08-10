// Logout fix + close Mini App on logout
(() => {
  const urlp = new URLSearchParams(location.search);
  const API = urlp.get('api') || 'http://localhost:8000';

  const els = {
    restInfo: document.getElementById('restInfo'),
    logoutBtn: document.getElementById('logoutBtn'),
    loginBtn: document.getElementById('loginBtn'),
    toast: document.getElementById('toast'),
  };

  const LOGOUT_KEY = 'foody_logged_out';
  const loggedOut = () => sessionStorage.getItem(LOGOUT_KEY) === '1';
  const setLoggedOut = (v) => v ? sessionStorage.setItem(LOGOUT_KEY, '1') : sessionStorage.removeItem(LOGOUT_KEY);

  const toast = (msg) => { els.toast.textContent = msg; els.toast.style.display='block'; setTimeout(()=> els.toast.style.display='none', 2200); };

  let restaurant = null;
  try { restaurant = JSON.parse(localStorage.getItem('foody_restaurant') || 'null'); } catch {}

  const showLoggedUI = () => {
    els.restInfo.textContent = `Вы вошли как: ${restaurant.name} (id ${restaurant.id})`;
    if (els.logoutBtn) els.logoutBtn.style.display = 'inline-flex';
    if (els.loginBtn) els.loginBtn.style.display = 'none';
  };

  const showLoggedOutUI = () => {
    els.restInfo.textContent = 'Вы вышли. Нажмите «Войти», чтобы авторизоваться через Telegram.';
    if (els.logoutBtn) els.logoutBtn.style.display = 'none';
    if (els.loginBtn) els.loginBtn.style.display = 'inline-flex';
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
    if (loggedOut()) return false;
    const u = await waitTgUser();
    if (!u) return false;
    try {
      const r = await fetch(`${API}/whoami?telegram_id=${u.id}`);
      if (!r.ok) return false;
      const data = await r.json();
      restaurant = { id: data.restaurant_id, name: data.restaurant_name };
      localStorage.setItem('foody_restaurant', JSON.stringify(restaurant));
      showLoggedUI();
      return true;
    } catch { return false; }
  };

  els.logoutBtn?.addEventListener('click', () => {
    // Clear local session and set "logged out" flag for this Mini App session
    localStorage.removeItem('foody_restaurant');
    setLoggedOut(true);

    // If inside Telegram Mini App — close the webview and return to chat
    try {
      if (window.Telegram && Telegram.WebApp) {
        Telegram.WebApp.close();
        return;
      }
    } catch {}

    // Fallback for browser: just reload to show logged-out UI
    location.reload();
  });

  els.loginBtn?.addEventListener('click', () => {
    setLoggedOut(false);
    location.reload();
  });

  const init = async () => {
    if (loggedOut()) {
      localStorage.removeItem('foody_restaurant');
      showLoggedOutUI();
      return;
    }
    if (restaurant?.id) {
      showLoggedUI();
      return;
    }
    const ok = await tryTelegramLogin();
    if (ok) return;

    els.restInfo.textContent = 'Сначала активируйте аккаунт по ссылке из бота или привяжите Telegram.';
    if (els.loginBtn) els.loginBtn.style.display = 'inline-flex';
  };

  init();
})();
