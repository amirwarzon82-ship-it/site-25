const CACHE = 'class-app-v9';
const PRE = ['/app', '/icons/icon-192.png', '/icons/icon-512.png', '/manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(PRE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || u.pathname.indexOf('/api/') === 0) return;
  if (r.mode === 'navigate' && (u.pathname === '/app' || u.pathname === '/app/')) {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('/app', cp)); return res; }).catch(() => caches.match('/app')));
    return;
  }
  if (PRE.indexOf(u.pathname) > -1 || u.pathname.indexOf('/icons/') === 0) {
    e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); return res; })));
  }
});
