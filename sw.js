const currentCacheName = 'restaurant-v3';

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.open(currentCacheName).then((cache) => {
    return cache.match(event.request).then((response) => {
        if (response != undefined) {
          return cache.match(event.request);
        }
        else {
          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          });
        }
      });
  }));
});

self.addEventListener('activate', (event) => {
/**
  * Delete old caches.
  */
  event.waitUntil(caches.keys().then((keys) => {
    keys.forEach((key) => {
      if (key != currentCacheName) {
        caches.delete(key);
      }
    });
  }));
});