// ===== SERVICE WORKER ATUALIZÁVEL =====
const APP_VERSION = 'v1.0.4';
const CACHE_NAME = `placar-fut-cache-${APP_VERSION}`;
const DYNAMIC_CACHE_NAME = `placar-fut-dynamic-${APP_VERSION}`;

// Arquivos ESSENCIAIS para funcionamento offline
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './sw.js'
];

// URLs de terceiros
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ===== INSTALAÇÃO =====
self.addEventListener('install', event => {
  console.log(`[SW ${APP_VERSION}] Instalando...`);
  
  // Força ativação imediata
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando arquivos essenciais...');
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Todos os arquivos essenciais cacheados.');
      })
      .catch(err => {
        console.warn('[SW] Algum arquivo falhou no cache:', err);
      })
  );
});

// ===== ATIVAÇÃO (VERSÃO CORRIGIDA) =====
self.addEventListener('activate', event => {
  console.log(`[SW ${APP_VERSION}] Ativando...`);
  
  event.waitUntil(
    Promise.all([
      // Limpa TODOS os caches antigos do placar-fut
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Remove qualquer cache que comece com 'placar-fut'
            if (cacheName.includes('placar-fut')) {
              console.log(`[SW] Removendo cache antigo: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Assume controle imediato de todas as abas
      self.clients.claim()
    ])
    .then(() => {
      console.log(`[SW ${APP_VERSION}] Pronto!`);
      
      // Notifica todas as abas sobre a nova versão
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// ===== ESTRATÉGIA "NETWORK FIRST" =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Ignora requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // Para arquivos da nossa aplicação
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          // Atualiza cache com resposta da rede
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => {
          // Offline: tenta do cache
          return caches.match(event.request)
            .then(cachedResponse => cachedResponse);
        })
    );
    return;
  }
  
  // Para recursos externos (Cache First)
  if (EXTERNAL_ASSETS.some(assetUrl => event.request.url.startsWith(assetUrl))) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Busca da rede para atualizar cache (background)
          fetch(event.request)
            .then(networkResponse => {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            });
          return cachedResponse || fetch(event.request);
        })
    );
    return;
  }
});

// ===== CONTROLE MANUAL =====
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data === 'clearCache') {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => caches.delete(cacheName));
    });
  }
});
