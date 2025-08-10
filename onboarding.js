(() => {
  const API = new URLSearchParams(location.search).get('api') || localStorage.getItem('foody_api') || 'http://localhost:8000';
  const els = {
    status: document.getElementById('status'),
    form: document.getElementById('profForm'),
    name: document.getElementById('name'),
    phone: document.getElementById('phone'),
    address: document.getElementById('address'),
    city: document.getElementById('city'),
    note: document.getElementById('note'),
    toast: document.getElementById('toast'),
  };
  const toast = (m)=>{ els.toast.textContent=m; els.toast.classList.remove('hidden'); setTimeout(()=>els.toast.classList.add('hidden'),2000); };

  function getRid(){
    try { return JSON.parse(localStorage.getItem('foody_restaurant')||'null')?.id || null; } catch { return null; }
  }

  async function loadCities(){
    try { 
      const r = await fetch(`${API}/config`);
      const data = await r.json();
      els.city.innerHTML = data.cities.map(c=>`<option value="${c}">${c}</option>`).join('');
    } catch {
      els.city.innerHTML = ['Москва','Санкт‑Петербург','Томск','Новосибирск'].map(c=>`<option>${c}</option>`).join('');
    }
  }

  async function load(){
    await loadCities();
    const rid = getRid();
    if(!rid){ els.status.textContent = 'Нет активного ресторана. Откройте ЛК из бота.'; return; }
    try {
      const r = await fetch(`${API}/restaurant/${rid}`);
      if (!r.ok) throw 0;
      const p = await r.json();
      els.name.value = p.restaurant_name || '';
      els.phone.value = p.phone || '';
      els.address.value = p.address || '';
      if (p.city) els.city.value = p.city;
      els.note.value = p.pickup_note || '';
      els.status.textContent = `Редактирование профиля для ID ${rid}`;
    } catch {
      els.status.textContent = 'Сервер недоступен';
    }
  }

  els.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const rid = getRid();
    if (!rid) return toast('Нет активного ресторана');
    const payload = {
      restaurant_name: els.name.value.trim() || undefined,
      phone: els.phone.value.trim() || undefined,
      address: els.address.value.trim() || undefined,
      city: els.city.value,
      pickup_note: els.note.value.trim() || undefined,
    };
    try {
      const r = await fetch(`${API}/restaurant/${rid}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      if (r.ok) { toast('Сохранено'); }
      else { const t = await r.text(); toast('Не удалось сохранить: ' + t); }
    } catch { toast('Ошибка сети'); }
  });

  load();
})();
