// tg_fallback_auth.js — позволяет заходить не через WebApp Telegram (MVP-режим)
(function(){
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function qs(name){ const v=new URLSearchParams(location.search).get(name); return v && decodeURIComponent(v); }
  function setLS(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  ready(function(){
    const params = new URLSearchParams(location.search);
    const uid   = qs('tg_uid') || qs('uid');
    const uname = qs('tg_uname') || qs('username') || '';
    const first = qs('tg_first') || qs('first') || '';
    const tg    = qs('tg');
    const api   = qs('api');
    if (api) localStorage.setItem('foody_api', api);
    if (uid || tg === '1') {
      const user = { id: String(uid||'guest'), username: uname||'', first_name: first||'' };
      setLS('tg_user', user);
      localStorage.setItem('tg_auth_ok', '1');
      if (!window.Telegram) window.Telegram = {};
      if (!window.Telegram.WebApp) {
        window.Telegram.WebApp = {
          initData: '',
          initDataUnsafe: { user },
          ready(){}, expand(){}, close(){}, sendData(){}
        };
      }
      ['open-in-telegram','tg-only-banner','tg_required'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display='none';
      });
      document.body.classList.add('tg-fallback-ok');
      console.log('[tg_fallback_auth] fallback active for', user);
    }
  });
})();
