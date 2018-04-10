'use strict';

(function () {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function (resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function (value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function (prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function get() {
          return this[targetProp][prop];
        },
        set: function set(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', ['name', 'keyPath', 'multiEntry', 'unique']);

  proxyRequestMethods(Index, '_index', IDBIndex, ['get', 'getKey', 'getAll', 'getAllKeys', 'count']);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, ['openCursor', 'openKeyCursor']);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', ['direction', 'key', 'primaryKey', 'value']);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, ['update', 'delete']);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function (methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function () {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function () {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function (value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function () {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function () {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', ['name', 'keyPath', 'indexNames', 'autoIncrement']);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, ['put', 'add', 'delete', 'clear', 'get', 'getAll', 'getKey', 'getAllKeys', 'count']);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, ['openCursor', 'openKeyCursor']);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, ['deleteIndex']);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function (resolve, reject) {
      idbTransaction.oncomplete = function () {
        resolve();
      };
      idbTransaction.onerror = function () {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function () {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function () {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', ['objectStoreNames', 'mode']);

  proxyMethods(Transaction, '_tx', IDBTransaction, ['abort']);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function () {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', ['name', 'version', 'objectStoreNames']);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, ['deleteObjectStore', 'close']);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function () {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', ['name', 'version', 'objectStoreNames']);

  proxyMethods(DB, '_db', IDBDatabase, ['close']);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function (funcName) {
    [ObjectStore, Index].forEach(function (Constructor) {
      Constructor.prototype[funcName.replace('open', 'iterate')] = function () {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function () {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function (Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function (query, count) {
      var instance = this;
      var items = [];

      return new Promise(function (resolve) {
        instance.iterateCursor(query, function (cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor['continue']();
        });
      });
    };
  });

  var exp = {
    open: function open(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      request.onupgradeneeded = function (event) {
        if (upgradeCallback) {
          upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
        }
      };

      return p.then(function (db) {
        return new DB(db);
      });
    },
    'delete': function _delete(name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (typeof module !== 'undefined') {
    module.exports = exp;
    module.exports['default'] = module.exports;
  } else {
    self.idb = exp;
  }
})();






/**
 * Set up IndexedDB database for storing restaurants.
 */
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var indexDBPromise = idb.open('Restaurant Reviews', 1, function (upgradeDBObject) {
  switch (upgradeDBObject.oldVersion) {
    case 0:
      upgradeDBObject.createObjectStore('restaurants', {
        keyPath: 'id'
      });
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
              callback(null, restaurants);
            });
          } else {
            fetch(DBHelper.DATABASE_URL).then(function (response) {
              if (response.ok) {
                response.json().then(function (restaurants) {
                  callback(null, restaurants);
                  restaurantsObjectStore = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
                  restaurants.forEach(function (restaurant) {
                    restaurantsObjectStore.put(restaurant);
                  });
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
      var port = 8000; // Change this to your server port
      return 'http://localhost:1337/restaurants';
    }
  }]);

  return DBHelper;
})();




/* Generated by Babel */
// !ES6
'use strict';

var restaurants = undefined,
    neighborhoods = undefined,
    cuisines = undefined,
    restaurantImagesIntersectionObserver = undefined;

var map;
var markers = [];

/**
 * Set up Lazy-Loading of Images via IntersectionObserver,
 * if it is implemented in the browser.
 */
if (IntersectionObserver) {
  restaurantImagesIntersectionObserver = new IntersectionObserver(function (intersectionObserverEntries) {
    intersectionObserverEntries.forEach(function (intersectionObserverEntry) {
      var imgElement = intersectionObserverEntry.target;

      if (intersectionObserverEntry.intersectionRatio > 0) {
        var availableImageDimensions = ['180w', '304w', '428w', '552w', '676w', '800w'];

        var srcsetString = '' + availableImageDimensions.map(function (dimension) {
          return 'img/' + imgElement.getAttribute('restaurant-id') + '-' + dimension + '.jpg ' + dimension;
        }).join(', ');

        imgElement.setAttribute('srcset', srcsetString);
        imgElement.setAttribute('sizes', '(max-width: 499px) calc(100vw - 34px), (max-width: 799px) calc((100vw - 3 * 20px - 2 * 34px) / 2), (max-width: 1023px) calc((100vw - 4 * 20px - 3 * 34px) / 3), (min-width: 1024px) 281px');
        imgElement.src = 'img/' + imgElement.getAttribute('restaurant-id') + '-552w.jpg';

        restaurantImagesIntersectionObserver.unobserve(imgElement);
      }
    });
  });
}

/**
 * Set up Service Worker.
 */
registerServiceWorker = function () {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('/sw.js');
  }
};
registerServiceWorker();

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = function () {
  DBHelper.fetchNeighborhoods(function (error, neighborhoods) {
    if (error) {
      // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
};

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = function () {
  var neighborhoods = arguments.length <= 0 || arguments[0] === undefined ? self.neighborhoods : arguments[0];

  var select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(function (neighborhood) {
    var option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = function () {
  DBHelper.fetchCuisines(function (error, cuisines) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
};

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = function () {
  var cuisines = arguments.length <= 0 || arguments[0] === undefined ? self.cuisines : arguments[0];

  var select = document.getElementById('cuisines-select');

  cuisines.forEach(function (cuisine) {
    var option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
};

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = function () {
  var loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementsByClassName('map')[0], {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  updateRestaurants();
};

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = function () {
  var cSelect = document.getElementById('cuisines-select');
  var nSelect = document.getElementById('neighborhoods-select');

  var cIndex = cSelect.selectedIndex;
  var nIndex = nSelect.selectedIndex;

  var cuisine = cSelect[cIndex].value;
  var neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, function (error, restaurants) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  });
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = function (restaurants) {
  // Remove all restaurants
  self.restaurants = [];
  var ul = document.getElementsByClassName('restaurants-list')[0];
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(function (m) {
    return m.setMap(null);
  });
  self.markers = [];
  self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = function () {
  var restaurants = arguments.length <= 0 || arguments[0] === undefined ? self.restaurants : arguments[0];

  var ul = document.getElementsByClassName('restaurants-list')[0];
  restaurants.forEach(function (restaurant) {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
};

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = function (restaurant) {
  var li = document.createElement('li');

  var header = document.createElement('header');
  header.className = 'restaurant-header';
  li.append(header);

  var image = document.createElement('img');
  image.className = 'restaurant-img';
  image.setAttribute('restaurant-id', restaurant.id);
  //image.src = DBHelper.imageUrlForRestaurant(restaurant);

  if (restaurantImagesIntersectionObserver) {
    restaurantImagesIntersectionObserver.observe(image);
  } else {
    var availableImageDimensions = ['180w', '304w', '428w', '552w', '676w', '800w'];
    var srcsetString = '' + availableImageDimensions.map(function (dimension) {
      return 'img/' + restaurant.id + '-' + dimension + '.jpg ' + dimension;
    }).join(', ');
    image.setAttribute('srcset', srcsetString);
    image.setAttribute('sizes', '(max-width: 614px) calc(100vw - 2 * 36px), (max-width: 1189px) calc((100vw - 3 * 35px - 2 * 2px) / 2), (max-width: 1399px) calc((100vw - 4 * 35px - 3 * 2px) / 3), (min-width: 1400px) 409px');
    image.src = 'img/' + restaurant.id + '-552w.jpg';
  }

  image.alt = restaurant.name + ' Restaurant';
  header.append(image);

  var name = document.createElement('h2');
  name.innerHTML = restaurant.name;
  name.id = 'restaurant-' + restaurant.id + '-name';
  header.append(name);

  var neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  var address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  var more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.setAttribute('aria-labelledby', name.id);
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);

  return li;
};

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = function () {
  var restaurants = arguments.length <= 0 || arguments[0] === undefined ? self.restaurants : arguments[0];

  restaurants.forEach(function (restaurant) {
    // Add marker to the map
    var marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', function () {
      window.location.href = marker.url;
    });
    self.markers.push(marker);
  });
};

/**
 * Add EventHandlers for <select> elements that handle the filtering of restaurants.
 */
document.getElementById('neighborhoods-select').onchange = updateRestaurants;
document.getElementById('cuisines-select').onchange = updateRestaurants;

/**
 * Load Google Maps script async, once our own script has finished 
 * loading async, so the initMap function was defined.
 */
document.getElementById("gmaps-script-element").src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyD7U9qcVcdpFFnhE9Gj7fJ87TU6SbL0OoE &libraries=places&callback=initMap";

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
if (document.readyState === "loading") {
  document.addEventListener('DOMContentLoaded', function (event) {
    fetchNeighborhoods();
    fetchCuisines();
  });
} else {
  fetchNeighborhoods();
  fetchCuisines();
}