/** **************************************************************************************
 * Summary: Google-powered, single-page, web app to tell you what to do with your day.
 *
 * Kim Mroz 2015
 */

/** **************************************************************************************
 * Global Variables
 */

// Default location
var GOOGLE_POI_TYPES = ['amusement_park', 'aquarium', 'art_gallery', 'bowling_alley', 'casino', 'movie_theater', 'museum', 'zoo'];
var GOOGLE_RADIUS_M = 20000;
var DEFAULT_COORDS = {
    lat: 51.5072,
    lng: -0.1275
};
var DEFAULT_PLACE = 'London, UK';

var coord = DEFAULT_COORDS;
var locat = DEFAULT_PLACE;

// GMaps objects
var map = null;
var marker = null;
var directionsService = new google.maps.DirectionsService();
var directionsDisplay = new google.maps.DirectionsRenderer();
var service = null;

// Compiled results
var result_set = [];
var current_result = 0;


/** **************************************************************************************
 * Location Search
 */

/**
 * Summary: Start the location and POI search and display process
 */
$(document).ready(function() {
    getLocation();
});

/**
 * Function: Try HTML5's Geolocation to find user's location
 */
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition, showError);
    } else {
        alert("Geolocation not supported ... Imagine you're in " + DEFAULT_PLACE + '.');
    }
}

/**
 * Function: Geolocation success callback
 */
function showPosition(position) {
    var geocoder = new google.maps.Geocoder();
    var latlng = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };

    geocoder.geocode({
        'location': latlng
    }, function(results, status) {
        if (status === google.maps.GeocoderStatus.OK) {
            if (results[1]) {
                locat = results[1].formatted_address;
                coord = latlng;
            } else {
                alert("Location not found ... Imagine you're in " + DEFAULT_PLACE + '.');
            }
        } else {
            alert("Failed to identify your location ... Imagine you're in " + DEFAULT_PLACE + '.');
        }

        searchPOI(locat, coord);
    });
}

/**
 * Function: Geolocation failure callback
 */
function showError(undefined) {
    alert("Geolocation failed ... Imagine you're in " + DEFAULT_PLACE + '.');
    searchPOI(locat, coord);
}


/** **************************************************************************************
 * POI Search
 */

/**
 * Function: Try Google's Places API to search for local POI
 */
function searchPOI(locationName, coord) {

    // Update the header
    if ('' !== locationName) {
        $('#location-heading').html('Bored in ' + locationName + '?');
    }

    // Request nearby POI via Google Places API
    var request = {
        location: coord,
        radius: GOOGLE_RADIUS_M,
        types: GOOGLE_POI_TYPES
    };

    var service = new google.maps.places.PlacesService($('footer img').get(0));
    service.nearbySearch(request, processSearchResults);
}

/**
 * Function: POI search callback
 */
function processSearchResults(results, status, pagination) {
    if (status == google.maps.places.PlacesServiceStatus.OK) {

        // Successful request (response may be empty)
        if (0 !== results.length) {

            // Shuffle the results
            for (var k = results.length - 1; k > 0; --k) {
                var j = Math.floor(Math.random() * (k + 1));
                var temp = results[k];
                results[k] = results[j];
                results[j] = temp;
            }

            // Add to the compiled list
            $.merge(result_set, results);

            // Kick off page initialisation with the first response
            $(this).trigger('firstResult');

            // Get any more available result pages
            if (pagination.hasNextPage) {
                pagination.nextPage();
            }
        }
    } else {

        // Failed Google Places API call
        if (0 === result_set.length) {
            showFinalMessage();
        }
    }
}

/**
 * Function: When the first result is ready, fill the page and get further details
 */
$(window).one('firstResult', function() {

    // Check that we have a result
    if (0 === result_set.length) {
        showFinalMessage();
    } else {

        // Show and size the review pane
        $('#left-box').show();
        $('#overflow-fade').width($('#left-box').width());
        $('#overflow-fade').show();

        // Add a Google map
        map = new google.maps.Map(document.getElementById('map'), {
            center: coord,
            zoom: 10,
            mapTypeControl: false
        });

        // Create the Google objects for getting a route
        service = new google.maps.places.PlacesService(map);
        directionsDisplay.setMap(map);

        // Request further details on the POI
        requestInfo(result_set[0]);
        $('#next-button').removeClass('disabled');
    }
});

/**
 * Function: Request a place's details and route, and add responses to page
 */
function requestInfo(result) {

    // Check that we have a result
    if (!result) {
        showFinalMessage();
    } else {

        // Request further details on the POI
        service.getDetails({
            placeId: result.place_id
        }, function(place, status) {

            // Expect a phone number, reviews and a web address
            var phone = null;
            var review = '';
            var website = null;

            // If the Google Places API call fails, carry on without the extra details
            if (status == google.maps.places.PlacesServiceStatus.OK) {
                phone = place.international_phone_number;
                website = place.website;
                if (place.reviews) {
                    for (var j = 0; j < place.reviews.length; ++j) {
                        if (place.reviews[j].text) {
                            review += '"';
                            review += place.reviews[j].text.trim();
                            review += '"<br><br>';
                        }
                    }
                }
            }

            // Request a route and update the page with the results
            requestRoute(result, website, phone, review);
        });
    }
}

/**
 * Function: Request a route to this POI and add responses to page
 */
function requestRoute(result, website, phone, review) {

    // Remove old marker
    if (marker) {
        marker.setMap(null);
    }

    var distance = -1;
    var duration = -1;

    // Request directions to the POI
    directionsService.route({
        origin: new google.maps.LatLng(coord.lat, coord.lng),
        destination: result.geometry.location,
        travelMode: google.maps.TravelMode.DRIVING
    }, function(response, status) {

        // If a success then add the route, otherwise just add a marker and center the map
        if (status === google.maps.DirectionsStatus.OK && response) {
            // Success
            directionsDisplay.setDirections(response);
            distance = response.routes[0].legs[0].distance.text;
            duration = response.routes[0].legs[0].duration.text;
        } else {
            // Failed
            marker = new google.maps.Marker({
                position: result.geometry.location,
                map: map
            });
            map.setCenter(result.geometry.location);
        }

        // Update page with the requested place details
        updateDetails(result, website, phone, review, distance, duration);
    });
}

/**
 * Function: Add any details and route to page for this POI
 */
function updateDetails(result, website, phone, review, distance, duration) {

    // Remove last result
    $('.poi-data').empty();
    $('#poi-rating').hide();

    // POI name
    $('#poi-name').html(result.name);

    // POI type and current open/closed status
    var subLine = '';
    if (result.types[0]) {
        subLine += result.types[0].replace(/_/g, ' ');
    }
    if (result.opening_hours && result.opening_hours.hasOwnProperty('open_now')) {
        subLine += ' &mdash; ';
        subLine += result.opening_hours.open_now ? 'open' : 'closed';
        subLine += ' now';
    }
    $('#poi-type').html('(' + subLine + ')');

    // POI reviews
    if (!review) {
        review = 'No Google reviews yet.';
    }
    $('#poi-review').html(review);

    // POI telephone
    if (phone) {
        $('#poi-phone').html(phone);
    }

    // POI web address
    if (website) {
        $('#poi-website').html('<a href="' + website + '">website</a>');
    }

    // POI star rating (rounded to nearest integer)
    if (result.rating) {
        $('#poi-rating').width(result.rating * 26.5);
        $('#poi-rating').show();
    }

    // POI route length/duration when driving
    if (-1 !== distance) {
        $('#poi-distance').html(distance + '<br>~' + duration + ' drive');
    }
}

/**
 * Function: When no more POIs available, app finishes with a final message
 */
function showFinalMessage() {

    var msg;
    if (result_set.length < 60) {
        msg = 'No ';
        msg += result_set.length ? 'more ' : '';
        msg += 'places found.<br><br>You should probably move ...';
    } else {
        msg = "Didn't like those?<br><br>You should probably move ...";
    }

    // Show final message
    $('#body-block').html('<h2 id="final-message">' + msg + '</h2>');

    // Remove the button without changing the page structure
    $('.button-parent').height($('.button-parent').height());
    $('.button-parent').empty();
}



/** **************************************************************************************
 * User interactions
 */

/**
 * Function: Button click should move to the next POI, once enabled
 */
$('#next-button').click(function() {
    if (!$(this).hasClass('disabled')) {
        requestInfo(result_set[++current_result]);
    }
});

/**
 * Function: [Enter] should move to the next POI
 */
$('html').keyup(function(event) {
    if (13 == event.keyCode) {
        $('#next-button').click();
    }
});



/** **************************************************************************************
 * Page Setup
 */


/**
 * Function: On load, ensure the responsive elements are relatively correct
 */
$(window).one('load', function() {

    // Show body and button
    $('#body-block').show();
    $('.button-parent').show();

    // Resize columns
    $('#body-block').css({
        'min-height': Math.max($('body').height() - 200, 400) + 'px'
    });
    $('#right-box').height($('#body-block').height() - 150);
    $('#left-box-inner').css({
        'max-height': $('#right-box').height() + 'px'
    });

    placeFooter();
});

/**
 * Function: On resize, ensure the responsive elements are relatively correct
 */
$(window).resize(function() {

    placeFooter();

    // Resize columns
    $('#body-block').css({
        'min-height': Math.max($('body').height() - 200, 400) + 'px'
    });
    $('#left-box-inner').css({
        'max-height': $('#right-box').height() + 'px'
    });
    $('#overflow-fade').css({
        'width': $('#left-box').width() + 'px'
    });
});

/**
 * Function: Place the footer either after the content or at the bottom of the view
 */
function placeFooter() {
    var height = $(window).height() - $('footer').position().top - $('footer').height();
    if (height > 0) {
        $('footer').css({
            'margin-top': height + 'px'
        });
    }
}