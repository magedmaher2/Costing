/* Garment Costing - service worker
   - يخزّن الصفحة والملفات الأساسية عشان التطبيق يفتح من غير نت
   - الصفحة نفسها: الشبكة أولاً (التحديثات توصل فوراً)، ولو مفيش نت يفتح من النسخة المخزنة
   - طلبات جوجل (Apps Script) ما بنلمسهاش أبداً: دي بتروح للسيرفر مباشرة */
const CACHE = 'gc-shell-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './logo.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(CORE.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const fallback = () => caches.match(req, { ignoreSearch: true })
      .then(r => r || caches.match('./index.html')).then(r => r || caches.match('./'));
    const timer = setTimeout(() => { fallback().then(r => { if (r && !settled) { settled = true; resolve(r); } }); }, timeoutMs);
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      if (!settled) fallback().then(r => { settled = true; resolve(r || Response.error()); });
    });
  });
}

function staleWhileRevalidate(req) {
  return caches.match(req).then(cached => {
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => cached);
    return cached || net;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/(^|\.)script\.google\.com$|(^|\.)googleusercontent\.com$/.test(url.hostname)) return;   // API: مباشرة
  if (url.pathname.endsWith('/exec')) return;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, 4000)); return; }
  e.respondWith(staleWhileRevalidate(req));
});
