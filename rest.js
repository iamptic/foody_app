// Debug-first rest.js — default API, visible health, and test action
(() => {
  // 1) ПОДСТАВЬ свой прод-бэкенд (fallback внутри Telegram, если нет ?api= и нет сохранённого значения)
  const DEFAULT_API = 'https://foodyback-production.up.railway.app';

  // 2) Вычисляем API с учётом URL-параметра и Telegram
  const urlApi = new URLSearchParams(location.search).get('api');
  if (urlApi) localStorage.setItem('foody_api', urlApi);
  if (window.Telegram?.WebApp && !urlApi && !localStorage.getItem('foody_api')) {
    localStorage.setItem('foody_api', DEFAULT_API);
  }
  const API = urlApi || localStorage.getItem('foody_api') || DEFAULT_API;

  // 3) Элементы дебаг-бара
  const dbgApi = document.getElementById('dbgApi');
  const dbgHealth = document.getElementById('dbgHealth');
  const dbgDot = document.getElementById('dbgDot');
  const dbgTest = document.getElementById('dbgTest');
  dbgApi.textContent = API;

  // 4) Проверка здоровья
  async function checkHealth(){
    try{
      const r = await fetch(`${API}/health`, { cache:'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json().catch(()=>({}));
      dbgHealth.textContent = JSON.stringify(j);
      dbgDot.classList.remove('fail'); dbgDot.classList.add('ok');
    }catch(e){
      dbgHealth.textContent = (e && e.message) ? e.message : 'failed to fetch';
      dbgDot.classList.remove('ok'); dbgDot.classList.add('fail');
    }
  }

  // 5) Тест‑кнопка создания ресторана — покажет точный ответ сервера/ошибку сети
  dbgTest.addEventListener('click', async () => {
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const name = 'Debug Place ' + Math.floor(Math.random()*1000);
    try{
      const r = await fetch(`${API}/register_telegram?force_new=true`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, telegram_id: String(u?.id || 'debug') })
      });
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')){
        const data = await r.json();
        alert(`Status ${r.status}\n` + JSON.stringify(data, null, 2));
      } else {
        const text = await r.text();
        alert(`Status ${r.status}\n` + text);
      }
    }catch(e){
      alert(`Network error: ${(e && e.message) ? e.message : 'failed to fetch'}`);
    }
  });

  checkHealth();
})();
