/* Generated by Babel */
// !ES6

/**
 * Set up IndexedDB database for storing restaurants.
 */
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var indexDBPromise = idb.open('Restaurant Reviews', 2, function (upgradeDBObject) {
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
});

/**
 * Common database helper functions.
 */

var DBHelper = (function () {
  function DBHelper() {
    _classCallCheck(this, DBHelper);
  }

  _createClass(DBHelper, null, [{
    key: 'fetchRestaurants',

    /**
     * Fetch all restaurants.
     */
    value: function fetchRestaurants(callback) {
      /**
      * Check local IndexedDB database first and return restaurants from there if available.
      * Otherwise, fetch restaurants from network, return them to callback and put them in 
      * the local IndexedDB database for future calls.
      */
      indexDBPromise.then(function (db) {
        var restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
        restaurantsObjectStore.count().then(function (count) {
          if (count > 0) {
            restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
            restaurantsObjectStore.getAll().then(function (restaurants) {
              console.log("fetching restaurants from idb");
              callback(null, restaurants);
            });
          } else {
            console.log("fetching restaurants from network");
            fetch(DBHelper.DATABASE_URL).then(function (response) {
              if (response.ok) {
                response.json().then(function (restaurants) {
                  restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
                  restaurants.forEach(function (restaurant) {
                    restaurantsObjectStore.put(restaurant);
                  });
                  callback(null, restaurants);
                });
              } else {
                var error = 'Request failed. Returned status of ' + response.status;
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
  }, {
    key: 'fetchRestaurantById',
    value: function fetchRestaurantById(id, callback) {
      // fetch all restaurants with proper error handling.
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var restaurant = restaurants.find(function (r) {
            return r.id == id;
          });
          if (restaurant) {
            // Got the restaurant
            callback(null, restaurant);
          } else {
            // Restaurant does not exist in the database
            callback('Restaurant does not exist', null);
          }
        }
      });
    }

    /**
      * Fetch all reviews for a restaurant.
      */
  }, {
    key: 'fetchReviewsByRestaurantId',
    value: function fetchReviewsByRestaurantId(id, callback) {
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
      indexDBPromise.then(function (db) {
        var reviewsObjectStore = db.transaction('restaurant-reviews', 'readwrite').objectStore('restaurant-reviews');
        var reviewsByDateIndex = reviewsObjectStore.index('by-date');
        reviewsByDateIndex.getAll().then(function (reviews) {
          var reviewsByRestaurantId = reviews.filter(function (review) {
            return review.restaurant_id == id;
          });

          // (1)
          callback(reviewsByRestaurantId);

          // (2)
          fetch('http://localhost:1337/reviews/?restaurant_id=' + id).then(function (response) {
            if (response.ok) {
              // (3) We only clear the database, if we successfully fetched updated data:
              reviewsObjectStore = db.transaction('restaurant-reviews', 'readwrite').objectStore('restaurant-reviews');
              reviewsByRestaurantId.forEach(function (review) {
                reviewsObjectStore['delete'](review.id);
              });

              // (4)
              response.json().then(function (reviewsFromNetwork) {
                callback(reviewsFromNetwork);

                // (5)
                reviewsObjectStore = db.transaction('restaurant-reviews', 'readwrite').objectStore('restaurant-reviews');
                reviewsFromNetwork.forEach(function (review) {
                  reviewsObjectStore.add(review);
                });
              });
            } else {
              console.log('Network fetch for reviews failed. Returned status of ' + response.status);
            }
          })['catch'](function (error) {
            console.log('Network fetch for reviews failed. Are you offline? Error: ' + error);
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
  }, {
    key: 'fetchRestaurantByCuisine',
    value: function fetchRestaurantByCuisine(cuisine, callback) {
      // Fetch all restaurants  with proper error handling
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Filter restaurants to have only given cuisine type
          var results = restaurants.filter(function (r) {
            return r.cuisine_type == cuisine;
          });
          callback(null, results);
        }
      });
    }

    /**
     * Fetch restaurants by a neighborhood with proper error handling.
     */
  }, {
    key: 'fetchRestaurantByNeighborhood',
    value: function fetchRestaurantByNeighborhood(neighborhood, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Filter restaurants to have only given neighborhood
          var results = restaurants.filter(function (r) {
            return r.neighborhood == neighborhood;
          });
          callback(null, results);
        }
      });
    }

    /**
     * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
     */
  }, {
    key: 'fetchRestaurantByCuisineAndNeighborhood',
    value: function fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var results = restaurants;
          if (cuisine != 'all') {
            // filter by cuisine
            results = results.filter(function (r) {
              return r.cuisine_type == cuisine;
            });
          }
          if (neighborhood != 'all') {
            // filter by neighborhood
            results = results.filter(function (r) {
              return r.neighborhood == neighborhood;
            });
          }
          callback(null, results);
        }
      });
    }

    /**
     * Fetch all neighborhoods with proper error handling.
     */
  }, {
    key: 'fetchNeighborhoods',
    value: function fetchNeighborhoods(callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          (function () {
            // Get all neighborhoods from all restaurants
            var neighborhoods = restaurants.map(function (v, i) {
              return restaurants[i].neighborhood;
            });
            // Remove duplicates from neighborhoods
            var uniqueNeighborhoods = neighborhoods.filter(function (v, i) {
              return neighborhoods.indexOf(v) == i;
            });
            callback(null, uniqueNeighborhoods);
          })();
        }
      });
    }

    /**
     * Fetch all cuisines with proper error handling.
     */
  }, {
    key: 'fetchCuisines',
    value: function fetchCuisines(callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          (function () {
            // Get all cuisines from all restaurants
            var cuisines = restaurants.map(function (v, i) {
              return restaurants[i].cuisine_type;
            });
            // Remove duplicates from cuisines
            var uniqueCuisines = cuisines.filter(function (v, i) {
              return cuisines.indexOf(v) == i;
            });
            callback(null, uniqueCuisines);
          })();
        }
      });
    }

    /**
     * Restaurant page URL.
     */
  }, {
    key: 'urlForRestaurant',
    value: function urlForRestaurant(restaurant) {
      return './restaurant.html?id=' + restaurant.id;
    }

    /**
     * Restaurant image URL.
     */
  }, {
    key: 'imageUrlForRestaurant',
    value: function imageUrlForRestaurant(restaurant) {
      return '/img/' + restaurant.photograph;
    }

    /**
     * Map marker for a restaurant.
     */
  }, {
    key: 'mapMarkerForRestaurant',
    value: function mapMarkerForRestaurant(restaurant, map) {
      var marker = new google.maps.Marker({
        position: restaurant.latlng,
        title: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant),
        map: map,
        animation: google.maps.Animation.DROP });
      return marker;
    }
  }, {
    key: 'DATABASE_URL',

    /**
     * Database URL.
     * Change this to restaurants.json file location on your server.
     */
    get: function get() {
      var port = 1337; // Change this to your server port
      return 'http://localhost:' + port + '/restaurants';
    }
  }]);

  return DBHelper;
})();