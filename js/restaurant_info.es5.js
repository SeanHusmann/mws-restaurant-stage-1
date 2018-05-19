/* Generated by Babel */
// !ES6
'use strict';

var restaurant = undefined;
var map;

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
 * Initialize Google map, called from HTML.
 */
window.initMap = function () {
  if (self.restaurant) {
    self.map = new google.maps.Map(document.getElementsByClassName('map')[0], {
      zoom: 16,
      center: self.restaurant.latlng,
      scrollwheel: false
    });

    DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
  }
};

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = function (callback) {
  if (self.restaurant) {
    // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  var id = getParameterByName('id');
  if (!id) {
    // no id found in URL
    error = 'No restaurant id in URL';
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, function (error, restaurant) {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant);
    });
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = function () {
  var restaurant = arguments.length <= 0 || arguments[0] === undefined ? self.restaurant : arguments[0];

  var name = document.getElementsByClassName('restaurant-name')[0];
  name.innerHTML = restaurant.name;

  var address = document.getElementsByClassName('restaurant-address')[0];
  address.innerHTML = restaurant.address;

  var image = document.getElementsByClassName('restaurant-img')[0];
  image.className = 'restaurant-img';
  //image.src = DBHelper.imageUrlForRestaurant(restaurant);

  var availableImageDimensions = ['180w', '304w', '428w', '552w', '676w', '800w'];
  var srcsetString = '' + availableImageDimensions.map(function (dimension) {
    return 'img/' + restaurant.id + '-' + dimension + '.jpg ' + dimension;
  }).join(', ');
  image.setAttribute('srcset', srcsetString);
  image.setAttribute('sizes', '(max-width: 614px) calc(100vw - 2px), (max-width: 1189px) calc((100vw - 3 * 35px - 2 * 2px) / 2), (max-width: 1399px) calc((100vw - 4 * 35px - 3 * 2px) / 3), (min-width: 1400px) 409px');
  image.src = 'img/' + restaurant.id + '-552w.jpg';
  image.alt = restaurant.name + ' Restaurant';

  var cuisine = document.getElementsByClassName('restaurant-cuisine')[0];
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fetchReviews();
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = function () {
  var operatingHours = arguments.length <= 0 || arguments[0] === undefined ? self.restaurant.operating_hours : arguments[0];

  var hours = document.getElementsByClassName('restaurant-hours')[0];
  for (var key in operatingHours) {
    var row = document.createElement('tr');

    var day = document.createElement('th');
    day.innerHTML = key;
    row.appendChild(day);

    var time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
};

/**
 * Fetch all reviews and add them to the webpage.
 */
fetchReviews = function () {
  DBHelper.fetchReviewsByRestaurantId(self.restaurant.id, function (reviews) {
    fillReviewsHTML(reviews);
  });
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = function (reviews) {
  var existingTitleElement = document.querySelector('.reviews-container > h3');

  var container = document.getElementsByClassName('reviews-container')[0];
  container.innerHTML = '';
  var title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (reviews.length === 0) {
    var noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }

  var ul = document.createElement('ul');
  ul.className = 'reviews-list';
  reviews.forEach(function (review) {
    ul.appendChild(createReviewHTML(review));
  });
  ul.appendChild(createNewReviewFormHTML());
  container.appendChild(ul);
};

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = function (review) {
  var li = document.createElement('li');

  var name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'reviewer-name';
  li.appendChild(name);

  var date = document.createElement('p');
  date.innerHTML = new Date(review.updatedAt).toDateString();
  date.className = 'review-date';
  li.appendChild(date);

  var rating = document.createElement('p');
  rating.innerHTML = 'Rating: ' + review.rating;
  rating.className = 'review-rating';
  li.appendChild(rating);

  var comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.className = 'review-text';
  li.appendChild(comments);

  return li;
};

/**
 * Create and return a form for submitting  new restaurant reviews.
 */
createNewReviewFormHTML = function () {
  var nameLabel = document.createElement('label');
  nameLabel.setAttribute('for', 'new-review-name');
  nameLabel.textContent = 'Name:';
  var nameInput = document.createElement('input');
  nameInput.setAttribute('name', 'new-review-name');
  nameInput.setAttribute('id', 'new-review-name');
  nameInput.setAttribute('type', 'text');
  nameInput.setAttribute('placeholder', 'John Smith');
  var ratingLabel = document.createElement('label');
  ratingLabel.setAttribute('for', 'new-review-rating');
  ratingLabel.textContent = 'Rating:';
  var ratingInput = document.createElement('input');
  ratingInput.setAttribute('name', 'new-review-rating');
  ratingInput.setAttribute('id', 'new-review-rating');
  ratingInput.setAttribute('type', 'range');
  ratingInput.setAttribute('min', '1');
  ratingInput.setAttribute('max', '5');
  ratingInput.setAttribute('value', '3');
  ratingInput.addEventListener('input', function () {
    for (var i = 0; i < 5; i++) {
      var ratingStarDiv = ratingVisualizationOutput.children.item(i);
      ratingStarDiv.className = i < ratingInput.value ? 'rated-star' : 'empty-star';
    }
  });
  var ratingVisualizationOutput = document.createElement('output');
  ratingVisualizationOutput.setAttribute('aria-hidden', 'true');
  ratingVisualizationOutput.setAttribute('for', 'new-review-rating');
  ratingVisualizationOutput.setAttribute('name', 'stars-rating');
  for (var i = 0; i < 5; i++) {
    var ratingStar = document.createElement('div');
    ratingStar.textContent = '★';
    /**
     * Assign a default average rating of 3 stars for unrated restaurants.
     * This is to prevent restaurants from accidentally being rated 1 star,
     * in case the reviewer forgot to select a rating before submission.
     */
    ratingStar.className = i < 3 ? 'rated-star' : 'empty-star';
    ratingVisualizationOutput.appendChild(ratingStar);
  }
  var commentLabel = document.createElement('label');
  commentLabel.setAttribute('for', 'new-review-text');
  commentLabel.textContent = 'Comment:';
  var commentTextArea = document.createElement('textarea');
  commentTextArea.setAttribute('id', 'new-review-text');
  commentTextArea.setAttribute('name', 'new-review-text');
  commentTextArea.setAttribute('rows', '5');
  commentTextArea.setAttribute('placeholder', 'Write about your experience at this restaurant...');
  var submitButton = document.createElement('button');
  submitButton.textContent = 'Submit Review';
  submitButton.addEventListener('click', function (event) {
    // Prevent standard POST behavior of new page-load:
    event.preventDefault();
    DBHelper.postNewReview(self.restaurant);
  });

  var newReviewForm = document.createElement('form');
  newReviewForm.setAttribute('name', 'new-review');
  newReviewForm.setAttribute('id', 'new-review');
  newReviewForm.appendChild(nameLabel);
  newReviewForm.appendChild(nameInput);
  newReviewForm.appendChild(ratingLabel);
  newReviewForm.appendChild(ratingInput);
  newReviewForm.appendChild(ratingVisualizationOutput);
  newReviewForm.appendChild(commentLabel);
  newReviewForm.appendChild(commentTextArea);
  newReviewForm.appendChild(submitButton);

  var newReviewFormHeader = document.createElement('h4');
  newReviewFormHeader.textContent = 'Add Your Review!';

  var li = document.createElement('li');
  li.appendChild(newReviewFormHeader);
  li.appendChild(newReviewForm);
  li.setAttribute('id', 'new-review-form-li');

  return li;
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = function () {
  var restaurant = arguments.length <= 0 || arguments[0] === undefined ? self.restaurant : arguments[0];

  var breadcrumb = document.querySelector('.breadcrumb ol');
  var li = document.createElement('li');
  li.innerHTML = restaurant.name;
  li.setAttribute('aria-current', 'page');
  breadcrumb.appendChild(li);
};

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = function (name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

/**
 * Load non-interactive Google Maps preview image with pin
 * reflecting the location of restaurant.
 */
loadGoogleMapsPreviewImage = function (restaurant) {
  //console.log("New map preview image is being loaded.");
  var mapOverlay = document.querySelector(".map-overlay");
  var map = document.querySelector(".map");
  var mapPreviewImage = document.querySelector(".map-preview");
  var mapContainer = document.querySelector(".map-container");

  mapOverlay.onclick = function () {
    mapOverlay.style.display = "none";
    mapOverlay.parentNode.removeChild(mapOverlay);
    map.style.display = "block";

    if (self.map) {
      google.maps.event.addDomListenerOnce(self.map, "tilesloaded", function () {
        //console.log("tilesloaded fired.");
        mapPreviewImage.parentNode.removeChild(mapPreviewImage);
        map.style.position = "relative";
      });
    }
  };

  var mapStyle = window.getComputedStyle(map);
  var width = Math.trunc(window.innerWidth);
  var height = mapContainer.offsetHeight;

  var pinsStringForStaticMapURL = '&markers=size:%7Ccolor:0xff0000%7Clabel:%7C' + restaurant.latlng.lat + ',+' + restaurant.latlng.lng;

  mapPreviewImage.src = 'https://maps.googleapis.com/maps/api/staticmap?center=' + restaurant.latlng.lat + ',+' + restaurant.latlng.lng + '&zoom=16&scale=1&size=' + width + "x" + height + "&maptype=roadmap&format=jpg&visual_refresh=true" + pinsStringForStaticMapURL + "&key=AIzaSyD7U9qcVcdpFFnhE9Gj7fJ87TU6SbL0OoE ";
};

loadRestaurantDataAndGenerateStaticGoogleMapsImageLink = function () {
  var id = getParameterByName('id');
  if (!id) {
    // no id found in URL
    error = 'No restaurant id in URL';
  } else {
    DBHelper.fetchRestaurantById(id, function (error, restaurant) {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }

      if (window.google) {
        window.initMap();
      }

      fillRestaurantHTML();
      fillBreadcrumb();
      loadGoogleMapsPreviewImage(restaurant);
    });
  }
};

/**
 * Fetch restaurants, neighborhoods and cuisines as soon as the page is loaded,
 * not only when Google Maps completely loaded and called initMap().
 */
if (document.readyState === "loading") {
  document.addEventListener('DOMContentLoaded', function (event) {
    loadRestaurantDataAndGenerateStaticGoogleMapsImageLink();
  });
} else {
  loadRestaurantDataAndGenerateStaticGoogleMapsImageLink();
}

/**
 * Load Google Maps script async, once our own script has finished 
 * loading async, so the initMap function was defined.
 */
document.getElementById("gmaps-script-element").src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyD7U9qcVcdpFFnhE9Gj7fJ87TU6SbL0OoE &libraries=places&callback=initMap";