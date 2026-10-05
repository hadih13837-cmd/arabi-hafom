// ============================================================
// service-worker.js — کش کردن فایل‌ها برای کارکرد آفلاین
// نسخه: v154 — با رفع CORS و چشمک زدن
// ============================================================

const CACHE_NAME = 'arabi-hafom-v158';

// ============================================================
// فایل‌های ضروری (فقط فایل‌های خود پروژه)
// ============================================================
const urlsToCache = [
    './',
    './index.html',
    './clips.html',
    './teacher.html',
    './maintenance.html',
    './maintenance.json',
    './manifest.json',
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

    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// ============================================================
// 🆕 نصب — با try/catch برای هر فایل
// ============================================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ شروع ذخیره فایل‌ها');
                
                // 🆕 هر فایل رو جداگانه اضافه کن (اگه یکی fail شد، بقیه ادامه بدن)
                return Promise.all(
                    urlsToCache.map(url => {
                        return cache.add(url).catch(err => {
                            console.warn('⚠️ خطا در کش کردن:', url, err.message);
                        });
                    })
                );
            })
            .then(() => {
                console.log('✅ همه فایل‌ها ذخیره شدند');
            })
            .catch(err => {
                console.log('❌ خطا:', err);
            })
    );
    self.skipWaiting();
});

// ============================================================
// فعال‌سازی
// ============================================================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cache => {
                        if (cache !== CACHE_NAME) {
                            console.log('🗑️ حذف کش قدیمی:', cache);
                            return caches.delete(cache);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker فعال شد');
            })
    );
    self.clients.claim();
});

// ============================================================
// 🆕 مدیریت fetch — با رفع قطعی CORS
// ============================================================
self.addEventListener('fetch', event => {
    // فقط GET
    if (event.request.method !== 'GET') return;

    const url = event.request.url;

    // 🆕 ۱. درخواست‌های Supabase — مستقیم از شبکه (نه کش)
    if (url.includes('supabase.co')) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
        return;
    }

    // 🆕 ۲. WebSocket / Realtime — مستقیم از شبکه
    if (url.includes('realtime') || url.includes('ws')) {
        event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
        return;
    }

    // 🆕 ۳. عکس‌های CDN خارجی (imgurl, githubusercontent و...) — کش نکن، مستقیم برو
    // این خط، مشکل CORS و چشمک زدن رو حل می‌کنه
    if (url.includes('cdn.imgurl.ir') || 
        url.includes('imgurl.ir') ||
        url.includes('githubusercontent.com') ||
        url.includes('googleusercontent.com')) {
        // 🆕 از کش نخون، مستقیم از شبکه
        event.respondWith(
            fetch(event.request, { mode: 'no-cors' })
                .catch(() => new Response('', { status: 503 }))
        );
        return;
    }

    // 🆕 ۴. maintenance.json — همیشه از شبکه
    if (url.includes('maintenance.json')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 🆕 ۵. فایل‌های درس — همیشه از شبکه چک
    if (url.includes('/lessons/')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(response => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone).catch(() => {});
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 🆕 ۶. بقیه درخواست‌ها — اول از کش
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) return response;
                return fetch(event.request)
                    .then(response => {
                        // فقط درخواست‌های موفق و same-origin رو کش کن
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache).catch(() => {});
                            });
                        return response;
                    })
                    .catch(() => {
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return new Response('', { status: 503 });
                    });
            })
    );
});

// ============================================================
// پیام‌ها
// ============================================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(names => {
            names.forEach(name => {
                caches.delete(name);
            });
        });
    }
});
