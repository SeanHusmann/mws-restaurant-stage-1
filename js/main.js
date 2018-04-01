let restaurants,
  neighborhoods,
  cuisines
var map
var markers = []


/**
 * Set up Service Worker.
 */
registerServiceWorker = () => {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register('/sw.js'); 
  }
}

registerServiceWorker();

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  fetchNeighborhoods();
  fetchCuisines();
});


/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementsByClassName('map')[0], {
    zoom: 12,
    center: loc,
    scrollwheel: false
  });
  updateRestaurants();
}

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementsByClassName('restaurants-list')[0];
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementsByClassName('restaurants-list')[0];
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');

  const header = document.createElement('header');
  header.className = 'restaurant-header';
  li.append(header);  
  
  const image = document.createElement('img');
  image.className = 'restaurant-img';
  //image.src = DBHelper.imageUrlForRestaurant(restaurant);
    
  const availableImageDimensions = ['180w', '304w', '428w', '552w', '676w', '800w'];
  const srcsetString = `${availableImageDimensions.map(dimension => `img/${restaurant.id}-${dimension}.jpg ${dimension}`).join(', ')}`;
  image.setAttribute('srcset', srcsetString);
  image.setAttribute('sizes', '(max-width: 499px) calc(100vw - 34px), (max-width: 799px) calc((100vw - 3 * 20px - 2 * 34px) / 2), (max-width: 1023px) calc((100vw - 4 * 20px - 3 * 34px) / 3), (min-width: 1024px) 281px');
  image.src = `img/${restaurant.id}-552w.jpg`;
  image.alt = `Photo of Restaurant ${restaurant.name}`;
  header.append(image);

  const name = document.createElement('h2');
  name.innerHTML = restaurant.name;
  name.id = 'restaurant-' + restaurant.id + '-name';
  header.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.innerHTML = restaurant.address;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.setAttribute('aria-labelledby', name.id);
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more)

  return li;
}

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url
    });
    self.markers.push(marker);
  });
}


/**
 * Add EventHandlers for <select> elements that handle the filtering of restaurants.
 */
document.getElementById('neighborhoods-select').onchange = updateRestaurants;
document.getElementById('cuisines-select').onchange = updateRestaurants;