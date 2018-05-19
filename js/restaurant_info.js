// !ES6
let restaurant;
var map;


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
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
	if (self.restaurant) {
		self.map = new google.maps.Map(document.getElementsByClassName('map')[0], {
			zoom: 16,
			center: self.restaurant.latlng,
			scrollwheel: false
		});

		DBHelper.mapMarkerForRestaurant(self.restaurant, self.map); 
	}
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementsByClassName('restaurant-name')[0];
  name.innerHTML = restaurant.name;

  const address = document.getElementsByClassName('restaurant-address')[0];
  address.innerHTML = restaurant.address;

  const image = document.getElementsByClassName('restaurant-img')[0];
  image.className = 'restaurant-img'
  //image.src = DBHelper.imageUrlForRestaurant(restaurant);
    
  const availableImageDimensions = ['180w', '304w', '428w', '552w', '676w', '800w'];
  const srcsetString = `${availableImageDimensions.map(dimension => `img/${restaurant.id}-${dimension}.jpg ${dimension}`).join(', ')}`;
  image.setAttribute('srcset', srcsetString);
  image.setAttribute('sizes', '(max-width: 614px) calc(100vw - 2px), (max-width: 1189px) calc((100vw - 3 * 35px - 2 * 2px) / 2), (max-width: 1399px) calc((100vw - 4 * 35px - 3 * 2px) / 3), (min-width: 1400px) 409px');
  image.src = `img/${restaurant.id}-552w.jpg`;   
  image.alt = `${restaurant.name} Restaurant`;

  const cuisine = document.getElementsByClassName('restaurant-cuisine')[0];
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fetchReviews();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementsByClassName('restaurant-hours')[0];
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('th');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Fetch all reviews and add them to the webpage.
 */
fetchReviews = () => {
	DBHelper.fetchReviewsByRestaurantId(self.restaurant.id, (reviews) => {
		fillReviewsHTML(reviews);
	});
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews) => {
	const existingTitleElement = document.querySelector('.reviews-container > h3');
	
  const container = document.getElementsByClassName('reviews-container')[0];
	container.innerHTML = '';
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (reviews.length === 0) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
	
	const ul = document.createElement('ul');
	ul.className = 'reviews-list';
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
	ul.appendChild(createNewReviewFormHTML());
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
    
  const name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'reviewer-name';
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = (new Date(review.updatedAt)).toDateString();
  date.className = 'review-date';
  li.appendChild(date);
  
  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  rating.className = 'review-rating';
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.className = 'review-text';
  li.appendChild(comments);

  return li;
}

/**
 * Create and return a form for submitting  new restaurant reviews.
 */
createNewReviewFormHTML = () => {
  const nameLabel = document.createElement('label');
        nameLabel.setAttribute('for', 'new-review-name');
				nameLabel.textContent = 'Name:';
  const nameInput = document.createElement('input');
        nameInput.setAttribute('name', 'new-review-name');
        nameInput.setAttribute('id', 'new-review-name');
        nameInput.setAttribute('type', 'text');
				nameInput.setAttribute('placeholder', 'John Smith');
  const ratingLabel = document.createElement('label');
        ratingLabel.setAttribute('for', 'new-review-rating');
				ratingLabel.textContent = 'Rating:';
  const ratingInput = document.createElement('input');
        ratingInput.setAttribute('name', 'new-review-rating');
        ratingInput.setAttribute('id', 'new-review-rating');
        ratingInput.setAttribute('type', 'range');
        ratingInput.setAttribute('min', '1');
        ratingInput.setAttribute('max', '5');
        ratingInput.setAttribute('value', '3');
        ratingInput.addEventListener('input', () => {
          for (let i = 0; i < 5; i++) {
            const ratingStarDiv = ratingVisualizationOutput.children.item(i);
						      ratingStarDiv.className = (i < ratingInput.value) ? 'rated-star' : 'empty-star';
          }
        });
  const ratingVisualizationOutput = document.createElement('output');
        ratingVisualizationOutput.setAttribute('aria-hidden', 'true');
        ratingVisualizationOutput.setAttribute('for', 'new-review-rating');
        ratingVisualizationOutput.setAttribute('name', 'stars-rating');
        for (let i = 0; i < 5; i++) {
          const ratingStar = document.createElement('div');
                ratingStar.textContent = '★';
                /**
                 * Assign a default average rating of 3 stars for unrated restaurants.
                 * This is to prevent restaurants from accidentally being rated 1 star,
                 * in case the reviewer forgot to select a rating before submission.
                 */
                ratingStar.className = (i < 3) ? 'rated-star' : 'empty-star';
                ratingVisualizationOutput.appendChild(ratingStar);
        }
  const commentLabel = document.createElement('label');
        commentLabel.setAttribute('for', 'new-review-text');
				commentLabel.textContent = 'Comment:';
  const commentTextArea = document.createElement('textarea');
        commentTextArea.setAttribute('id', 'new-review-text');
        commentTextArea.setAttribute('name', 'new-review-text');
        commentTextArea.setAttribute('rows', '5');
				commentTextArea.setAttribute('placeholder', 'Write about your experience at this restaurant...');
  const submitButton = document.createElement('button');
				submitButton.textContent = 'Submit Review';
				submitButton.addEventListener('click', (event) => {
					// Prevent standard POST behavior of new page-load:
					event.preventDefault();
					const newReview = {
						restaurant_id: self.restaurant.id,
						name: nameInput.value,
						rating: ratingInput.value,
						comments: commentTextArea.value,
						createdAt: (new Date(Date.now())).toJSON(),
						updatedAt: (new Date(Date.now())).toJSON()
					};
					li.parentNode.removeChild(li);
					document.querySelector('.reviews-list').appendChild(createReviewHTML(newReview));
					DBHelper.postNewReview(newReview);
				});

  const newReviewForm = document.createElement('form');
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

	const newReviewFormHeader = document.createElement('h4');
				newReviewFormHeader.textContent = 'Add Your Review!';

	const li = document.createElement('li');
				li.appendChild(newReviewFormHeader);
		    li.appendChild(newReviewForm);
				li.setAttribute('id', 'new-review-form-li');
	
  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.querySelector('.breadcrumb ol');
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  li.setAttribute('aria-current', 'page');
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}


/**
 * Load non-interactive Google Maps preview image with pin
 * reflecting the location of restaurant.
 */
loadGoogleMapsPreviewImage = (restaurant) => {
	//console.log("New map preview image is being loaded.");
	const mapOverlay = document.querySelector(".map-overlay");
	const map = document.querySelector(".map");
	const mapPreviewImage = document.querySelector(".map-preview");
	const mapContainer = document.querySelector(".map-container");

	mapOverlay.onclick = () => {
		mapOverlay.style.display = "none";
		mapOverlay.parentNode.removeChild(mapOverlay);
		map.style.display = "block";
		
		if (self.map) {
			google.maps.event.addDomListenerOnce(self.map, "tilesloaded", () => {
				//console.log("tilesloaded fired.");
				mapPreviewImage.parentNode.removeChild(mapPreviewImage);
				map.style.position = "relative";
			});
		}
	};

	const mapStyle = window.getComputedStyle(map);
	const width = Math.trunc(window.innerWidth);
	const height = mapContainer.offsetHeight;
	
	let pinsStringForStaticMapURL = `&markers=size:%7Ccolor:0xff0000%7Clabel:%7C${restaurant.latlng.lat},+${restaurant.latlng.lng}`;
	
	mapPreviewImage.src = `https://maps.googleapis.com/maps/api/staticmap?center=${restaurant.latlng.lat},+${restaurant.latlng.lng}&zoom=16&scale=1&size=` + width + "x" + height + "&maptype=roadmap&format=jpg&visual_refresh=true" + pinsStringForStaticMapURL +
	"&key=AIzaSyD7U9qcVcdpFFnhE9Gj7fJ87TU6SbL0OoE ";
}


loadRestaurantDataAndGenerateStaticGoogleMapsImageLink = () => {
	const id = getParameterByName('id');
	if (!id) { // no id found in URL
		error = 'No restaurant id in URL'
	} else {
		DBHelper.fetchRestaurantById(id, (error, restaurant) => {
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
}


/**
 * Fetch restaurants, neighborhoods and cuisines as soon as the page is loaded,
 * not only when Google Maps completely loaded and called initMap().
 */
if (document.readyState === "loading")
{
  document.addEventListener('DOMContentLoaded', (event) => {
		loadRestaurantDataAndGenerateStaticGoogleMapsImageLink();
  });
}
else {
	loadRestaurantDataAndGenerateStaticGoogleMapsImageLink();
}

/**
 * Load Google Maps script async, once our own script has finished 
 * loading async, so the initMap function was defined.
 */
document.getElementById("gmaps-script-element").src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyD7U9qcVcdpFFnhE9Gj7fJ87TU6SbL0OoE &libraries=places&callback=initMap";