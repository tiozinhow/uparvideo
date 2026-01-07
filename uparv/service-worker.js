// Service Worker para VideoShare Ultra
const CACHE_NAME = 'videoshare-ultra-v3';
const STATIC_FILES = [
    '/',
    '/index.html',
    '/share.html',
    '/player.html',
    '/upload.html',
    '/library.html',
    '/assets/css/main.css',
    '/assets/js/database.js',
    '/assets/js/share.js',
    '/assets/js/app.js'
];

// Instalar
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_FILES))
            .then(() => self.skipWaiting())
    );
});

// Ativar
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Interceptar requisições
self.addEventListener('fetch', event => {
    // Ignorar requisições não GET
    if (event.request.method !== 'GET') return;
    
    // Para arquivos .vshare, sempre buscar na rede
    if (event.request.url.includes('.vshare')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                return new Response('Offline - Arquivo .vshare não disponível', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            })
        );
        return;
    }
    
    // Para vídeos, usar cache-first
    if (event.request.url.match(/\.(mp4|webm|avi|mov|mkv)$/i) || 
        event.request.url.includes('blob:')) {
        event.respondWith(
            caches.match(event.request)
                .then(response => response || fetch(event.request))
        );
        return;
    }
    
    // Para outros recursos, usar network-first
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clonar resposta para cache
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, responseClone));
                return response;
            })
            .catch(() => {
                return caches.match(event.request)
                    .then(response => response || new Response('Offline'));
            })
    );
});

// Sincronização em background
self.addEventListener('sync', event => {
    if (event.tag === 'sync-videos') {
        event.waitUntil(syncVideos());
    }
});

async function syncVideos() {
    // Implementar sincronização de vídeos
    console.log('Sincronizando vídeos...');
}

// Receber push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Novo vídeo disponível!',
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/badge.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Abrir aplicativo',
                icon: '/assets/icons/open.png'
            },
            {
                action: 'close',
                title: 'Fechar',
                icon: '/assets/icons/close.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('VideoShare Ultra', options)
    );
});

// Clicar na notificação
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});