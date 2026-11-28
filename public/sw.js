// Service worker de Relab: deja abrir TextoRedes y el Kit del feriante sin conexión.
// Páginas: primero la red (siempre la versión nueva); sin señal, la última copia de esa página o,
// si no hay, la portada de su app. /assets/ tiene hash en el nombre: primero la copia guardada.
// /api nunca se guarda (datos de la cuenta, siempre en vivo).
const CACHE = 'relab-v3';
// Portadas que se guardan apenas se instala el service worker, para abrir sin señal desde el primer día.
const APPS = ['/kit-feriante/', '/textoenredes/'];
const appDe = path => APPS.find(a => path.startsWith(a)) || '/textoenredes/';

// Guarda la portada de una app y los archivos que usa (scripts, estilos y lo que esos estilos piden,
// como las tipografías): los que se bajaron antes de que existiera el service worker no quedaron guardados.
const assetsDe = txt => [...new Set((txt.match(/\/assets\/[\w.\-]+/g) || []))];
async function guardarApp(c, url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return;
  await c.put(url, res.clone());
  const assets = assetsDe(await res.text());
  const css = assets.filter(a => a.endsWith('.css'));
  await Promise.all(assets.map(a => c.add(a).catch(() => {})));
  for (const href of css) {
    const hit = await c.match(href);
    if (hit) await Promise.all(assetsDe(await hit.text()).map(a => c.add(a).catch(() => {})));
  }
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(APPS.map(u => guardarApp(c, u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match(appDe(url.pathname)))));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
