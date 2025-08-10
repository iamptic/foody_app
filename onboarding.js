(() => {
  const qs = new URLSearchParams(location.search);
  const API = qs.get('api') || 'http://localhost:8000';

  const els = {
    form: document.getElementById('form'),
    name: document.getElementById('name'),
    phone: document.getElementById('phone'),
    tz: document.getElementById('tz'),
    address: document.getElementById('address'),
    note: document.getElementById('note'),
    toast: document.getElementById('toast'),
  };

  const toast = (t) => { els.toast.textContent = t; els.toast.style.display='block'; setTimeout(()=> els.toast.style.display='none', 2000); };

  const getTgId = () => window.Telegram?.WebApp?.initDataUnsafe?.user?.id;

  const loadProfile = async () => {
    const tg = getTgId();
    if (!tg) return toast('Нет Telegram контекста');
    try {
      const r = await fetch(`${API}/me_by_telegram?telegram_id=${tg}`);
      if (!r.ok) return;
      const data = await r.json();
      els.name.value = data.restaurant_name || '';
      els.phone.value = data.phone || '';
      els.tz.value = data.timezone || 'Asia/Tomsk';
      els.address.value = data.address || '';
      els.note.value = data.pickup_note || '';
      els.form.dataset.rid = data.id;
    } catch { /* noop */ }
  };

  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const tg = getTgId();
    if (!tg) return toast('Нет Telegram контекста');
    const rid = els.form.dataset.rid;
    if (!rid) return toast('Нет ID ресторана');
    const payload = {
      phone: els.phone.value.trim(),
      address: els.address.value.trim(),
      timezone: els.tz.value,
      pickup_note: els.note.value.trim()
    };
    try {
      const r = await fetch(`${API}/restaurant/${rid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.ok) toast('Сохранено ✅'); else toast('Ошибка сохранения');
    } catch { toast('Ошибка сети'); }
  });

  loadProfile();
})();
