// ========================================
// GeoMapInk - Interactive Map of Hunza Valley
// ========================================

var HUNZA_CENTER = [36.3167, 74.6500];
var DEFAULT_ZOOM = 9;

var map = L.map('map', {
    zoomControl: true,
    attributionControl: true
}).setView(HUNZA_CENTER, DEFAULT_ZOOM);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
}).addTo(map);

// --- Custom Icons ---
var icons = {
    hotels: L.icon({ iconUrl: 'icons/hotel.svg', iconSize: [20, 20] }),
    touristpoints: L.icon({ iconUrl: 'icons/touristpoint.svg', iconSize: [35, 35] }),
    passes: L.icon({ iconUrl: 'icons/passes.svg', iconSize: [35, 35] }),
    glaciers: L.icon({ iconUrl: 'icons/glacier.png', iconSize: [15, 15] }),
    villages: L.icon({ iconUrl: 'icons/village.svg', iconSize: [20, 20] })
};

// --- Popup HTML Builder ---
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
        html += '<img src="' + props.imageUrl + '" alt="' + (props.name || type) + '" loading="lazy">';
    }
    html += '</div>';
    return html;
}

// --- Layer Factory ---
function createPointLayer(url, layerType) {
    return L.geoJSON.ajax(url, {
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

var hotelsLayer = createPointLayer('src/hotels.geojson', 'hotels').addTo(map);
var touristPointsLayer = createPointLayer('src/touristpoints.geojson', 'touristpoints').addTo(map);
var passesLayer = createPointLayer('src/passes.geojson', 'passes').addTo(map);
var villagesLayer = createPointLayer('src/villages.geojson', 'villages').addTo(map);

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

// --- Loading Overlay ---
var layersToLoad = [
    boundaryLayer, hotelsLayer, touristPointsLayer, passesLayer,
    villagesLayer, glaciersLayer, highwaysLayer, linkRoadsLayer,
    residentRoadsLayer, tracksLayer
];
var loadedCount = 0;

function checkAllLoaded() {
    loadedCount++;
    if (loadedCount >= layersToLoad.length) {
        var overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(function() { overlay.style.display = 'none'; }, 500);
        }
    }
}

layersToLoad.forEach(function(layer) {
    layer.on('data:loaded', checkAllLoaded);
    layer.on('data:error', checkAllLoaded);
});

// Hide overlay after 8s as fallback
setTimeout(function() {
    var overlay = document.getElementById('loading-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
        setTimeout(function() { overlay.style.display = 'none'; }, 500);
    }
}, 8000);

// --- Search ---
function searchData() {
    var input = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!input) return;

    var checkboxes = ['villagesCheckbox', 'passesCheckbox', 'hotelCheckbox', 'touristPointsCheckbox'];
    var layerMap = {
        villages: villagesLayer,
        passes: passesLayer,
        hotel: hotelsLayer,
        touristPoints: touristPointsLayer
    };
    var found = false;

    checkboxes.forEach(function(checkboxId) {
        var checkbox = document.getElementById(checkboxId);
        if (checkbox && checkbox.checked) {
            var key = checkboxId.replace('Checkbox', '');
            var targetLayer = layerMap[key];
            if (targetLayer) {
                targetLayer.eachLayer(function(layer) {
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
    "Tracks": { layer: tracksLayer, color: "#16a085", type: "line" }
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

// --- Mobile Sidebar Toggle ---
function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

// Create overlay element for mobile sidebar
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
