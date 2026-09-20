// IMPORTANTE: cuando cambiemos JS/CSS y queramos evitar servir una versión antigua,
// incrementa esta versión para invalidar el precache.
const CACHE_NAME = 'eduh-pwa-v1.1.11';

// App shell: recursos críticos para que la app cargue incluso sin red.
// El resto de recursos se cachean en runtime con stale-while-revalidate.
// Nota: evitamos precachear multimedia (música/efectos) para no inflar la instalación.
const ASSETS = [
  '/',
  '/index.html',
  '/join.html',
  '/multiplayer/',
  '/multiplayer/index.html',
  '/solo/',
  '/solo/index.html',
  '/player/',
  '/player/index.html',
  '/player/game/',
  '/player/game/index.html',
  '/host/',
  '/host/index.html',
  '/host/game/',
  '/host/game/index.html',
  '/create/',
  '/create/index.html',
  '/create/quiz-creator/',
  '/create/quiz-creator/index.html',
  '/admin-stats.html',

  '/css/index.css',
  '/css/landing.css',
  '/css/solo.css',
  '/css/multiplayer.css',
  '/css/music-player.css',
  '/css/host.css',
  '/css/lobby.css',
  '/css/playerGameView.css',
  '/css/hostGameView.css',
  '/css/create.css',
  '/css/quizCreator.css',
  '/css/admin.css',

  '/js/i18n-player.js',
  '/js/i18n-host.js',
  '/js/join.js',
  '/js/solo.js',
  '/js/multiplayer.js',
  '/js/music-player.js',
  '/js/playerGame.js',
  '/js/host.js',
  '/js/hostGame.js',
  '/js/create.js',
  '/js/quizCreator.js',
  '/js/lobby.js',
  '/js/admin-stats.js',

  '/manifest.webmanifest',
  '/icons/logo.svg',
  '/icons/pdf.jpeg',
  '/js/sw-version.js'
];

self.addEventListener('message', (event) => {
  const data = event && event.data ? event.data : null;
  if(!data || data.type !== 'GET_SW_VERSION') return;
  const payload = { type: 'SW_VERSION', cacheName: CACHE_NAME, version: CACHE_NAME };
  // Preferir MessageChannel si viene puerto
  if(event.ports && event.ports[0]){
    event.ports[0].postMessage(payload);
    return;
  }
  // Fallback: responder al cliente que envió el mensaje
  if(event.source && typeof event.source.postMessage === 'function'){
    event.source.postMessage(payload);
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        ASSETS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(url, response.clone());
            }
          } catch (_) {
            // Si un asset falla, no bloqueamos la instalación del SW.
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key !== CACHE_NAME) return caches.delete(key);
      return null;
    }))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/socket.io')) return;

  // No interferir con recursos cross-origin
  if (url.origin !== self.location.origin) return;

  const accept = request.headers.get('accept') || '';
  const isHtml = request.mode === 'navigate' || accept.includes('text/html');

  // JS/CSS: network-first para que los cambios se vean al recargar (sin tener que
  // esperar a la revalidación en segundo plano).
  if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response && response.ok) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await caches.match(request);
          return cached;
        }
      })()
    );
    return;
  }

  // HTML: network-first para que los cambios se vean al recargar.
  if (isHtml) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response && response.ok) {
            await cache.put(request, response.clone());
          }
          return response;
        } catch (err) {
          const cached = await caches.match(request);
          return cached || caches.match('/');
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await caches.match(request);

      const fetchPromise = fetch(request).then(async (response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          await cache.put(request, response.clone());
        }
        return response;
      });

      // stale-while-revalidate: devuelve caché si existe, pero actualiza en background.
      if (cached) {
        event.waitUntil(fetchPromise.catch(() => null));
        return cached;
      }

      try {
        return await fetchPromise;
      } catch (err) {
        return cached;
      }
    })()
  );
});
