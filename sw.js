// sw.js - Service Worker متقدم للعمل بدون نت
const CACHE_NAME = 'water-system-v2.0';
const APP_VERSION = '2.0.2026';

// روابط للتخزين في الكاش
const STATIC_CACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// روابط CDN للتخزين
const EXTERNAL_CACHE_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap',
  'https://unpkg.com/vue@3/dist/vue.global.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('📦 تثبيت Service Worker - إصدار:', APP_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('🗂️ فتح الكاش:', CACHE_NAME);
        // تخزين الملفات الأساسية
        return cache.addAll(STATIC_CACHE_URLS)
          .then(() => {
            console.log('✅ تم تخزين الملفات الأساسية');
            // تخزين ملفات CDN
            return Promise.all(
              EXTERNAL_CACHE_URLS.map(url => 
                fetch(url)
                  .then(response => {
                    if (response.ok) {
                      return cache.put(url, response);
                    }
                  })
                  .catch(err => console.warn('⚠️ فشل تخزين:', url, err))
              )
            );
          })
          .then(() => {
            console.log('🎯 تم التثبيت بنجاح');
            self.skipWaiting();
          });
      })
      .catch(err => {
        console.error('❌ خطأ في التثبيت:', err);
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 تفعيل Service Worker');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ حذف الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ تم التفعيل بنجاح');
      return self.clients.claim();
    })
  );
});

// معالجة الطلبات
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  
  // استثناء Google Sheets من الكاش (لضمان بيانات حديثة)
  if (requestUrl.hostname.includes('google.com') || 
      requestUrl.hostname.includes('script.googleusercontent.com')) {
    // تمرير مباشر للشبكة
    return;
  }
  
  // استثناء الطلبات POST/PUT
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // أولوية للكاش
        if (cachedResponse) {
          console.log('💾 استرجاع من الكاش:', requestUrl.pathname);
          
          // تحديث الكاش في الخلفية
          fetch(event.request)
            .then(response => {
              if (response.ok) {
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, response));
              }
            })
            .catch(() => {}); // تجاهل الأخطاء في التحديث الخلفي
          
          return cachedResponse;
        }
        
        // إذا لم يكن في الكاش، جلب من الشبكة
        console.log('🌐 جلب من الشبكة:', requestUrl.pathname);
        return fetch(event.request)
          .then(response => {
            // التحقق من أن الاستجابة صالحة للتخزين
            if (response.ok && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone));
            }
            return response;
          })
          .catch(error => {
            console.error('❌ فشل الاتصال:', error);
            // رد افتراضي للصفحة الرئيسية إذا فشل كل شيء
            if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
              return new Response(
                '<!DOCTYPE html><html dir="rtl"><head><title>نظام مياه السوفعي</title><meta charset="UTF-8"><style>body{font-family:Tajawal;background:#000814;color:white;text-align:center;padding:50px;}</style></head><body><h1>💧 نظام مياه السوفعي</h1><p>التطبيق يعمل بدون اتصال بالإنترنت</p><p>جاري تحميل البيانات المخزنة محلياً...</p><script>setTimeout(()=>location.reload(),3000);</script></body></html>',
                {
                  headers: { 'Content-Type': 'text/html; charset=utf-8' }
                }
              );
            }
            throw error;
          });
      })
  );
});

// استقبال رسائل من التطبيق
self.addEventListener('message', event => {
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME)
      .then(() => {
        console.log('🧹 تم مسح الكاش بناءً على طلب التطبيق');
        event.ports[0].postMessage('تم مسح الكاش');
      });
  }
  
  if (event.data === 'GET_CACHE_STATUS') {
    caches.open(CACHE_NAME)
      .then(cache => cache.keys())
      .then(keys => {
        event.ports[0].postMessage({
          cacheName: CACHE_NAME,
          itemCount: keys.length,
          version: APP_VERSION
        });
      });
  }
});

// التحديث التلقائي كل أسبوع
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  console.log('🔄 جاري التحديث التلقائي للكاش');
  const cache = await caches.open(CACHE_NAME);
  
  // تحديث الملفات الأساسية
  for (const url of STATIC_CACHE_URLS) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (error) {
      console.warn('⚠️ فشل تحديث:', url);
    }
  }
}

// معالجة دفع الإشعارات (مستقبلاً)
self.addEventListener('push', event => {
  const options = {
    body: 'نظام مياه السوفعي - إشعار جديد',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23030814"/><path d="M30,30 L70,30 L70,70 L30,70 Z" fill="%234cc9f0"/><rect x="35" y="35" width="30" height="20" fill="%23030814"/><circle cx="50" cy="60" r="3" fill="%234cc9f0"/></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%23ff4757"/></svg>',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 'water-system-notification'
    },
    actions: [
      {
        action: 'open',
        title: 'فتح التطبيق'
      },
      {
        action: 'close',
        title: 'إغلاق'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('💧 نظام مياه السوفعي', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});