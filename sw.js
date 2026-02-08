// Service Worker لنظام مياه السوفعي الذكي
const CACHE_NAME = 'soufai-water-cache-v6';
const urlsToCache = [
  './',                     // الصفحة الرئيسية
  './جاهز للانطلاق.y.html', // ملفك الرئيسي
  './manifest.json'         // ملف تعريف التطبيق
];

// تثبيت Service Worker
self.addEventListener('install', event => {
  console.log('🔧 جاري تثبيت Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 تخزين الملفات الأساسية في الكاش');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ تم التثبيت بنجاح');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ خطأ في التثبيت:', error);
      })
  );
});

// تفعيل Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 تفعيل Service Worker...');
  
  event.waitUntil(
    // تنظيف الكاش القديم
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧹 حذف الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker مفعل وجاهز');
      return self.clients.claim();
    })
  );
});

// التعامل مع طلبات الشبكة (FETCH)
self.addEventListener('fetch', event => {
  // تجاهل طلبات POST وغير GET
  if (event.request.method !== 'GET') return;

  // استراتيجية: الكاش أولاً ثم الشبكة
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // إذا الملف موجود في الكاش
        if (cachedResponse) {
          console.log('📂 استرجاع من الكاش:', event.request.url);
          return cachedResponse;
        }

        // إذا لم يكن في الكاش، جلب من الشبكة
        console.log('🌐 جلب من الشبكة:', event.request.url);
        
        return fetch(event.request)
          .then(networkResponse => {
            // التحقق من صحة الاستجابة
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            // تخزين الموارد الجديدة في الكاش
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('💾 تم تخزين في الكاش:', event.request.url);
              });

            return networkResponse;
          })
          .catch(error => {
            console.error('❌ فشل في جلب المورد:', error);
            
            // إذا فشل الاتصال، حاول تقديم بديل
            if (event.request.mode === 'navigate') {
              return caches.match('./جاهز للانطلاق.y.html');
            }
            
            // للصور والموارد الأخرى، يمكنك إرجاع بديل
            if (event.request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#030814"/><text x="50" y="65" font-size="40" text-anchor="middle" fill="#4cc9f0">💧</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
            
            return new Response('فشل الاتصال بالشبكة', {
              status: 408,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            });
          });
      })
  );
});

// ============ إضافات متقدمة ============

// مزامنة البيانات في الخلفية (للتحديثات)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('🔄 جاري مزامنة البيانات في الخلفية...');
  
  try {
    // هنا يمكنك إضافة منطق مزامنة البيانات مع السيرفر
    const cache = await caches.open(CACHE_NAME);
    const cachedData = await cache.keys();
    
    console.log(`📊 ${cachedData.length} ملف مخزن في الكاش`);
    
    // إرسال إشعار بنجاح المزامنة
    self.registration.showNotification('نظام السوفعي', {
      body: 'تم تحديث البيانات في الخلفية',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#030814"/><text x="50" y="65" font-size="40" text-anchor="middle" fill="#4cc9f0">💧</text></svg>',
      tag: 'data-sync'
    });
    
  } catch (error) {
    console.error('❌ فشل المزامنة:', error);
  }
}

// تحديث دوري للبيانات
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  console.log('📡 تحديث الكاش في الخلفية...');
  
  try {
    // تحديث الملفات الأساسية
    const cache = await caches.open(CACHE_NAME);
    
    for (const url of urlsToCache) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          console.log(`✅ تم تحديث: ${url}`);
        }
      } catch (error) {
        console.warn(`⚠️ لم يتم تحديث: ${url}`, error);
      }
    }
    
  } catch (error) {
    console.error('❌ فشل تحديث الكاش:', error);
  }
}

// التعامل مع التنبيهات
self.addEventListener('push', event => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body || 'تحديث جديد في نظام مياه السوفعي',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#030814"/><text x="50" y="65" font-size="40" text-anchor="middle" fill="#4cc9f0">💧</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="#4cc9f0"/></svg>',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open-app',
        title: 'فتح التطبيق'
      },
      {
        action: 'dismiss',
        title: 'تجاهل'
      }
    ],
    requireInteraction: true
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || '💧 نظام مياه السوفعي',
      options
    )
  );
});

// النقر على التنبيهات
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open-app') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

// رسالة من الصفحة الرئيسية
self.addEventListener('message', event => {
  console.log('📨 رسالة من الصفحة:', event.data);
  
  if (event.data.type === 'CACHE_NEW_DATA') {
    // تخزين بيانات جديدة في الكاش
    cacheNewData(event.data.payload);
  }
});

async function cacheNewData(data) {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // تخزين بيانات JSON
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const response = new Response(blob);
    
    await cache.put('/api/data.json', response);
    console.log('💾 تم تخزين البيانات الجديدة');
    
  } catch (error) {
    console.error('❌ فشل تخزين البيانات:', error);
  }
}

// ============ وظائف مساعدة ============

// التحقق من اتصال الإنترنت
async function isOnline() {
  try {
    const response = await fetch('./', { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// الحصول على حجم الكاش
async function getCacheSize() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  let totalSize = 0;
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const blob = await response.blob();
      totalSize += blob.size;
    }
  }
  
  return totalSize;
}

// تنظيف الكاش القديم
async function cleanupOldCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  for (const request of keys) {
    const response = await cache.match(request);
    if (response) {
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        const cachedDate = new Date(dateHeader).getTime();
        if (cachedDate < weekAgo) {
          await cache.delete(request);
          console.log('🗑️ حذف ملف قديم:', request.url);
        }
      }
    }
  }
}

// تشغيل التنظيف كل يوم
setInterval(() => {
  cleanupOldCache();
}, 24 * 60 * 60 * 1000);

// إرسال إحصائيات الكاش للصفحة الرئيسية
setInterval(async () => {
  const cacheSize = await getCacheSize();
  const online = await isOnline();
  
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'CACHE_STATS',
        payload: {
          size: cacheSize,
          online: online,
          timestamp: Date.now()
        }
      });
    });
  });
}, 30000); // كل 30 ثانية