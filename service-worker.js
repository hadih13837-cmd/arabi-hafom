// ============================================================
// service-worker.js — کش کردن فایل‌ها برای کارکرد آفلاین
// نسخه: v62
// ============================================================

const CACHE_NAME = 'arabi-hafom-v76';

// ============================================================
// لیست فایل‌های ضروری برای کش
// ============================================================
const urlsToCache = [
    './',
    './index.html',
    './clips.html',
    './maintenance.html',
    './maintenance.json',
    './manifest.json',
    './icon-512.png',

    './css/style.css',

    './js/config.js',
    './js/utils.js',
    './js/supabase.js',
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

    './lessons/index.json',
    './lessons/lesson1.json',
    './lessons/lesson2.json',

    'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',

    'https://cdn.imgurl.ir/uploads/p244186_file_00000000d22482109057bd776e2cf122.png',
    'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png',
    'https://cdn.imgurl.ir/uploads/y212653___.png',
    'https://cdn.imgurl.ir/uploads/x512773_Instrumental-Music-For-Funny-Video-Clip-8.mp3',
    'https://cdn.imgurl.ir/uploads/y058507__.png',
    'https://cdn.imgurl.ir/uploads/n50857_IMG__.png',
    'https://cdn.imgurl.ir/uploads/f76502_IMG__.png',
    'https://cdn.imgurl.ir/uploads/b632041_IMG__.png',
    'https://cdn.imgurl.ir/uploads/l655746___.png',
    'https://cdn.imgurl.ir/uploads/c3352_ChatGPT_Image_Sep_21_2026_09_21_08_PM.png',
    'https://cdn.imgurl.ir/uploads/j02258_InShot_20260921_091848739.mp4',
    'https://cdn.imgurl.ir/uploads/m31567_IMG__.png',
    'https://cdn.imgurl.ir/uploads/p313911_IMG__.png',
    'https://cdn.imgurl.ir/uploads/f058661_IMG__.png',
    'https://cdn.imgurl.ir/uploads/k1280_IMG__.png',
    'https://cdn.imgurl.ir/uploads/q178853_IMG__.png',
    'https://cdn.imgurl.ir/uploads/a3501_IMG__.png',
    'https://cdn.imgurl.ir/uploads/i392811_file_000000004034822fab3dfb7fe4276696.png'
];

// ============================================================
// نصب Service Worker
// ============================================================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ شروع ذخیره فایل‌ها در کش');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ همه فایل‌ها با موفقیت در کش ذخیره شدند');
            })
            .catch(err => {
                console.log('❌ خطا در ذخیره فایل‌ها:', err);
            })
    );
    self.skipWaiting();
});

// ============================================================
// فعال‌سازی Service Worker
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
// مدیریت درخواست‌ها (fetch)
// ============================================================
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    // ۱. درخواست‌های Supabase — همیشه از شبکه
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() => {
                    return new Response(JSON.stringify([]), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
        return;
    }

    // ۲. فایل maintenance.json — همیشه از شبکه
    if (event.request.url.includes('maintenance.json')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // ۳. فایل‌های درس — همیشه از شبکه چک
    if (event.request.url.includes('/lessons/')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(response => {
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // ۴. بقیه درخواست‌ها — اول از کش، بعد از شبکه
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    })
                    .catch(() => {
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        return caches.match('./index.html');
                    });
            })
    );
});

// ============================================================
// پیام‌های دریافتی
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
