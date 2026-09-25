const CACHE_NAME = 'arabi-hafom-v4';
const urlsToCache = [
  './',
  './index.html',
  './clips.html',
  './maintenance.html',
  './maintenance.json',
  './manifest.json',
  './icon-512.png',
  './lessons/index.json',
  './lessons/lesson1.json',
  './lessons/lesson2.json',
  './lessons/lesson3.json',
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

// ==================== نصب Service Worker ====================
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

// ==================== فعال‌سازی Service Worker ====================
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

// ==================== مدیریت درخواست‌ها ====================
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  // فایل maintenance.json رو همیشه از شبکه بگیر (نه از کش)
  if (event.request.url.includes('maintenance.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  
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

// ==================== پیام‌های دریافتی ====================
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