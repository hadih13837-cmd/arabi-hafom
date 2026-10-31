// ============================================================
// service-worker.js — با بروزرسانی خودکار
// نسخه: v174 — با چالش هفتگی
// ============================================================

const CACHE_NAME = 'arabi-hafom-v177';

const urlsToCache = [
    './',
    './index.html',
    './clips.html',
    './jozve.html',
    './weekly-challenge.html',
    './teacher.html',
    './maintenance.html',
    './maintenance.json',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',

    './css/style.css',
    './css/teacher.css',

    './js/config.js',
    './js/utils.js',
    './js/supabase-config.js',
    './js/api.js',
    './js/avatars.js',
    './js/navigation.js',
    './js/notifications.js',
    './js/medals.js',
    './js/lessons.js',
    './js/quiz.js',
    './js/reports.js',
    './js/rankings.js',
    './js/settings.js',
    './js/app.js',
    './js/teacher.js',

    './lessons/index.json',
    './lessons/lesson1.json',
    './lessons/lesson2.json',
    './lessons/lesson3.json',
    './lessons/lesson4.json',
    './lessons/lesson5.json',
    './jozve/index.json',
    './stories.json',
    './challenges.json',
];

// نصب — فایل‌ها رو ذخیره کن و فوراً فعال شو
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                urlsToCache.map(url => cache.add(url).catch(err => console.warn('خطا در کش:', url)))
            );
        })
    );
});

// فعال‌سازی — کش‌های قدیمی رو پاک کن
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(names => {
            return Promise.all(
                names.map(name => {
                    if (name !== CACHE_NAME) {
                        console.log('🗑️ پاک کردن کش قدیمی:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// مدیریت fetch
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = event.request.url;

    // Supabase و realtime → همیشه شبکه
    if (url.includes('supabase.co') || url.includes('realtime') || url.includes('ws')) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
        return;
    }

    // CDN و تصاویر → همیشه شبکه
    if (url.includes('cdn.imgurl.ir') || url.includes('imgurl.ir') || url.includes('githubusercontent.com')) {
        event.respondWith(fetch(event.request, { mode: 'no-cors' }).catch(() => new Response('', { status: 503 })));
        return;
    }

    // 🆕 فایل‌های داده‌ای → NetworkFirst (همیشه تازه)
    if (url.includes('maintenance.json') || 
        url.includes('/lessons/') || 
        url.includes('/jozve/') || 
        url.includes('stories.json') || 
        url.includes('challenges.json') || 
        url.includes('/challenges/')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(response => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(c => c.put(event.request, clone).catch(() => {}));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // بقیه فایل‌ها: اول شبکه، بعد کش
    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone).catch(() => {}));
                }
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// پیام‌ها
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
        });
    }
});
