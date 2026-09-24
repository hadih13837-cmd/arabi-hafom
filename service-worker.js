const CACHE_NAME = 'arabi-hafom-v29';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png',
  './lessons/index.json',
  './lessons/lesson1.json',
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.imgurl.ir/uploads/p244186_file_00000000d22482109057bd776e2cf122.png',
  'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png',
  'https://cdn.imgurl.ir/uploads/y212653___.png',
  'https://cdn.imgurl.ir/uploads/x512773_Instrumental-Music-For-Funny-Video-Clip-8.mp3'
];

// ==================== نصب Service Worker ====================
// در این مرحله، فایل‌های لیست شده در urlsToCache دانلود و در حافظه کش ذخیره می‌شوند
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ ذخیره فایل‌ها در کش با موفقیت شروع شد');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ همه فایل‌ها با موفقیت در کش ذخیره شدند');
      })
      .catch(err => {
        console.log('❌ خطا در ذخیره فایل‌ها:', err);
      })
  );
  // فعال‌سازی فوری Service Worker جدید (بدون انتظار)
  self.skipWaiting();
});

// ==================== فعال‌سازی Service Worker ====================
// در این مرحله، کش‌های قدیمی (نسخه‌های قبلی) پاک می‌شوند
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            // اگر نام کش، با CACHE_NAME فعلی متفاوت بود، آن را پاک کن
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
  // کنترل فوری همه کلاینت‌ها (تب‌های باز)
  self.clients.claim();
});

// ==================== مدیریت درخواست‌ها ====================
// استراتژی: اول از کش بخون، اگر نبود از شبکه بگیر
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // اگر فایل در کش موجود بود، همان را برگردان
        if (response) {
          return response;
        }
        
        // اگر در کش نبود، از شبکه درخواست کن
        return fetch(event.request)
          .then(response => {
            // بررسی معتبر بودن پاسخ
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // کپی از پاسخ برای ذخیره در کش
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          });
      })
      .catch(() => {
        // اگر شبکه قطع بود و فایل در کش نبود، صفحه اصلی را نشان بده
        return caches.match('./index.html');
      })
  );
});

// ==================== پیام‌های دریافتی ====================
// اگر از سمت کلاینت پیامی برای آپدیت یا حذف کش بیاید، مدیریت کن
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
