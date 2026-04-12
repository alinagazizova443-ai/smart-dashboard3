// sw.js - исправленная версия
const CACHE_NAME = 'smart-dashboard-v1';
const STATIC_CACHE = 'smart-dashboard-static-v1';

// Список файлов для кэширования - только те, которые точно существуют
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js'
];

// Опциональные файлы (если существуют)
const optionalUrls = [
    '/manifest.json',
    '/favicon.ico',
    '/public/192.png',
    '/public/512.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('[SW] Установка Service Worker');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[SW] Кэширование основных файлов');
                // Сначала кэшируем основные файлы
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                // Затем пробуем кэшировать опциональные файлы (по одному)
                return caches.open(STATIC_CACHE);
            })
            .then(cache => {
                optionalUrls.forEach(url => {
                    fetch(url)
                        .then(response => {
                            if (response.ok) {
                                cache.put(url, response);
                                console.log('[SW] Кэширован опциональный файл:', url);
                            } else {
                                console.log('[SW] Файл не найден, пропускаем:', url);
                            }
                        })
                        .catch(err => {
                            console.log('[SW] Ошибка загрузки файла:', url, err);
                        });
                });
            })
            .catch(err => {
                console.error('[SW] Ошибка кэширования:', err);
            })
    );
    
    self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', event => {
    console.log('[SW] Активация Service Worker');
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== STATIC_CACHE)
                    .map(key => {
                        console.log('[SW] Удаление старого кэша:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// Обработка fetch-запросов
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(networkResponse => {
                        // Кэшируем только успешные ответы
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(STATIC_CACHE)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    });
            })
            .catch(() => {
                // Офлайн режим
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                return new Response('Офлайн режим', { status: 503 });
            })
    );
});