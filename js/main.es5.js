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
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', function (event) {
  fetchNeighborhoods();
  fetchCuisines();
});

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