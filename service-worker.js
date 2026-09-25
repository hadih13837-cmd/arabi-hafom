// ============================================================
// service-worker.js — کش کردن فایل‌ها برای کارکرد آفلاین
// نسخه: v6 (نسخه‌ی جدید با ساختار multi-file)
// ============================================================

const CACHE_NAME = 'arabi-hafom-v49';

// ============================================================
// لیست فایل‌های ضروری برای کش
// ============================================================
const urlsToCache = [
    // صفحات اصلی
    './',
    './index.html',
    './clips.html',
    './maintenance.html',
    './maintenance.json',
    './manifest.json',
    './icon-512.png',

    // 🆕 فایل CSS
    './css/style.css',

    // 🆕 فایل‌های JavaScript (ترتیب مهم نیست، فقط کش می‌شن)
    './js/config.js',
    './js/utils.js',
    './js/navigation.js',
    './js/notifications.js',
    './js/medals.js',
    './js/lessons.js',
    './js/quiz.js',
    './js/reports.js',
    './js/settings.js',
    './js/app.js',

    // فایل‌های درس (این‌ها از کش استفاده می‌کنن، ولی در fetch از شبکه هم چک می‌شن)
    './lessons/index.json',
    './lessons/lesson1.json',

    // فونت و کتابخانه‌های خارجی
    'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
    'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',

    // تصاویر و ویدیوهای CDN
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

    // ۱. فایل maintenance.json — همیشه از شبکه (نه از کش)
    if (event.request.url.includes('maintenance.json')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 🆕 ۲. فایل‌های درس (lessons/*.json) — همیشه از شبکه چک، اگه نبود از کش
    if (event.request.url.includes('/lessons/')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .then(response => {
                    // کپی موفق رو توی کش ذخیره کن
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

    // ۳. بقیه درخواست‌ها — اول از کش، بعد از شبکه
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .then(response => {
                        // اگه درخواست معتبر بود، توی کش ذخیره کن
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
                        // اگه آفلاین بود و صفحه ناوبری، index.html رو برگردون
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
