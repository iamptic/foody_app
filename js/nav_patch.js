
// nav_patch.js — аккуратно добавляет ссылки "Сканер" и "Материалы"
(function(){
  const API = new URLSearchParams(location.search).get('api') || localStorage.getItem('foody_api') || 'http://localhost:8000';
  const scannerHref = `./scanner.html?api=${encodeURIComponent(API)}`;
  const docsHref = `./docs/index.html`;

  function makeLink(text, href){
    const a = document.createElement('a');
    a.textContent = text;
    a.href = href;
    a.className = 'nav-btn';
    a.style.padding = '8px 10px';
    a.style.borderRadius = '10px';
    a.style.textDecoration = 'none';
    a.style.color = '#234';
    a.style.border = '1px solid #CFD8DC';
    a.style.background = '#fff';
    a.style.fontWeight = '700';
    a.style.fontSize = '14px';
    a.style.marginLeft = '8px';
    a.onmouseenter = ()=> a.style.background='#F5F5F5';
    a.onmouseleave = ()=> a.style.background='#fff';
    return a;
  }

  function injectInto(container){
    if (!container) return false;
    const wrap = document.createElement('span');
    wrap.style.marginLeft = '8px';
    wrap.appendChild(makeLink('Сканер/выдача', scannerHref));
    wrap.appendChild(makeLink('Материалы', docsHref));
    container.appendChild(wrap);
    return true;
  }

  function ready(fn){ if (document.readyState!='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    // пробуем популярные места хедера
    const spots = [
      document.querySelector('.topbar .right'),
      document.querySelector('.topbar .actions'),
      document.querySelector('header .actions'),
      document.querySelector('header .right'),
      document.querySelector('header nav'),
      document.querySelector('.toolbar .right'),
      document.querySelector('.toolbar'),
    ];
    for (const s of spots){
      if (injectInto(s)) return;
    }
    // fallback — мини-трей внизу справа
    const tray = document.createElement('div');
    tray.style.position='fixed'; tray.style.right='16px'; tray.style.bottom='16px';
    tray.style.display='flex'; tray.style.gap='8px'; tray.style.zIndex='9999';
    tray.appendChild(makeLink('Сканер/выдача', scannerHref));
    tray.appendChild(makeLink('Материалы', docsHref));
    document.body.appendChild(tray);
  });
})();
