// ============================================================================
// PLACAR PRO – SERVICE WORKER v1.3.0
// ============================================================================
// ÍNDICE:
// 1. CONFIGURAÇÕES E CONSTANTES
// 2. INSTALAÇÃO (CACHE DE ARQUIVOS ESSENCIAIS)
// 3. ATIVAÇÃO (LIMPEZA DE CACHES ANTIGOS E CONTROLE)
// 4. ESTRATÉGIA DE FETCH (NETWORK FIRST + CACHE FIRST PARA EXTERNOS)
// 5. CONTROLE MANUAL VIA MENSAGENS
// ============================================================================

// ============================================================================
// 1. CONFIGURAÇÕES E CONSTANTES
// ============================================================================
const APP_VERSION = 'v1.3.0';                    // Atualizado para v1.3.0
const CACHE_NAME = `placar-fut-cache-${APP_VERSION}`;
const DYNAMIC_CACHE_NAME = `placar-fut-dynamic-${APP_VERSION}`;

// Arquivos ESSENCIAIS para funcionamento offline
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './sw.js',
  './icon-192.png',
  './icon-512.png'
];

// URLs de terceiros (para cache first)
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ============================================================================
// 2. INSTALAÇÃO
// ============================================================================
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

// ============================================================================
// 3. ATIVAÇÃO (VERSÃO CORRIGIDA - CACHE PROTEGIDO)
// ============================================================================
self.addEventListener('activate', event => {
  console.log(`[SW ${APP_VERSION}] Ativando...`);

  event.waitUntil(
    Promise.all([
      // Remove apenas caches ANTIGOS, preserva o cache da versão atual
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Remove qualquer cache que comece com 'placar-fut' E NÃO seja o cache atual
            if (cacheName.includes('placar-fut') && cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
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

// ============================================================================
// 4. ESTRATÉGIA DE FETCH
// ============================================================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Ignora requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // 4.1. ESTRATÉGIA PARA ARQUIVOS DA PRÓPRIA APLICAÇÃO (NETWORK FIRST)
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
  
  // 4.2. ESTRATÉGIA PARA RECURSOS EXTERNOS (CACHE FIRST)
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

// ============================================================================
// 5. CONTROLE MANUAL VIA MENSAGENS
// ============================================================================
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
