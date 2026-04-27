// ========================================
// GeoMapInk - Interactive Map of Hunza Valley
// ========================================

var HUNZA_CENTER = [36.3167, 74.6500];
var DEFAULT_ZOOM = 9;

// --- Restore map view from URL hash ---
function getHashParams() {
    var hash = window.location.hash.replace('#', '');
    if (!hash) return null;
    var parts = hash.split('/');
    if (parts.length >= 3) {
        return {
            lat: parseFloat(parts[0]),
            lng: parseFloat(parts[1]),
            zoom: parseInt(parts[2], 10)
        };
    }
    return null;
}

var hashParams = getHashParams();
var initCenter = hashParams ? [hashParams.lat, hashParams.lng] : HUNZA_CENTER;
var initZoom = hashParams ? hashParams.zoom : DEFAULT_ZOOM;

var map = L.map('map', {
    zoomControl: true,
    attributionControl: true
}).setView(initCenter, initZoom);

// --- Base Map Layers ---
var baseMaps = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '&copy; Esri, Maxar, Earthstar Geographics'
    }),
    terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; OpenTopoMap contributors'
    })
};

var darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
    attribution: '&copy; CartoDB'
});

var currentBaseMap = baseMaps.street;
currentBaseMap.addTo(map);

// Base map switcher
document.querySelectorAll('input[name="basemap"]').forEach(function(radio) {
    radio.addEventListener('change', function() {
        map.removeLayer(currentBaseMap);
        if (document.body.classList.contains('dark-mode')) {
            map.removeLayer(darkTileLayer);
        }
        currentBaseMap = baseMaps[this.value];
        if (document.body.classList.contains('dark-mode')) {
            darkTileLayer.addTo(map);
        } else {
            currentBaseMap.addTo(map);
        }
    });
});

// --- Custom Icons ---
var icons = {
    hotels: L.icon({ iconUrl: 'icons/hotel.svg', iconSize: [20, 20] }),
    touristpoints: L.icon({ iconUrl: 'icons/touristpoint.svg', iconSize: [35, 35] }),
    passes: L.icon({ iconUrl: 'icons/passes.svg', iconSize: [35, 35] }),
    glaciers: L.icon({ iconUrl: 'icons/glacier.png', iconSize: [15, 15] }),
    villages: L.icon({ iconUrl: 'icons/village.svg', iconSize: [20, 20] })
};

// --- Photo Lightbox ---
function openLightbox(src, caption) {
    var lb = document.getElementById('lightbox');
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox-caption').textContent = caption || '';
    lb.classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLightbox();
});

// --- Popup HTML Builder (with lightbox support) ---
function buildPopup(props, type) {
    var html = '<div class="popup-content">';
    if (props.name) {
        html += '<h4>' + props.name + '</h4>';
    }
    if (props.Type || props.type) {
        html += '<span class="popup-type">' + (props.Type || props.type) + '</span>';
    }
    if (props.desc && props.desc.trim()) {
        html += '<p>' + props.desc + '</p>';
    }
    if (props.imageUrl) {
        html += '<img src="' + props.imageUrl + '" alt="' + (props.name || type) + '" loading="lazy" onclick="event.stopPropagation(); openLightbox(\'' + props.imageUrl + '\', \'' + (props.name || '').replace(/'/g, "\\'") + '\')">';
    }
    html += '</div>';
    return html;
}

// --- Marker Clustering Layer Factory ---
function createClusteredPointLayer(url, layerType) {
    var clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 40,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true
    });

    var geoLayer = L.geoJSON.ajax(url, {
        pointToLayer: function(feature, latlng) {
            var marker = L.marker(latlng, { icon: icons[layerType] });
            if (feature.properties) {
                marker.bindPopup(buildPopup(feature.properties, layerType), { autoClose: false, maxWidth: 220 });
            }
            return marker;
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties && feature.properties.name) {
                layer.bindTooltip(feature.properties.name, { permanent: false, direction: 'auto' });
            }
        }
    });

    geoLayer.on('data:loaded', function() {
        clusterGroup.addLayer(geoLayer);
    });

    clusterGroup._geoLayer = geoLayer;
    return clusterGroup;
}

// Public service layer (no custom icon — uses default marker with popup)
function createPublicServiceLayer(url) {
    var clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 40,
        showCoverageOnHover: false
    });

    var geoLayer = L.geoJSON.ajax(url, {
        pointToLayer: function(feature, latlng) {
            var typeStr = (feature.properties && feature.properties.type) ? feature.properties.type.toLowerCase() : '';
            var iconClass = 'fa-building';
            var iconColor = '#c0392b';
            if (typeStr.includes('hospital') || typeStr.includes('health')) {
                iconClass = 'fa-hospital';
                iconColor = '#e74c3c';
            } else if (typeStr.includes('police')) {
                iconClass = 'fa-shield-halved';
                iconColor = '#2980b9';
            } else if (typeStr.includes('school') || typeStr.includes('education')) {
                iconClass = 'fa-school';
                iconColor = '#f39c12';
            } else if (typeStr.includes('hotel') || typeStr.includes('restaurant') || typeStr.includes('cafe')) {
                iconClass = 'fa-utensils';
                iconColor = '#e67e22';
            }

            var customIcon = L.divIcon({
                html: '<i class="fas ' + iconClass + '" style="color:' + iconColor + ';font-size:16px;"></i>',
                className: 'public-service-icon',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            var marker = L.marker(latlng, { icon: customIcon });
            if (feature.properties) {
                marker.bindPopup(buildPopup(feature.properties, 'publicservice'), { autoClose: false, maxWidth: 220 });
            }
            return marker;
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties && feature.properties.name) {
                layer.bindTooltip(feature.properties.name, { permanent: false, direction: 'auto' });
            }
        }
    });

    geoLayer.on('data:loaded', function() {
        clusterGroup.addLayer(geoLayer);
    });

    clusterGroup._geoLayer = geoLayer;
    return clusterGroup;
}

function createLineLayer(url, color) {
    return L.geoJSON.ajax(url, {
        style: { color: color, weight: 3, opacity: 0.8 },
        onEachFeature: function(feature, layer) {
            if (feature.properties && feature.properties.name) {
                layer.bindTooltip(feature.properties.name, { permanent: false, direction: 'auto' });
            }
        }
    });
}

// --- Load Layers ---
var boundaryLayer = L.geoJSON.ajax('src/boundary.geojson', {
    style: { color: '#3388ff', weight: 2, fillOpacity: 0.05 }
}).addTo(map);

var hotelsLayer = createClusteredPointLayer('src/hotels.geojson', 'hotels').addTo(map);
var touristPointsLayer = createClusteredPointLayer('src/touristpoints.geojson', 'touristpoints').addTo(map);
var passesLayer = createClusteredPointLayer('src/passes.geojson', 'passes').addTo(map);
var villagesLayer = createClusteredPointLayer('src/villages.geojson', 'villages').addTo(map);

var glaciersLayer = L.geoJSON.ajax('src/glaciers.geojson', {
    style: {
        color: '#87CEEB',
        weight: 1,
        opacity: 1,
        fillColor: '#FFFFFF',
        fillOpacity: 0.7
    }
}).addTo(map);

var highwaysLayer = createLineLayer('src/highway.geojson', '#2980b9').addTo(map);
var linkRoadsLayer = createLineLayer('src/linkroads.geojson', '#2c3e50').addTo(map);
var residentRoadsLayer = createLineLayer('src/residential.geojson', '#f39c12').addTo(map);
var tracksLayer = createLineLayer('src/tracks.geojson', '#16a085').addTo(map);

// New layers
var pathLayer = createLineLayer('src/path.geojson', '#e91e63');
var publicServiceLayer = createPublicServiceLayer('src/public_service.geojson');

// --- Loading Overlay ---
var allLayers = [
    boundaryLayer, hotelsLayer._geoLayer, touristPointsLayer._geoLayer,
    passesLayer._geoLayer, villagesLayer._geoLayer, glaciersLayer,
    highwaysLayer, linkRoadsLayer, residentRoadsLayer, tracksLayer,
    pathLayer, publicServiceLayer._geoLayer
];
var loadedCount = 0;

function checkAllLoaded() {
    loadedCount++;
    if (loadedCount >= allLayers.length) {
        var overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(function() { overlay.style.display = 'none'; }, 500);
        }
    }
}

allLayers.forEach(function(layer) {
    layer.on('data:loaded', checkAllLoaded);
    layer.on('data:error', checkAllLoaded);
});

setTimeout(function() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
        setTimeout(function() { overlay.style.display = 'none'; }, 500);
    }
}, 10000);

// --- Search ---
function searchData() {
    var input = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!input) return;

    var searchableLayers = [
        { checkbox: 'villagesCheckbox', layer: villagesLayer },
        { checkbox: 'passesCheckbox', layer: passesLayer },
        { checkbox: 'hotelCheckbox', layer: hotelsLayer },
        { checkbox: 'touristPointsCheckbox', layer: touristPointsLayer },
        { checkbox: 'publicServiceCheckbox', layer: publicServiceLayer }
    ];
    var found = false;

    searchableLayers.forEach(function(item) {
        var checkbox = document.getElementById(item.checkbox);
        if (checkbox && checkbox.checked && item.layer._geoLayer) {
            item.layer._geoLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.properties) {
                    var name = layer.feature.properties.name;
                    if (name && name.toLowerCase().includes(input)) {
                        var coords = layer.feature.geometry.coordinates;
                        map.flyTo([coords[1], coords[0]], 15, { duration: 1.5 });
                        layer.openPopup();
                        found = true;
                    }
                }
            });
        }
    });

    if (!found) {
        var searchInput = document.getElementById('searchInput');
        searchInput.style.borderColor = '#e74c3c';
        setTimeout(function() { searchInput.style.borderColor = ''; }, 1500);
    }
}

document.getElementById('searchInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        searchData();
    }
});

// --- Layer Toggle ---
function toggleLayer(checkboxId, layer) {
    var checkbox = document.getElementById(checkboxId);
    if (!checkbox) return;
    checkbox.addEventListener('change', function() {
        if (this.checked) {
            layer.addTo(map);
        } else {
            map.removeLayer(layer);
        }
        updateLegend();
    });
}

toggleLayer('boundaryCheckbox', boundaryLayer);
toggleLayer('hotelCheckbox', hotelsLayer);
toggleLayer('highwaysCheckbox', highwaysLayer);
toggleLayer('linkRoadsCheckbox', linkRoadsLayer);
toggleLayer('residentRoadsCheckbox', residentRoadsLayer);
toggleLayer('touristPointsCheckbox', touristPointsLayer);
toggleLayer('villagesCheckbox', villagesLayer);
toggleLayer('passesCheckbox', passesLayer);
toggleLayer('tracksCheckbox', tracksLayer);
toggleLayer('glaciersCheckbox', glaciersLayer);
toggleLayer('pathCheckbox', pathLayer);
toggleLayer('publicServiceCheckbox', publicServiceLayer);

// --- Legend ---
var layersInfo = {
    "Boundary": { layer: boundaryLayer, color: "#3388ff", type: "line" },
    "Hotels": { layer: hotelsLayer, icon: icons.hotels, type: "point" },
    "Tourist Points": { layer: touristPointsLayer, icon: icons.touristpoints, type: "point" },
    "Villages": { layer: villagesLayer, icon: icons.villages, type: "point" },
    "Passes": { layer: passesLayer, icon: icons.passes, type: "point" },
    "Highways": { layer: highwaysLayer, color: "#2980b9", type: "line" },
    "Link Roads": { layer: linkRoadsLayer, color: "#2c3e50", type: "line" },
    "Residential Roads": { layer: residentRoadsLayer, color: "#f39c12", type: "line" },
    "Tracks": { layer: tracksLayer, color: "#16a085", type: "line" },
    "Footpaths": { layer: pathLayer, color: "#e91e63", type: "line" },
    "Public Services": { layer: publicServiceLayer, color: "#c0392b", type: "line" }
};

function updateLegend() {
    var legendContent = '<strong>Legend</strong>';
    for (var key in layersInfo) {
        if (map.hasLayer(layersInfo[key].layer)) {
            if (layersInfo[key].type === "point") {
                legendContent += '<i class="icon-symbol" style="background-image: url(' + layersInfo[key].icon.options.iconUrl + ');"></i> ' + key + '<br>';
            } else {
                legendContent += '<i class="line-symbol" style="background: ' + layersInfo[key].color + ';"></i> ' + key + '<br>';
            }
        }
    }
    var legendDiv = document.getElementById('map-legend');
    if (legendDiv) {
        legendDiv.innerHTML = legendContent;
    }
}

var legend = L.control({ position: 'bottomleft' });
legend.onAdd = function() {
    var div = L.DomUtil.create('div', 'info legend');
    div.id = 'map-legend';
    return div;
};
legend.addTo(map);

var label = L.control({ position: 'bottomright' });
label.onAdd = function() {
    var div = L.DomUtil.create('div', 'map-label');
    div.innerHTML = 'Project of NCRG: IST Karachi<br>Developed by Israr Ahmad<br><strong>@GeoMapInk</strong>';
    return div;
};
label.addTo(map);

updateLegend();
map.on('overlayadd overlayremove', updateLegend);

// --- Map Controls ---
function printMap() {
    window.print();
}

function resetZoom() {
    map.flyTo(HUNZA_CENTER, DEFAULT_ZOOM, { duration: 1 });
}

// --- Fullscreen ---
function toggleFullscreen() {
    var btn = document.querySelector('#fullscreen-btn i');
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        btn.className = 'fas fa-compress';
    } else {
        document.exitFullscreen();
        btn.className = 'fas fa-expand';
    }
}

document.addEventListener('fullscreenchange', function() {
    var btn = document.querySelector('#fullscreen-btn i');
    if (btn) {
        btn.className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
    }
});

// --- Geolocation ---
var geoMarker = null;

function geolocateUser() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
        function(pos) {
            var latlng = [pos.coords.latitude, pos.coords.longitude];
            if (geoMarker) {
                map.removeLayer(geoMarker);
            }
            geoMarker = L.marker(latlng, {
                icon: L.divIcon({
                    className: 'geo-pulse',
                    iconSize: [20, 20]
                })
            }).addTo(map);
            geoMarker.bindPopup('<div class="popup-content"><h4>Your Location</h4></div>').openPopup();
            map.flyTo(latlng, 13, { duration: 1.5 });
        },
        function() {
            alert('Unable to retrieve your location.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

// --- Dark Mode ---
var isDarkMode = false;

function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    var btn = document.querySelector('#dark-mode-btn i');

    if (isDarkMode) {
        map.removeLayer(currentBaseMap);
        darkTileLayer.addTo(map);
        btn.className = 'fas fa-sun';
    } else {
        map.removeLayer(darkTileLayer);
        currentBaseMap.addTo(map);
        btn.className = 'fas fa-moon';
    }
}

// --- Share Map View ---
function shareMapView() {
    var center = map.getCenter();
    var zoom = map.getZoom();
    var hash = '#' + center.lat.toFixed(5) + '/' + center.lng.toFixed(5) + '/' + zoom;
    var url = window.location.origin + window.location.pathname + hash;

    window.location.hash = hash;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
    }

    var toast = document.getElementById('share-toast');
    toast.style.display = 'block';
    setTimeout(function() {
        toast.style.display = 'none';
    }, 2500);
}

// Update hash on map move
map.on('moveend', function() {
    var center = map.getCenter();
    var zoom = map.getZoom();
    window.location.hash = center.lat.toFixed(5) + '/' + center.lng.toFixed(5) + '/' + zoom;
});

// --- Distance Measurement Tool ---
var measureActive = false;
var measurePoints = [];
var measureMarkers = [];
var measureLine = null;

function toggleMeasure() {
    measureActive = !measureActive;
    var btn = document.getElementById('measure-btn');
    var tooltip = document.getElementById('measure-tooltip');

    if (measureActive) {
        btn.classList.add('active');
        tooltip.style.display = 'flex';
        map.getContainer().style.cursor = 'crosshair';
        map.on('click', onMeasureClick);
    } else {
        clearMeasure();
    }
}

function onMeasureClick(e) {
    if (!measureActive) return;
    measurePoints.push(e.latlng);

    var marker = L.circleMarker(e.latlng, {
        radius: 5,
        color: '#e74c3c',
        fillColor: '#e74c3c',
        fillOpacity: 1
    }).addTo(map);
    measureMarkers.push(marker);

    if (measureLine) {
        map.removeLayer(measureLine);
    }
    if (measurePoints.length > 1) {
        measureLine = L.polyline(measurePoints, {
            color: '#e74c3c',
            weight: 3,
            dashArray: '8, 8'
        }).addTo(map);
    }

    updateMeasureDistance();
}

function updateMeasureDistance() {
    var totalDistance = 0;
    for (var i = 1; i < measurePoints.length; i++) {
        totalDistance += measurePoints[i - 1].distanceTo(measurePoints[i]);
    }

    var distText;
    if (totalDistance > 1000) {
        distText = (totalDistance / 1000).toFixed(2) + ' km';
    } else {
        distText = totalDistance.toFixed(0) + ' m';
    }
    document.getElementById('measure-distance').textContent = distText;
}

function clearMeasure() {
    measureActive = false;
    measurePoints = [];
    var btn = document.getElementById('measure-btn');
    btn.classList.remove('active');
    document.getElementById('measure-tooltip').style.display = 'none';
    map.getContainer().style.cursor = '';
    map.off('click', onMeasureClick);

    measureMarkers.forEach(function(m) { map.removeLayer(m); });
    measureMarkers = [];
    if (measureLine) {
        map.removeLayer(measureLine);
        measureLine = null;
    }
}

// --- Nearby Search ---
var nearbyActive = false;
var nearbyCircle = null;
var nearbyMarkers = [];
var NEARBY_RADIUS = 5000; // 5km

function toggleNearbySearch() {
    nearbyActive = !nearbyActive;
    var btn = document.getElementById('nearby-btn');

    if (nearbyActive) {
        btn.classList.add('active');
        map.getContainer().style.cursor = 'crosshair';
        map.on('click', onNearbyClick);
    } else {
        clearNearby();
    }
}

function onNearbyClick(e) {
    clearNearbyResults();

    nearbyCircle = L.circle(e.latlng, {
        radius: NEARBY_RADIUS,
        color: '#e74c3c',
        fillColor: '#e74c3c',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5'
    }).addTo(map);

    var results = [];
    var layersToSearch = [
        { layer: hotelsLayer, name: 'Hotel' },
        { layer: touristPointsLayer, name: 'Tourist Point' },
        { layer: villagesLayer, name: 'Village' },
        { layer: passesLayer, name: 'Pass' },
        { layer: publicServiceLayer, name: 'Service' }
    ];

    layersToSearch.forEach(function(item) {
        if (item.layer._geoLayer) {
            item.layer._geoLayer.eachLayer(function(layer) {
                if (layer.feature && layer.feature.geometry) {
                    var coords = layer.feature.geometry.coordinates;
                    var latlng = L.latLng(coords[1], coords[0]);
                    var distance = e.latlng.distanceTo(latlng);
                    if (distance <= NEARBY_RADIUS) {
                        results.push({
                            name: layer.feature.properties.name || 'Unknown',
                            type: item.name,
                            distance: distance,
                            latlng: latlng
                        });
                    }
                }
            });
        }
    });

    results.sort(function(a, b) { return a.distance - b.distance; });

    var popupContent = '<div class="popup-content"><h4>Nearby Places (' + results.length + ')</h4>';
    if (results.length === 0) {
        popupContent += '<p>No places found within 5km</p>';
    } else {
        popupContent += '<div style="text-align:left; max-height:200px; overflow-y:auto; font-size:12px;">';
        results.slice(0, 15).forEach(function(r) {
            var dist = r.distance > 1000 ? (r.distance / 1000).toFixed(1) + 'km' : r.distance.toFixed(0) + 'm';
            popupContent += '<div style="padding:3px 0; border-bottom:1px solid #eee;">';
            popupContent += '<strong>' + r.name + '</strong> <span class="popup-type">' + r.type + '</span>';
            popupContent += ' <span style="color:#888;">' + dist + '</span>';
            popupContent += '</div>';
        });
        popupContent += '</div>';
    }
    popupContent += '</div>';

    L.popup({ maxWidth: 280 })
        .setLatLng(e.latlng)
        .setContent(popupContent)
        .openOn(map);
}

function clearNearbyResults() {
    if (nearbyCircle) {
        map.removeLayer(nearbyCircle);
        nearbyCircle = null;
    }
    nearbyMarkers.forEach(function(m) { map.removeLayer(m); });
    nearbyMarkers = [];
}

function clearNearby() {
    nearbyActive = false;
    var btn = document.getElementById('nearby-btn');
    btn.classList.remove('active');
    map.getContainer().style.cursor = '';
    map.off('click', onNearbyClick);
    clearNearbyResults();
}

// --- Weather Widget ---
function fetchWeather() {
    var widget = document.getElementById('weather-widget');
    // Using wttr.in free API (no key required)
    fetch('https://wttr.in/Hunza+Valley?format=j1')
        .then(function(res) { return res.json(); })
        .then(function(data) {
            var current = data.current_condition[0];
            var temp = current.temp_C;
            var desc = current.weatherDesc[0].value;
            var feelsLike = current.FeelsLikeC;
            var humidity = current.humidity;
            var windSpeed = current.windspeedKmph;

            var weatherIcon = '🌤️';
            var descLower = desc.toLowerCase();
            if (descLower.includes('rain')) weatherIcon = '🌧️';
            else if (descLower.includes('snow')) weatherIcon = '🌨️';
            else if (descLower.includes('cloud') || descLower.includes('overcast')) weatherIcon = '☁️';
            else if (descLower.includes('clear') || descLower.includes('sunny')) weatherIcon = '☀️';
            else if (descLower.includes('fog') || descLower.includes('mist')) weatherIcon = '🌫️';
            else if (descLower.includes('thunder')) weatherIcon = '⛈️';

            widget.innerHTML =
                '<span class="weather-icon">' + weatherIcon + '</span>' +
                '<div class="weather-info">' +
                '<div class="weather-temp">' + temp + '°C</div>' +
                '<div class="weather-desc">' + desc + '</div>' +
                '<div class="weather-desc">Feels ' + feelsLike + '°C · 💧' + humidity + '% · 💨' + windSpeed + 'km/h</div>' +
                '</div>';
        })
        .catch(function() {
            widget.innerHTML = '<span class="weather-icon">🌤️</span><div class="weather-info"><div class="weather-temp">Hunza Valley</div><div class="weather-desc">Weather unavailable</div></div>';
        });
}

fetchWeather();

// --- Mobile Sidebar Toggle ---
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

(function() {
    var container = document.getElementById('map-container');
    var overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = toggleSidebar;
    container.appendChild(overlay);
})();

// --- Draw Controls ---
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: {
        polyline: true,
        polygon: true,
        rectangle: true,
        circle: true,
        marker: true
    }
});
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, function(event) {
    drawnItems.addLayer(event.layer);
});

// Invalidate map size after DOM is ready
setTimeout(function() { map.invalidateSize(); }, 100);
