// !ES6

/**
 * Set up IndexedDB database for storing restaurants.
 */
const indexDBPromise = idb.open('Restaurant Reviews', 2, (upgradeDBObject) => {
  switch (upgradeDBObject.oldVersion) {
    case 0:
    	upgradeDBObject.createObjectStore('restaurants', {
      	keyPath: 'id',
				autoIncrement: true
    	});
		case 1:
    	upgradeDBObject.createObjectStore('restaurant-reviews', {
      	keyPath: 'id'
    	}).createIndex('by-date', 'updatedAt');
  }
})

/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    /**
    * Check local IndexedDB database first and return restaurants from there if available.
    * Otherwise, fetch restaurants from network, return them to callback and put them in 
    * the local IndexedDB database for future calls.
    */

		// Return entries from local IDB first to speed up time to first render:
    indexDBPromise.then((db) => {
      let restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
      restaurantsObjectStore.count().then((count) => {
        if (count > 0) {
          restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
          restaurantsObjectStore.getAll().then((restaurants) => {
						console.log("fetching restaurants from idb");
            callback(null, restaurants);
          });
					
					// Update IDB entries:
					fetch(DBHelper.DATABASE_URL).then((response) => {
						if (response.ok){
							response.json().then((restaurants) => {
								restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
								restaurants.forEach((restaurant) => {
									restaurantsObjectStore.put(restaurant);
								});
							});
						}
						else {
							const error = (`Request failed. Returned status of ${response.status}`);
						}
					});
        }
				else {				
					console.log("fetching restaurants from network");
					fetch(DBHelper.DATABASE_URL).then((response) => {
						if (response.ok){
							response.json().then((restaurants) => {
								restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
								restaurants.forEach((restaurant) => {
									restaurantsObjectStore.put(restaurant);
								});
								callback(null, restaurants);
							});
						}
						else {
							const error = (`Request failed. Returned status of ${response.status}`);
							callback(error, null);
						}
					});
				}
        
      });
    });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }
	
	/**
   * Fetch all reviews for a restaurant.
   */
	static fetchReviewsByRestaurantId(id, callback) {
    /**
    * (1) Check local IndexedDB database first and return reviews from there
		* if available. 
		* (2) Then, try to fetch reviews from network, 
		* (3) clear the IndexedDB database,
		* (4) return the freshly fetched reviews to the callback,
		* (5) and put them into the local IndexedDB again.
		* The clearing of the local database is necessary because reviews may have been 
		* deleted, or edited/updated. We can not only add new reviews, because
		* we'd ignore any edited reviews. And we can not just update existing reviews
		* and add new ones to the local database, because we'd ignore if a review was deleted.
    */
    indexDBPromise.then((db) => {
			let reviewsObjectStore = db.transaction('restaurant-reviews', 'readwrite').objectStore('restaurant-reviews');
      let reviewsByDateIndex = reviewsObjectStore.index('by-date');
      reviewsByDateIndex.getAll().then((reviews) => {
				const reviewsByRestaurantId = reviews.filter(review => review.restaurant_id == id);
				
				// (1)
				callback(reviewsByRestaurantId);
				
				// (2)
				fetch(`http://localhost:1337/reviews/?restaurant_id=${id}`).then((response) => {
					if (response.ok) {
						// (3) We only clear the database, if we successfully fetched updated data:
						reviewsObjectStore = db.transaction('restaurant-reviews', 'readwrite').objectStore('restaurant-reviews');
						reviewsByRestaurantId.forEach((review) => {
							reviewsObjectStore.delete(review.id);
						});
						
						// (4)
						response.json().then((reviewsFromNetwork) => {			
							callback(reviewsFromNetwork);
							
							// (5)
							reviewsObjectStore = db.transaction('restaurant-reviews', 'readwrite').objectStore('restaurant-reviews');
							reviewsFromNetwork.forEach((review) => {
								reviewsObjectStore.add(review);
							});
						});
					}
					else {
						console.log(`Network fetch for reviews failed. Returned status of ${response.statusText}`);
					}
				}).catch((error) => {
					console.log(`Network fetch for reviews failed. Are you offline? Error: ${error}`);
				});
				
			});
    });		
	}

	/**
   * Submit a new restaurant review to the server and save it locally to IDB for
	 * offline use.
	 * (1) Save review to user's IndexedDB.
	 * (2) POST review to server.
	 * (3) If POST fetch fails with a network error (offline), which is the case when we
	 * reach fetch.catch(), then keep attempting to send the review, until it works.
   */
	static postNewReview(newReview) {
		
		// (1)
		indexDBPromise.then((db) => {
			let reviewsObjectStore = db.transaction('restaurant-reviews', 'readwrite').objectStore('restaurant-reviews');
			
			// Before adding an entry to our IDB, we need to assign
			// a unique id to our review, since this is our primary key
			// and IDB won't let us add anything without one:
			reviewsObjectStore.getAllKeys().then((keys) => {
				const latestReviewId = keys[(keys.length - 1)];
				newReview.id = (latestReviewId + 1);
				
				reviewsObjectStore.add(newReview).catch((error) => {
					console.log(`Failed to add review to IDB. Error: ${error}`);
				});
			});
		});
		
		const newReviewJSON = JSON.stringify(newReview);
		const postReview = () => {
			const newReviewPOSTRequest = new Request('http://localhost:1337/reviews/', {
				method: 'POST',
				body: newReviewJSON
			});
			
			fetch(newReviewPOSTRequest).then((response) => {
	
				if (response.ok === false) {
					console.log(`Failed to POST review. HTTP Response Status: ${response.statusText}`);
					
					setTimeout(postReview, 3000);
				}
				else {
					console.log('Successfully POSTed new review to server.');
				}
			}).catch((error) => {
				console.log(`Failed to POST review. Network Error: ${error}`);
				
				setTimeout(postReview, 3000);
			});
		};
		// (3)
		console.log(`navigator.onLine === ${navigator.onLine}`);
		if (navigator.onLine === false) {
			window.addEventListener('online', postReview);
		}
		// (2)
		else {
			postReview();
		}
	}
	
	/**
   * Mark or unmark a restaurant as favorite.
	 * (1) Update local IDB entry of restaurant via a PUT operation.
	 * (2) Update server database entry of restaurant via an HTTP PUT request.
	 * (2.1) If offline, defer PUT request until online again.
   */
	static favoriteRestaurant (restaurant, isFavorite) {
		// (1)
		restaurant.is_favorite = isFavorite;
		
		indexDBPromise.then((db) => {
			const restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
			
			restaurantsObjectStore.put(restaurant);
		});
		
		// (2)
		const putFavorite = () => {
			const favoritePUTRequest = new Request(`http://localhost:1337/restaurants/${restaurant.id}/?is_favorite=${isFavorite}`, {
				method: 'PUT',
			});
			
			fetch(favoritePUTRequest).then((response) => {
	
				if (response.ok === false) {
					console.log(`Failed to PUT favorite. HTTP Response Status: ${response.statusText}`);
					
					setTimeout(putFavorite, 3000);
				}
				else {
					console.log('Successfully PUT favorite to server.');
				}
			}).catch((error) => {
				console.log(`Failed to PUT favorite. Network Error: ${error}`);
				
				setTimeout(putFavorite, 3000);
			});
		};
		
		console.log(`navigator.onLine === ${navigator.onLine}`);
		if (navigator.onLine === false) {
			window.addEventListener('online', putFavorite);
		}
		
		else {
			putFavorite();
		}
	}
	
  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }
	
  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (`/img/${restaurant.photograph}`);
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  }

}
