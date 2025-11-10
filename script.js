// Initialize map with rotation support
const map = L.map('map', {
    rotate: true,
    rotateControl: true,
    tap: true // Enable tap handler for touch devices
}).setView([0, 0], 13);

// Add map tiles layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 3
}).addTo(map);

// Force map to update its size
setTimeout(() => {
    map.invalidateSize();
}, 100);

// Add rotation reset control
L.control.button = L.Control.extend({
    options: {
        position: 'topleft'
    },
    onAdd: function() {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const button = L.DomUtil.create('a', 'reset-rotation', container);
        button.innerHTML = '⇱';
        button.title = 'Reset rotation';
        button.href = '#';
        button.onclick = function() {
            map.setBearing(0);
            return false;
        };
        return container;
    }
});
new L.control.button().addTo(map);

let userMarker = null;
let routeLayer = null;
let trackingInterval = null;
let startTime = null;
let routeCoordinates = [];
let userTrack = [];
let userHeading = 0;
// Heading smoothing buffer
const headingBuffer = [];
const HEADING_BUFFER_SIZE = 5;
const HEADING_UPDATE_THRESHOLD = 5; // degrees

// Create a custom marker icon with direction indicator
const markerIcon = L.divIcon({
    className: 'direction-marker',
    html: '<div class="marker-arrow"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// Add CSS for the direction marker
const style = document.createElement('style');
style.textContent = `
    .direction-marker {
        width: 20px;
        height: 20px;
    }
    .marker-arrow {
        width: 0;
        height: 0;
        border-left: 10px solid transparent;
        border-right: 10px solid transparent;
        border-bottom: 20px solid blue;
        transform-origin: center bottom;
        transform: rotate(0deg);
    }
`;
document.head.appendChild(style);

// Function to get user location
function getUserLocation() {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 13);
            
            if (userMarker) {
                userMarker.setLatLng([latitude, longitude]);
            } else {
                userMarker = L.marker([latitude, longitude], {icon: markerIcon}).addTo(map);
                setupDeviceOrientation();
            }
        },
        (error) => {
            console.error('Error getting location:', error);
            alert('Please enable location services to use this app.');
        }
    );
}

// Get initial user location
getUserLocation();

// OpenRouteService API configuration
const ORS_API_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking';

// Generate Route function
async function generateRoute() {
    const distance = document.getElementById('distance').value;
    if (!userMarker) {
        alert('Waiting for your location...');
        return;
    }

    const startPoint = userMarker.getLatLng();
    try {
        // Calculate a circular route based on the desired distance
        const endPoint = calculateDestination(startPoint, distance * 1000);
        const response = await fetch(`${ORS_API_URL}?api_key=${CONFIG.ORS_API_KEY}&start=${startPoint.lng},${startPoint.lat}&end=${endPoint.lng},${endPoint.lat}`);
        const data = await response.json();

        if (routeLayer) {
            map.removeLayer(routeLayer);
        }

        routeCoordinates = data.features[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        routeLayer = L.polyline(routeCoordinates, { color: 'blue' }).addTo(map);
        map.fitBounds(routeLayer.getBounds());
        
        document.getElementById('startTracking').disabled = false;
    } catch (error) {
        console.error('Error generating route:', error);
        alert('Error generating route. Please try again.');
    }
}

// Helper function to calculate destination point for circular route
function calculateDestination(start, distance) {
    const R = 6371000; // Earth's radius in meters
    const bearing = Math.random() * 2 * Math.PI; // Random bearing
    const lat1 = start.lat * Math.PI / 180;
    const lon1 = start.lng * Math.PI / 180;
    const d = distance / 2; // Half the desired distance for out and back

    const lat2 = Math.asin(
        Math.sin(lat1) * Math.cos(d/R) +
        Math.cos(lat1) * Math.sin(d/R) * Math.cos(bearing)
    );
    const lon2 = lon1 + Math.atan2(
        Math.sin(bearing) * Math.sin(d/R) * Math.cos(lat1),
        Math.cos(d/R) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
        lat: lat2 * 180 / Math.PI,
        lng: lon2 * 180 / Math.PI
    };
}

// Start tracking function
function startTracking() {
    document.getElementById('startTracking').disabled = true;
    document.getElementById('stopTracking').disabled = false;
    document.getElementById('generateRoute').disabled = true;
    userTrack = [];
    startTime = new Date();

    trackingInterval = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            userMarker.setLatLng([latitude, longitude]);
            userTrack.push([latitude, longitude]);

            // Update stats
            if (userTrack.length > 1) {
                const distance = calculateTotalDistance(userTrack);
                document.getElementById('currentDistance').textContent = 
                    (distance / 1000).toFixed(2);
            }

            const elapsed = new Date() - startTime;
            document.getElementById('currentTime').textContent = 
                new Date(elapsed).toISOString().substr(11, 8);
        },
        (error) => {
            console.error('Error tracking location:', error);
            stopTracking();
            alert('Error tracking location. Please try again.');
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

// Stop tracking function
function stopTracking() {
    if (trackingInterval) {
        navigator.geolocation.clearWatch(trackingInterval);
    }
    document.getElementById('startTracking').disabled = false;
    document.getElementById('stopTracking').disabled = true;
    document.getElementById('generateRoute').disabled = false;
    
    // Draw the completed track
    if (userTrack.length > 1) {
        L.polyline(userTrack, { color: 'red' }).addTo(map);
    }
}

// Calculate total distance in meters
function calculateTotalDistance(coordinates) {
    let total = 0;
    for (let i = 1; i < coordinates.length; i++) {
        total += calculateDistance(
            coordinates[i-1][0], coordinates[i-1][1],
            coordinates[i][0], coordinates[i][1]
        );
    }
    return total;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// Setup device orientation
function setupDeviceOrientation() {
    if (window.DeviceOrientationEvent) {
        // Request permission for iOS 13+ devices
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission()
                .then(permissionState => {
                    if (permissionState === 'granted') {
                        window.addEventListener('deviceorientationabsolute', handleOrientation);
                    }
                })
                .catch(console.error);
        } else {
            // Handle non iOS 13+ devices
            window.addEventListener('deviceorientationabsolute', handleOrientation);
            window.addEventListener('deviceorientation', handleOrientation);
        }
    }
}

// Handle device orientation changes
function handleOrientation(event) {
    // Get the device heading (compass direction)
    let heading;
    if (event.webkitCompassHeading) {
        // For iOS devices
        heading = event.webkitCompassHeading;
    } else {
        // For Android devices
        heading = 360 - event.alpha;
    }

    if (heading !== undefined && !isNaN(heading)) {
        // Add heading to buffer
        headingBuffer.push(heading);
        if (headingBuffer.length > HEADING_BUFFER_SIZE) {
            headingBuffer.shift();
        }
        // Calculate smoothed heading
        const smoothedHeading = headingBuffer.reduce((a, b) => a + b, 0) / headingBuffer.length;
        const previousHeading = userHeading;
        // Only update if change is significant
        if (Math.abs(smoothedHeading - previousHeading) > HEADING_UPDATE_THRESHOLD) {
            userHeading = smoothedHeading;
            updateMarkerDirection(smoothedHeading);
            document.getElementById('headingDisplay').textContent = `${Math.round(smoothedHeading)}°`;
            if (document.getElementById('autoRotate').checked) {
                map.setBearing(smoothedHeading);
            }
            // Emit a custom event for significant direction changes
            const event = new CustomEvent('directionChanged', {
                detail: {
                    heading: smoothedHeading,
                    change: smoothedHeading - previousHeading
                }
            });
            window.dispatchEvent(event);
        }
    }
}

// Update the marker's direction
function updateMarkerDirection(heading) {
    if (userMarker) {
        const arrow = userMarker.getElement().querySelector('.marker-arrow');
        if (arrow) {
            arrow.style.transform = `rotate(${heading}deg)`;
        }
    }
}

// Listen for direction changes
window.addEventListener('directionChanged', (e) => {
    const { heading, change } = e.detail;
    console.log(`Direction changed by ${Math.round(change)}° to ${Math.round(heading)}°`);
    
    // Flash the compass display to indicate the change
    const compass = document.getElementById('compass');
    compass.style.backgroundColor = '#ffeb3b';
    setTimeout(() => {
        compass.style.backgroundColor = 'transparent';
    }, 200);
});

// Controls toggle functionality
const controlsToggle = document.getElementById('controlsToggle');
const controls = document.getElementById('controls');
let controlsCollapsed = false;

function toggleControls() {
    controlsCollapsed = !controlsCollapsed;
    if (controlsCollapsed) {
        controls.style.height = '40px';
        controlsToggle.style.bottom = '39px';
        controlsToggle.style.transform = 'translateX(-50%) rotate(180deg)';
    } else {
        controls.style.height = 'var(--control-height)';
        controlsToggle.style.bottom = 'calc(var(--control-height) - 1px)';
        controlsToggle.style.transform = 'translateX(-50%)';
    }
    // Trigger a resize event for the map
    map.invalidateSize();
}

// Event listeners
document.getElementById('getLocation').addEventListener('click', getUserLocation);
document.getElementById('generateRoute').addEventListener('click', generateRoute);
document.getElementById('startTracking').addEventListener('click', startTracking);
document.getElementById('stopTracking').addEventListener('click', stopTracking);
controlsToggle.addEventListener('click', toggleControls);