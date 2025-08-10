(() => {
  const urlp = new URLSearchParams(location.search);
  const API = urlp.get('api') || 'http://localhost:8000';
  const status = document.getElementById('status');

  async function autoLinkOnOnboarding(rid){
    try{
      const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
      if(!u || !rid) return;
      await fetch(`${API}/link_telegram_auto`, { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ telegram_id: String(u.id), restaurant_id: rid }) });
    }catch(e){}
  }

  function getRid(){
    try { return JSON.parse(localStorage.getItem('foody_restaurant')||'null')?.id || null; } catch { return null; }
  }

  (async () => {
    const rid = getRid();
    await autoLinkOnOnboarding(rid);
    status.textContent = rid ? `Ресторан ID ${rid} привязан к вашему Telegram.` : 'Не найден активный ресторан.';
  })();
})();
