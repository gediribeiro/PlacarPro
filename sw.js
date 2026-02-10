// ===== SERVICE WORKER COM AUTO-UPDATE =====
// Versão dinâmica baseada na data (sempre diferente)

const APP_VERSION = 'v2026.02.09'; // MUDE SEMPRE QUE ATUALIZAR O APP
const CACHE_NAME = `placar-fut-cache-${APP_VERSION}`;

// URLs para cache (tudo que precisa funcionar offline)
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// ===== INSTALAÇÃO =====
self.addEventListener('install', event => {
  console.log(`[Service Worker] Instalando versão ${APP_VERSION}`);
  
  // FORÇA ATIVAÇÃO IMEDIATA
  self.skipWaiting();
  
  // CACHE DOS ARQUIVOS ESSENCIAIS
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cacheando arquivos...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Instalação completa!');
      })
  );
});

// ===== ATIVAÇÃO =====
self.addEventListener('activate', event => {
  console.log(`[Service Worker] Ativando versão ${APP_VERSION}`);
  
  event.waitUntil(
    // LIMPA CACHES ANTIGOS
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Remove caches que NÃO são o atual
          if (cacheName !== CACHE_NAME && cacheName.startsWith('placar-fut-cache-')) {
            console.log(`[Service Worker] Removendo cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // ASSUME CONTROLE IMEDIATO DE TODAS AS ABAS
      return self.clients.claim();
    })
    .then(() => {
      // NOTIFICA TODOS OS CLIENTES PARA RECARREGAR
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'NEW_VERSION',
            version: APP_VERSION,
            action: 'reload'
          });
        });
      });
    })
  );
});

// ===== INTERCEPTA REQUISIÇÕES =====
self.addEventListener('fetch', event => {
  // Ignora requisições do chrome-extension
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se tem no cache, retorna
        if (response) {
          return response;
        }
        
        // Se não tem, busca na rede
        return fetch(event.request)
          .then(response => {
            // Não cacheamos tudo, só o essencial
            return response;
          })
          .catch(() => {
            // Se offline e não tem no cache, mostra fallback
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// ===== RECEBE MENSAGENS =====
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
