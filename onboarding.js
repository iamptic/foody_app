(() => {
  const urlp = new URLSearchParams(location.search);
  const API = urlp.get('api') || 'http://localhost:8000';

  const els = {
    phone: document.getElementById('phone'),
    tz: document.getElementById('tz'),
    addr: document.getElementById('addr'),
    note: document.getElementById('note'),
    email: document.getElementById('email'),
    form: document.getElementById('profForm'),
    toast: document.getElementById('toast'),
  };

  let rid = null;
  try { rid = JSON.parse(localStorage.getItem('foody_restaurant')||'null')?.id || null; } catch { rid = null; }

  const notify = (msg) => { els.toast.textContent = msg; els.toast.classList.remove('hidden'); setTimeout(()=> els.toast.classList.add('hidden'), 2200); };

  async function autoLink(){
    try{
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if(!u || !rid) return;
      await fetch(`${API}/link_telegram_auto`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ telegram_id: String(u.id), restaurant_id: rid }) });
    }catch(e){}
  }

  async function load(){
    if (!rid){ notify('Откройте ЛК из бота'); return; }
    await autoLink();
    try{
      const r = await fetch(`${API}/restaurant/${rid}`);
      if (!r.ok) throw 0;
      const p = await r.json();
      els.phone.value = p.phone || '';
      els.tz.value = p.timezone_name || 'UTC+7';
      els.addr.value = p.address || '';
      els.note.value = p.pickup_note || '';
      els.email.value = p.email || '';
    }catch{}
  }

  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!rid) return;
    const payload = {
      phone: els.phone.value.trim(),
      timezone_name: els.tz.value.trim() || null,
      address: els.addr.value.trim(),
      pickup_note: els.note.value.trim() || null,
      email: els.email.value.trim() || null,
    };
    try{
      const r = await fetch(`${API}/restaurant/${rid}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (!r.ok) throw 0;
      notify('Сохранено');
      // вернёмся в ЛК
      setTimeout(()=> { location.href = `./index.html?api=${encodeURIComponent(API)}`; }, 400);
    }catch{ notify('Ошибка сохранения'); }
  });

  load();
})();
