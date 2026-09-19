const CACHE_NAME = 'arabi-hafom-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-512.png',
  'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdn.imgurl.ir/uploads/p244186_file_00000000d22482109057bd776e2cf122.png',
  'https://cdn.imgurl.ir/uploads/d75534_file_000000007ad481f4b2c1c6420f5e62d9.png',
  'https://cdn.imgurl.ir/uploads/y212653___.png',
  'https://cdn.imgurl.ir/uploads/x512773_Instrumental-Music-For-Funny-Video-Clip-8.mp3'
];

// نصب و ذخیره فایل‌ها در کش
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('ذخیره فایل‌ها در کش');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('خطا در ذخیره:', err))
  );
  self.skipWaiting();
});

// فعال‌سازی و پاک کردن کش قدیمی
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// پاسخگویی از کش در صورت آفلاین بودن
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
      .catch(() => {
        return caches.match('./index.html');
      })
  );
});