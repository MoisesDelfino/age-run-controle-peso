const CACHE_VERSION = 'age-run-pwa-v1';
const CACHE_NAME = `age-run-pwa-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  './',
  './home',
  './login',
  './pesagem',
  './ranking',
  './grupos-treino',
  './bioimpedancia',
  './treinador',
  './styles.css',
  './auth.css',
  './effects.css',
  './theme.js',
  './app.js',
  './auth.js',
  './home.js',
  './pesagem.js',
  './ranking.js',
  './grupos-treino.js',
  './bioimpedancia.js',
  './bioimpedancia-scanner.js',
  './treinador.js',
  './menu.js',
  './manifest.json',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './pwa-icon.svg',
  './favicon.png',
  './logo.png'
];

function scopePath(pathname) {
  const scope = new URL(self.registration.scope);
  return new URL(pathname, scope).href;
}

function isSameOriginRequest(request) {
  try {
    return new URL(request.url).origin === self.location.origin;
  } catch (error) {
    return false;
  }
}

function isApiRequest(request) {
  return request.url.includes('/api/');
}

async function cacheStaticAssets() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_ASSETS.map(scopePath));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    cacheStaticAssets().then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
        return Promise.resolve(false);
      }));
      await self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || !isSameOriginRequest(request) || isApiRequest(request)) {
    return;
  }

  const url = new URL(request.url);
  const isNavigation = request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned)).catch(() => {});
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request) || await cache.match(scopePath('./home')) || await cache.match(scopePath('./'));
          return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request).then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then((response) => {
        if (response && response.ok) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch(() => {});
        }
        return response;
      });
    })
  );
});
