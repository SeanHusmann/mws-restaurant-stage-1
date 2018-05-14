// !ES6

/**
 * Set up IndexedDB database for storing restaurants.
 */
const indexDBPromise = idb.open('Restaurant Reviews', 2, (upgradeDBObject) => {
  switch (upgradeDBObject.oldVersion) {
    case 0:
    	upgradeDBObject.createObjectStore('restaurants', {
      	keyPath: 'id'
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
    indexDBPromise.then((db) => {
      let restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
      restaurantsObjectStore.count().then((count) => {
        if (count > 0) {
          restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
          restaurantsObjectStore.getAll().then((restaurants) => {
						console.log("fetching restaurants from idb");
            callback(null, restaurants);
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
    
/*    fetch(DBHelper.DATABASE_URL).then((response) => {
      if (response.ok){
        response.json().then((restaurants) => {
          callback(null, restaurants);
        });
      }
      else {
        const error = (`Request failed. Returned status of ${response.status}`);
        callback(error, null);
      }
    });*/
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
    * Check local IndexedDB database first and return reviews from there
		* if available. Then, fetch reviews from network, return new ones to
		* callback and put them in the local IndexedDB database for future calls.
    */
    indexDBPromise.then((db) => {
      let reviewsByDateIndex = db.transaction('restaurant-reviews', 'readwrite').objectStore('restaurant-reviews').index('by-date');
      reviewsByDateIndex.getAll().then((reviews) => {
				const reviewsByRestaurantId = reviews.filter(review => review.restaurant_id == id);
				
				callback(reviewsByRestaurantId);
				
				fetch(`http://localhost:1337/reviews/?restaurant_id=${id}`).then((response) => {
					if (response.ok) {
						response.json().then((reviewsFromNetwork) => {
							const newReviews = reviewsFromNetwork.filter(review => reviewsByRestaurantId.includes(review) === false);
							
							callback(reviewsFromNetwork);
							
							console.log(newReviews);
						});
					}
					else {
						console.log(`Network fetch for reviews failed. Returned status of ${response.status}`);
					}
				});
				
/*				if (reviewsByRestaurantId.length > 0) {
					console.log("Reviews found for restaurant in local database. Fetching reviews  from network.");
					callback(null, restaurants);
				}
				else {
					console.log("No reviews found for restaurant in local database. Fetching reviews  from network.");
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
        }*/
			});
    });		
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
