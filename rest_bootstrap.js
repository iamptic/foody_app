// Bootstrap: Telegram ready + theme + API base
(function(){
  try{
    if (window.Telegram?.WebApp){
      Telegram.WebApp.ready();
      Telegram.WebApp.expand?.();
      // Apply theme params → CSS vars (accent if provided by Telegram)
      const tp = Telegram.WebApp.themeParams || {};
      const root = document.documentElement;
      if (tp.button_color){ root.style.setProperty('--accent', tp.button_color); }
      if (tp.button_text_color){ root.style.setProperty('--accentText', tp.button_text_color); }
      if (tp.bg_color){ root.style.setProperty('--bg', tp.bg_color); }
      if (tp.text_color){ root.style.setProperty('--fg', tp.text_color); }
      if (tp.hint_color){ root.style.setProperty('--muted', tp.hint_color); }
    }
  }catch(e){}

  const DEFAULT_API = 'https://foodyback-production.up.railway.app';
  const usp = new URLSearchParams(location.search);
  const qApi = usp.get('api');
  if(qApi) localStorage.setItem('foody_api', qApi);
  if(window.Telegram?.WebApp && !qApi && !localStorage.getItem('foody_api')){
    localStorage.setItem('foody_api', DEFAULT_API);
  }
  const API = (qApi || localStorage.getItem('foody_api') || DEFAULT_API).replace(/\/+$/,'');
  window.FOODY_API = API;
})();