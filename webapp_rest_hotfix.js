// Mini registration hotfix when no whoami
(() => {
  const API = new URLSearchParams(location.search).get('api') || 'http://localhost:8000';
  const info = document.getElementById('restInfo');
  const loginBtn = document.getElementById('loginBtn');
  const root = document.querySelector('main.container');

  async function whoami(){
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) throw 0;
    const r = await fetch(`${API}/whoami?telegram_id=${u.id}`);
    if (!r.ok) throw 0;
    return r.json();
  }

  function renderInlineRegister(){
    const box = document.createElement('section');
    box.className = 'card';
    box.innerHTML = `
      <h3>Быстрая регистрация ресторана</h3>
      <div class="field"><label>Название</label><input id="hotName" placeholder="Например, «Бургер & Кофе»"/></div>
      <div class="actions"><button class="btn primary" id="hotCreate">Создать и войти</button></div>`;
    root.prepend(box);
    const btn = box.querySelector('#hotCreate');
    btn.onclick = async () => {
      btn.disabled = true;
      const name = (box.querySelector('#hotName').value || '').trim() || 'Мой ресторан';
      try {
        const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
        if (!u) throw 0;
        const r = await fetch(`${API}/register_telegram?force_new=true`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name, telegram_id: String(u.id) })
        });
        if (r.ok) location.reload();
        else alert('Не удалось создать ресторан');
      } catch { alert('Не удалось создать ресторан'); }
      btn.disabled = false;
    };
  }

  async function init(){
    try {
      await whoami();
    } catch {
      info.textContent = 'Нет привязки к ресторану. Вы можете зарегистрировать его за 10 секунд:';
      loginBtn.style.display = 'none';
      renderInlineRegister();
    }
  }
  init();
})();
