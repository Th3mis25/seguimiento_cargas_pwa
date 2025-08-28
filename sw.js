// Service Worker básico para cachear assets de la PWA
const CACHE_NAME = 'cargas-pwa-v10';
const DYNAMIC_CACHE = 'cargas-pwa-dynamic-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './assets/logo.png',
  // agrega aquí otros archivos si los tienes (manifest, íconos, etc.)
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS))
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k=>![CACHE_NAME, DYNAMIC_CACHE].includes(k)).map(k=>caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', e=>{
  const { request } = e;
  e.respondWith(
    caches.match(request).then(cacheRes=>{
      const fetchPromise = fetch(request).then(netRes=>{
        const clone = netRes.clone();
        caches.open(DYNAMIC_CACHE).then(c=>c.put(request, clone));
        return netRes;
      }).catch(()=>cacheRes || Response.error());
      return cacheRes || fetchPromise;
    })
  );
});
