// Bootstrap: Telegram ready + API base + expose FOODY_API
(function(){
  try{ if(window.Telegram?.WebApp){ Telegram.WebApp.ready(); Telegram.WebApp.expand?.(); } }catch(e){}
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