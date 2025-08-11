// Foody Mini‑App Bootstrap (drop-in). Include BEFORE your main webapp/rest.js.
// - Calls Telegram.WebApp.ready() and expand()
// - Resolves API (from ?api=, localStorage, or DEFAULT_API inside Telegram)
// - Exposes window.FOODY_API for your main script
// - Adds a tiny debug bar (can be removed later)
(function(){
  // 1) IMPORTANT: set your production backend here (fallback inside Telegram)
  var DEFAULT_API = 'https://foodyback-production.up.railway.app';

  // Signal Telegram that UI is ready as early as possible
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  } catch(e) { /* ignore */ }

  // Resolve API
  var params = new URLSearchParams(location.search);
  var urlApi = params.get('api');
  if (urlApi) {
    try { localStorage.setItem('foody_api', urlApi); } catch(e) {}
  }
  if (window.Telegram && window.Telegram.WebApp && !urlApi && !localStorage.getItem('foody_api')) {
    try { localStorage.setItem('foody_api', DEFAULT_API); } catch(e) {}
  }
  var API = urlApi || localStorage.getItem('foody_api') || DEFAULT_API;
  window.FOODY_API = API; // expose for other scripts

  // --- Debug bar (you may delete this block later) ---
  function el(tag, attrs, text){
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs){ if (k==='style') Object.assign(n.style, attrs[k]); else n.setAttribute(k, attrs[k]); }
    if (text) n.textContent = text;
    return n;
  }
  function addDebugBar(){
    var bar = el('div', { id:'foodyDbgBar' });
    Object.assign(bar.style, {
      position:'sticky', top:'0', zIndex:'99999', background:'#111', color:'#fff',
      padding:'8px 12px', fontSize:'12px', display:'flex', gap:'12px', alignItems:'center', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
    });
    var dot = el('span', { id:'foodyDbgDot' }); Object.assign(dot.style,{width:'8px',height:'8px',borderRadius:'50%',background:'#ef4444',display:'inline-block'});
    var api = el('span', { id:'foodyDbgApi' }, API);
    var health = el('span', { id:'foodyDbgHealth' }, '…');
    var btn = el('button', { id:'foodyDbgTest' }, 'Test: Create restaurant');
    Object.assign(btn.style,{fontSize:'12px',padding:'4px 8px',borderRadius:'6px',border:'1px solid rgba(255,255,255,.2)',background:'#222',color:'#fff',cursor:'pointer'});

    bar.appendChild(dot);
    bar.appendChild(el('span', null, 'API: '));
    bar.appendChild(api);
    bar.appendChild(el('span', null, '  Health: '));
    bar.appendChild(health);
    bar.appendChild(btn);

    document.addEventListener('DOMContentLoaded', function(){
      document.body.insertBefore(bar, document.body.firstChild);
      checkHealth();
    });

    async function checkHealth(){
      try{
        var r = await fetch(API.replace(/\/+$/,'') + '/health', { cache:'no-store' });
        if (!r.ok) throw new Error('HTTP '+r.status);
        var j = await r.json().catch(function(){ return {}; });
        health.textContent = JSON.stringify(j);
        dot.style.background = '#22c55e';
      }catch(e){
        health.textContent = (e && e.message) ? e.message : 'failed to fetch';
        dot.style.background = '#ef4444';
      }
    }

    btn.addEventListener('click', async function(){
      var u = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) ? window.Telegram.WebApp.initDataUnsafe.user : null;
      var name = 'Debug Place ' + Math.floor(Math.random()*1000);
      try{
        var r = await fetch(API.replace(/\/+$/,'') + '/register_telegram?force_new=true', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ name: name, telegram_id: String(u && u.id || 'debug') })
        });
        var ct = r.headers.get('content-type') || '';
        if (ct.includes('application/json')){
          var data = await r.json();
          alert('Status ' + r.status + '\n' + JSON.stringify(data, null, 2));
        } else {
          var text = await r.text();
          alert('Status ' + r.status + '\n' + text);
        }
      }catch(e){
        alert('Network error: ' + (e && e.message ? e.message : 'failed to fetch'));
      }
    });
  }
  addDebugBar();
})();