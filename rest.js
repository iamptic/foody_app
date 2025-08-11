// Minimal REST helper with API autodetect from ?api= and localStorage
(() => {
  const DEFAULT_API = new URLSearchParams(location.search).get('api')
                      || localStorage.getItem('foody_api')
                      || 'https://foodyback-production.up.railway.app';
  if (!localStorage.getItem('foody_api')) localStorage.setItem('foody_api', DEFAULT_API);
  window.FOODY_API = DEFAULT_API;

  async function http(path, opts={}){
    const url = `${DEFAULT_API}${path}`;
    const r = await fetch(url, { headers:{'Content-Type':'application/json'}, ...opts });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok){
      const text = await r.text();
      throw new Error(`HTTP ${r.status}: ${text}`);
    }
    return ct.includes('application/json') ? r.json() : r.text();
  }

  window.foody = { api: DEFAULT_API, http };
})();