// rid_autosave.js — сохраняет ?rid= из URL в localStorage.foody_restaurant
(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(async function(){
    try{
      const params = new URLSearchParams(location.search);
      const rid = params.get('rid');
      const api = params.get('api') || localStorage.getItem('foody_api') || '';
      if (!rid) return;
      if (api) localStorage.setItem('foody_api', api);

      // Попробуем получить описание точки, но это опционально
      let rest = { id: rid };
      if (api) {
        try{
          const r = await fetch(`${api.replace(/\/$/,'')}/restaurants/${encodeURIComponent(rid)}`);
          if (r.ok) {
            const d = await r.json();
            // ожидаем структуру {id, title, address, ...}
            if (d && d.id) rest = d;
          }
        }catch(e){ /* тихо игнорим */ }
      }
      localStorage.setItem('foody_restaurant', JSON.stringify(rest));
      console.log('[rid_autosave] saved foody_restaurant:', rest);
    }catch(e){ console.warn('[rid_autosave] failed:', e); }
  });
})();
