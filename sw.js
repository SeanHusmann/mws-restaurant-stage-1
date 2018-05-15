const currentCacheName = 'restaurant-v4';

self.addEventListener('fetch', (event) => {
  /**
  * For any fetch, first try to return a cached file, if it exists.
  */
  event.respondWith(caches.open(currentCacheName).then((cache) => {
    return cache.match(event.request).then((response) => {
        if (response != undefined) {
          return cache.match(event.request);
        }
        else {
          return fetch(event.request).then((response) => {
              cache.put(event.request, response.clone());
            return response;
          }).catch((error) => {
            console.log(`Couldn't load: ${event.request.url}. Are you offline? Error: ${error}.`);
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