// Service Worker básico para cachear assets de la PWA
const CACHE_NAME = 'cargas-pwa-v10';
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
      keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
    ))
  );
});

self.addEventListener('fetch', e=>{
  const { request } = e;
  e.respondWith(
    caches.match(request).then(cacheRes=>{
      return cacheRes || fetch(request).then(netRes=>{
        // Cache-first con actualización perezosa
        return netRes;
      });
    })
  );
});
