// sw.js
const CACHE_NAME = 'smart-dashboard-v1';
const STATIC_CACHE = 'smart-dashboard-static-v1';
const DYNAMIC_CACHE = 'smart-dashboard-dynamic-v1';

// Файлы для кэширования при установке
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/favicon.ico',
    '/public/192.png',
    '/public/512.png',
    '/public/1080.png',
    '/public/1920.png',
    // Изображения маскота
    '/public/mascot-happy.png',
    '/public/mascot-notes.png',
    '/public/mascot-congrats.png',
    '/public/mascot-worried.png',
    '/public/mascot-warning.png',
    '/public/mascot-levelup.png'
];

// Добавляем иконки уровней (1-10)
for (let i = 1; i <= 10; i++) {
    urlsToCache.push(`/public/${i}.png`);
}

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Установка Service Worker');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Кэширование статических файлов');
                return cache.addAll(urlsToCache);
            })
            .catch(err => {
                console.error('[SW] Ошибка кэширования:', err);
            })
    );
    // Активируем SW сразу после установки
    self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('[SW] Активация Service Worker');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    // Удаляем старые кэши
                    if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
                        console.log('[SW] Удаление старого кэша:', key);
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    // Применяем SW ко всем вкладкам
    return self.clients.claim();
});

// Обработка fetch-запросов
self.addEventListener('fetch', event => {
    const requestUrl = new URL(event.request.url);
    
    // Пропускаем запросы к API (если есть)
    if (requestUrl.pathname.startsWith('/api/')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Стратегия: сначала кэш, затем сеть
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Возвращаем из кэша, если есть
                if (cachedResponse) {
                    // Для HTML проверяем обновления в фоне
                    if (event.request.mode === 'navigate') {
                        event.waitUntil(
                            fetch(event.request)
                                .then(networkResponse => {
                                    if (networkResponse && networkResponse.status === 200) {
                                        const responseToCache = networkResponse.clone();
                                        caches.open(STATIC_CACHE)
                                            .then(cache => {
                                                cache.put(event.request, responseToCache);
                                            });
                                    }
                                    return networkResponse;
                                })
                                .catch(() => {
                                    console.log('[SW] Нет соединения, используем кэш');
                                })
                        );
                    }
                    return cachedResponse;
                }
                
                // Если нет в кэше - идем в сеть
                return fetch(event.request)
                    .then(networkResponse => {
                        // Кэшируем успешные ответы для статики
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            const isStatic = /\.(css|js|png|jpg|jpeg|gif|ico|svg|json)$/i.test(requestUrl.pathname);
                            const cacheToUse = isStatic ? STATIC_CACHE : DYNAMIC_CACHE;
                            
                            caches.open(cacheToUse)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Офлайн-страница для навигации
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Офлайн режим', {
                            status: 503,
                            statusText: 'Service Unavailable',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// Обработка push-уведомлений (опционально)
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Напоминание о задачах!',
        icon: '/public/192.png',
        badge: '/public/192.png',
        vibrate: [200, 100, 200],
        tag: 'reminder',
        requireInteraction: true,
        actions: [
            { action: 'open', title: 'Открыть' },
            { action: 'close', title: 'Закрыть' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Smart Dashboard', options)
    );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Фоновая синхронизация (для отложенных задач)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-tasks') {
        event.waitUntil(
            // Здесь можно синхронизировать неотправленные задачи
            console.log('[SW] Фоновая синхронизация задач')
        );
    }
});

// Обработка сообщений от основного потока
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});