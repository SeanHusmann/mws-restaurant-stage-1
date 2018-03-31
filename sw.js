const currentCacheName = 'restaurant-v1';

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.open(currentCacheName).then((cache) => {
    if (cache.match(event.request)) {
      return cache.match(event.request);
    }
    else {
      return fetch(event.request).then((response) => {
        if (response.ok) {
          cache.put(request, response);
        }
        return response;
      });
    }
  }));
});