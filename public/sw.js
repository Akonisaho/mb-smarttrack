const CACHE = 'mbst-v1';
const STATIC = ['/', '/login', '/offline.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Network-first for API and Supabase calls
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // Cache-first for static assets (_next/static)
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    })));
    return;
  }

  // Stale-while-revalidate for pages
  e.respondWith(caches.match(e.request).then(cached => {
    const network = fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }).catch(() => cached || new Response('Offline', { status: 503 }));
    return cached || network;
  }));
});
