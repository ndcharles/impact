// Helper to load external scripts dynamically
function loadScript(url) {
  return new Promise((resolve, reject) => {
    var script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Helper to load external CSS
function loadCSS(url) {
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

async function init() {
  // 1. Load external libraries (Leaflet and Looker Studio SDK)
  loadCSS('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
  await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  await loadScript('https://storage.googleapis.com/looker-studio-community-visualization-sdk/dscc.min.js');

  // 2. Create DOM elements
  var container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100vh';
  container.style.position = 'relative';
  
  var mapDiv = document.createElement('div');
  mapDiv.id = 'map';
  container.appendChild(mapDiv);

  var panelDiv = document.createElement('div');
  panelDiv.id = 'panel';
  panelDiv.innerHTML = '<button id="panel-close">✕</button><div id="panel-content"></div>';
  container.appendChild(panelDiv);

  document.body.appendChild(container);

  // 3. Initialize Map
  var map = L.map('map').setView([51.505, -0.09], 2);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 20
  }).addTo(map);

  var markersLayer = L.layerGroup().addTo(map);

  // 4. Panel Logic
  var panel = document.getElementById('panel');
  var panelContent = document.getElementById('panel-content');
  
  document.getElementById('panel-close').onclick = function() {
    panel.classList.remove('open');
    setTimeout(function() { map.invalidateSize(); }, 300);
  };

  function openPanel(data) {
    var priceFormatted = data.price ? '£' + Number(data.price).toLocaleString('en-GB') : 'N/A';
    var amenitiesList = data.amenities ? String(data.amenities).split(',').map(function(a) { return '<li>' + a.trim() + '</li>'; }).join('') : '<li>N/A</li>';
    
    panelContent.innerHTML = 
      '<button id="panel-close-inner" style="float:right;border:none;background:none;font-size:16px;cursor:pointer;">✕</button>' +
      '<h2>' + (data.name || 'Listing') + '</h2>' +
      '<div class="loc">Located in <em>' + (data.postcode || '—') + '</em> 📍</div>' +
      '<div class="rule"></div>' +
      '<img class="panel-img" src="' + (data.image || 'https://picsum.photos/seed/fallback/640/420') + '" onerror="this.src=\'https://picsum.photos/seed/fallback/640/420\';" />' +
      '<p><span class="strong">Price:</span> ' + priceFormatted + '</p>' +
      '<p class="strong">Amenities:</p><ul style="padding-left:20px;line-height:1.5;">' + amenitiesList + '</ul>';
      
    panel.classList.add('open');
    setTimeout(function() { map.invalidateSize(); }, 300);
    
    // Re-attach close button event for the inner button
    document.getElementById('panel-close-inner').onclick = function() {
      panel.classList.remove('open');
      setTimeout(function() { map.invalidateSize(); }, 300);
    };
  }

  // 5. Looker Studio API Integration
  var dscc = window.dscc;

  function renderViz(data, style) {
    markersLayer.clearLayers();
    
    // Safely get field IDs mapped by the user
    var latId = data.fields.lat && data.fields.lat[0] ? data.fields.lat[0].id : null;
    var lngId = data.fields.lng && data.fields.lng[0] ? data.fields.lng[0].id : null;
    var nameId = data.fields.name && data.fields.name[0] ? data.fields.name[0].id : null;
    var priceId = data.fields.price && data.fields.price[0] ? data.fields.price[0].id : null;
    var imageId = data.fields.image && data.fields.image[0] ? data.fields.image[0].id : null;
    var amenitiesId = data.fields.amenities && data.fields.amenities[0] ? data.fields.amenities[0].id : null;

    if (!latId || !lngId) return; // Wait for user to map Lat/Lng

    var bubbleColor = (style.mapStyle && style.mapStyle.bubbleColor) ? style.mapStyle.bubbleColor.value : '#3aaab9';
    var bounds = [];

    data.tables.default.forEach(function(row) {
      var lat = parseFloat(row[latId]);
      var lng = parseFloat(row[lngId]);
      
      if (isFinite(lat) && isFinite(lng)) {
        bounds.push([lat, lng]);
        
        var rowData = {
          name: nameId ? row[nameId] : 'Listing',
          price: priceId ? row[priceId] : null,
          image: imageId ? row[imageId] : '',
          amenities: amenitiesId ? row[amenitiesId] : ''
        };

        L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: bubbleColor,
          color: '#2b8ca0',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }).on('click', function() {
          openPanel(rowData);
        }).addTo(markersLayer);
      }
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  // Subscribe to Looker Studio data updates
  dscc.subscribeToData(renderViz, {transform: dscc.objectTransform});
}

init().catch(console.error);