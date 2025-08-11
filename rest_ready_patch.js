// Minimal patch: call Telegram.WebApp.ready() ASAP to avoid 'Load failed'
(function(){
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      // Signal Telegram that UI is ready
      window.Telegram.WebApp.ready();
      // Optional: expand to full height
      window.Telegram.WebApp.expand();
    }
  } catch(e){ /* ignore */ }
})();
// Keep your existing rest.js code below (or include this at the very top of it)
