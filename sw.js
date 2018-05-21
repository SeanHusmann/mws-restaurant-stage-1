const currentCacheName = 'restaurant-v77';
const APIServerOrigin = 'http://localhost:1337';

self.addEventListener('fetch', (event) => {
	
	const requestURL = new URL(event.request.url);
	let isNotCachedResource = (requestURL.origin === APIServerOrigin);
	
	if (isNotCachedResource) {
		event.respondWith(fetch(event.request).then((response) => {
			return response;
		}).catch((error) => {
			console.log(`Couldn't load: ${event.request.url}. Are you offline? Error: ${error}.`);
		}));
	}
	else {
		/**
		* For any fetch for a cached resource, first try to return a cached file, if it exists.
		*/
		event.respondWith(caches.open(currentCacheName).then((cache) => {
			return cache.match(event.request).then((response) => {
					if (response != undefined) {
						return response;//cache.match(event.request);
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
	}
});


self.addEventListener('activate', (event) => {
/**
  * Delete old caches.
  */
  event.waitUntil(caches.keys().then((keys) => {
    return Promise.all(keys.filter(key => (key != currentCacheName)).map((key) => {
      return caches.delete(key);
    }));
  }));
});