// miniapp_boot.js — инициализация Telegram Mini App + синхронизация темы/размеров
(function(){
  const T = window.Telegram && window.Telegram.WebApp;
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  function applyTheme(tp){
    if (!tp) return;
    const root = document.documentElement;
    // привязываем базовые переменные для твоего канваса/дизайна
    const map = {
      '--tg-bg': tp.bg_color,
      '--tg-text': tp.text_color,
      '--tg-link': tp.link_color,
      '--tg-button': tp.button_color,
      '--tg-button-text': tp.button_text_color,
      '--tg-hint': tp.hint_color,
      '--tg-secondary': tp.secondary_bg_color,
    };
    Object.entries(map).forEach(([k,v]) => { if (v) root.style.setProperty(k,v); });
    document.body.dataset.tgTheme = T.colorScheme || 'light';
  }

  ready(function(){
    if (!T) return; // открыли во внешнем браузере — ок, просто не трогаем
    try { T.ready(); } catch(e){}
    try { T.expand(); } catch(e){}
    // тема
    applyTheme(T.themeParams || (T.initDataUnsafe && T.initDataUnsafe.theme_params));
    T.onEvent && T.onEvent('themeChanged', ()=> applyTheme(T.themeParams));
    // высота
    T.onEvent && T.onEvent('viewportChanged', ()=> T.setHeaderColor(T.colorScheme==='dark'?'secondary_bg_color':'bg_color'));
    try { T.setHeaderColor(T.colorScheme==='dark'?'secondary_bg_color':'bg_color'); } catch(e){}

    // сохраним initDataUnsafe в localStorage (можно отправить на бэкенд)
    try {
      const init = T.initData || '';
      localStorage.setItem('tg_initData', init);
      localStorage.setItem('tg_initDataUnsafe', JSON.stringify(T.initDataUnsafe||{}));
    } catch(e){}
    console.log('[miniapp_boot] initialized');
  });
})();
