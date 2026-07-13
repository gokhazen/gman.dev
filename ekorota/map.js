// Region koordinatları
const CONFIG = {
  '004': [40.7686795, 29.9526597],
  '010': [37.2153, 28.3636],
  '003': [37.0000, 35.3213],
  '019': [36.5444, 31.9956],
  '029': [41.1833, 31.3833],
  '017': [37.7167, 30.2833],
  '007': [40.1553, 26.4142],
  '036': [40.8438, 31.1565],
  '013': [41.6818, 26.5623],
  '020': [41.2833, 31.4167],
  '032': [37.3212, 40.7245],
  '026': [36.8841, 30.7056],
  '023': [37.9667, 34.6833],
  '025': [41.3887, 33.7827],
  '027': [41.7333, 27.2167],
  '031': [40.9839, 37.8764],
  '033': [37.0742, 36.2611],
  '037': [41.2500, 32.6833],
  '005': [39.7477, 37.0179],
  '011': [39.8181, 34.8147]
};

// URL parametrelerinden region'ı al ve varsayılan koordinatları belirle
const getRegionCoordinates = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const currentRegion = urlParams.get('region') || '004';
  return CONFIG[currentRegion] || CONFIG['004'];
};

// Harita değişkenleri
window.map = null;
window.activeBusMarkers = {};
window.routePolyline = null;
window.userMarker = null;
window.prevBusPositions = {};
window.busAnimations = {};

// Harita başlatma - Region tabanlı koordinatlar ile
window.initializeMap = function() {
  const [defaultLat, defaultLng] = getRegionCoordinates();
  
  window.map = L.map('map', {
    zoomControl: false, 
    attributionControl: false, 
    preferCanvas: true 
  }).setView([defaultLat, defaultLng], 12);

  // Google Maps Katmanları
  const googleStreets = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    attribution: 'Google Maps',
    maxZoom: 20
  });

  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenStreetMaps',
    maxZoom: 19
  });

  const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    attribution: 'Google Maps',
    maxZoom: 20
  });

  googleStreets.addTo(window.map);

  // Custom Map Name & Layer Selector (Bottom Right)
  const MapTypeSelector = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
      const container = L.DomUtil.create('div', 'custom-map-name-frame');
      container.innerHTML = `
        <div class="active-map-name" title="Harita Katmanları" style="width:36px; height:36px; justify-content:center; padding:0; font-size:1.1rem; border-radius:10px; background:var(--card-background); border:1px solid var(--border-light); color:var(--text-secondary);"><i class="fas fa-layer-group"></i></div>
        <div class="map-type-dropdown" style="top:auto; bottom:100%; margin-bottom:8px;">
          <div class="map-type-option active" data-layer="street">Google Maps</div>
          <div class="map-type-option" data-layer="sat">Google Uydu</div>
          <div class="map-type-option" data-layer="osm">OpenStreetMaps</div>
        </div>
      `;

      const activeName = container.querySelector('.active-map-name');
      const dropdown = container.querySelector('.map-type-dropdown');

      activeName.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
      };

      container.querySelectorAll('.map-type-option').forEach(opt => {
        opt.onclick = (e) => {
          e.stopPropagation();
          const type = opt.dataset.layer;
          
          window.map.removeLayer(googleStreets);
          window.map.removeLayer(googleHybrid);
          window.map.removeLayer(osmLayer);

          if (type === 'street') {
            googleStreets.addTo(window.map);
          }
          if (type === 'sat') {
            googleHybrid.addTo(window.map);
          }
          if (type === 'osm') {
            osmLayer.addTo(window.map);
          }

          container.querySelectorAll('.map-type-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          dropdown.classList.remove('show');
        };
      });

      window.map.on('click', () => dropdown.classList.remove('show'));
      L.DomEvent.disableClickPropagation(container);
      return container;
    }
  });

  new MapTypeSelector().addTo(window.map);

  // Custom Zoom Controls (2-BUTTON)
  const ZoomControls = L.Control.extend({
    options: { position: 'bottomright' },
    onAdd: function() {
      const container = L.DomUtil.create('div', 'custom-map-controls-frame');
      
      const zoomIn = L.DomUtil.create('button', 'map-ctrl-btn zoom-in', container);
      zoomIn.innerHTML = '<i class="fas fa-plus"></i>';
      
      const zoomOut = L.DomUtil.create('button', 'map-ctrl-btn zoom-out', container);
      zoomOut.innerHTML = '<i class="fas fa-minus"></i>';
      
      zoomIn.onclick = () => window.map.zoomIn();
      zoomOut.onclick = () => window.map.zoomOut();

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.disableScrollPropagation(container);
      return container;
    }
  });

  new ZoomControls().addTo(window.map);

  // Drag olayını dinle
  window.map.on('dragstart', function() {
    if (window.trackedBusPlate) {
      window.stopBusTracking();
    }
  });

  // Harita stili iyileştirmeleri
  window.map.getContainer().style.borderRadius = '12px';
  window.map.getContainer().style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';

  // Zoom seviyesine göre durak görünürlüğünü kontrol et (Aşamalı Reveal)
  window.map.on('zoomend', () => {
    const zoom = window.map.getZoom();
    const container = window.map.getContainer();
    
    // Temizle
    container.classList.remove('show-stop-numbers', 'show-stop-labels');
    
    if (zoom >= 16) {
      container.classList.add('show-stop-labels');
    } else if (zoom >= 14) {
      container.classList.add('show-stop-numbers');
    }
  });
};

// Gelişmiş Araç İkonları - Dinamik Tip ve Model Desteği
window.createBusIconWithPlate = function(plateNumber, bearing, typeOverride = null) {
  const type = typeOverride || window.currentVehicleType || 1;
  const mainColor = '#0d9488'; // Tüm araçlar standart Teal
  const shadowColor = '#0f766e';
  const svgSize = 42; // Tüm araçlar standart 42px (pseudo-3D için biraz büyük)

  // Modeli merkezi kütüphaneden çek (ekodata/models/vehicles.js)
  const vehicleSvg = window.getVehicleModel(type, mainColor, shadowColor);

  const iconHtml = `
    <div style="position:relative;">
      <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 72 72" style="transform:rotate(${bearing-90}deg); filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4)); overflow:visible;">
        ${vehicleSvg}
      </svg>
      <div style="position:absolute; top:-25px; left:50%; transform:translateX(-50%);
                  background: linear-gradient(135deg, ${mainColor} 0%, ${shadowColor} 100%);
                  color:white; font-weight:var(--font-weight-heavy); padding:2px 7px;
                  border-radius:6px; border:2px solid white;
                  box-shadow:0 3px 8px rgba(0,0,0,0.3);
                  font-size:10.5px; text-align:center; white-space:nowrap;
                  min-width:44px; font-family: var(--font-sans);
                  letter-spacing: -0.2px;">
        ${plateNumber}
      </div>
    </div>`;

  return L.divIcon({
    html: iconHtml,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    className: 'custom-bus-icon'
  });
};

// Kullanıcı konumu ikonu - daha şık tasarım
window.createUserLocationIcon = function() {
  return L.divIcon({
    html: `<div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
              width:20px; height:20px; border-radius:50%;
              border:4px solid white; box-shadow:0 4px 8px rgba(0,0,0,0.3);
              position:relative; z-index:1000;
              animation: pulse 2s infinite;">
              <style>
                @keyframes pulse {
                  0% { box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(59, 130, 246, 0.4); }
                  70% { box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 0 10px rgba(59, 130, 246, 0); }
                  100% { box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(59, 130, 246, 0); }
                }
              </style>
           </div>`,
    iconSize: [28, 28],
    className: 'user-location-icon'
  });
};

// Durak ikonu ve Etkileşimli İsim Etiketi
window.createStopIcon = function(stop, isFirst, isLast, isNearest, angle = -45, isCrowded = false) {
  let color, size, label;
  
  if (isFirst) { color = '#059669'; size = 20; label = 'B'; }
  else if (isLast) { color = '#dc2626'; size = 20; label = 'S'; }
  else if (isNearest) { color = '#ea580c'; size = 18; label = ''; }
  else { color = '#0284c7'; size = 14; label = ''; }

  // Okunabilirlik için açıyı kontrol et ve metni asla ters döndürme
  let displayAngle = angle;
  // Leaflet/CSS rotasyonunda -90 ile 90 arası hep okunabilir. 
  // Eğer açı bu aralık dışındaysa (90'dan büyükse) 180 derece döndür ki düzelsin.
  let isFlipped = false;
  if (displayAngle > 90) { displayAngle -= 180; isFlipped = true; }
  else if (displayAngle < -90) { displayAngle += 180; isFlipped = true; }
  
  const stopIndex = stop && stop.index ? `${stop.index}.` : '';
  const stopName = stop ? (stop.stopName || stop.busStopName || stop.name || "") : "";

  const iconHtml = `
    <div class="stop-marker-wrapper ${isCrowded ? 'crowded-label' : ''}">
      <div class="stop-dot" style="background: ${color}; width:${size}px; height:${size}px;">
        ${label}
      </div>
      <div class="stop-name-label" style="transform: translateY(-50%) rotate(${displayAngle}deg); ${isFlipped ? 'margin-left: -4px; transform: translateY(-50%) rotate('+displayAngle+'deg) scaleX(-1);' : ''}">
        <span class="idx" style="${isFlipped ? 'transform: scaleX(-1); display: inline-block;' : ''}">${stopIndex}</span>
        <span class="name" style="${isFlipped ? 'transform: scaleX(-1); display: inline-block;' : ''}">${stopName}</span>
      </div>
    </div>
  `;
  
  return L.divIcon({
    html: iconHtml,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    className: 'custom-stop-icon'
  });
};

// Rota çizimi - daha şık görünüm
window.drawRoute = function(routeCoords) {
  // Önceki polyline'ı temizle
  if (window.routePolyline) {
    window.map.removeLayer(window.routePolyline);
  }
  
  window.routePolyline = L.polyline(routeCoords, {
    color: '#2563eb',
    weight: 6,
    opacity: 0.8,
    smoothFactor: 1.5,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(window.map);
  
  // Rota üzerine gölge efekti ekle
  const shadowPolyline = L.polyline(routeCoords, {
    color: '#000000',
    weight: 8,
    opacity: 0.2,
    smoothFactor: 1.5,
    lineCap: 'round',
    lineJoin: 'round'
  }).addTo(window.map);
  
  // Gölgeyi ana rotanın altına yerleştir
  shadowPolyline.bringToBack();
  
  return window.routePolyline;
};

// Durakları haritaya ekleme
window.addStopsToMap = function(stopPositions, nearestStop) {
  stopPositions.forEach((stop, index) => {
    const isFirst = index === 0;
    const isLast = index === stopPositions.length - 1;
    const isNearest = nearestStop && stop.stopId === nearestStop.stopId;
    
    // Yakınlık kontrolü (Dinamik küçültme için)
    let isCrowded = false;
    if (index > 0) {
      const prev = stopPositions[index-1];
      const dist = window.calculateDistance(stop.position[0], stop.position[1], prev.position[0], prev.position[1]);
      if (dist < 40) isCrowded = true; // 40 metreden kısaysa kalabalık say
    }
    if (!isCrowded && index < stopPositions.length - 1) {
      const next = stopPositions[index+1];
      const dist = window.calculateDistance(stop.position[0], stop.position[1], next.position[0], next.position[1]);
      if (dist < 40) isCrowded = true;
    }

    // Gelişmiş Zigzag Etiket Algoritması (Durak isimlerinin birbirini ezmemesi için)
    // Her durak bir öncekine göre ters açıya yatar, böylece asla üst üste binmezler.
    let baseAngle = (index % 2 === 0) ? 35 : -35;
    
    if (isCrowded) {
      // Eğer duraklar çok yakınsa, çarpışmamaları için açıları daha dik yap (+55 ve -55)
      baseAngle = (index % 2 === 0) ? 55 : -55; 
    }
    
    // Rotanın genel yönüne göre ince ayar (opsiyonel)
    const ni = Math.max(0, Math.min(index, stopPositions.length - 2));
    const p1 = stopPositions[ni].position;
    const p2 = stopPositions[ni + 1].position;
    const bearing = window.calculateBearing(p1[0], p1[1], p2[0], p2[1]);
    
    // Eğer yol tam sağa/sola gidiyorsa ve etiketler yola paralel düşüyorsa açıları dikleştir
    if (Math.abs(Math.sin(bearing * Math.PI / 180)) < 0.3) {
       baseAngle = (index % 2 === 0) ? 60 : -60;
    }

    let routeAngle = baseAngle;

    const stopIcon = window.createStopIcon(stop, isFirst, isLast, isNearest, routeAngle, isCrowded);
    
    const marker = L.marker(stop.position, {
      icon: stopIcon,
      zIndexOffset: isNearest ? 1500 : 500
    }).addTo(window.map);

    // Popup'ları kapat - sadece plaka göster
    marker.off('click');
  });
};

// Kullanıcı konumunu haritaya ekleme
window.addUserLocationToMap = function(userPos) {
  if (window.userMarker) {
    window.map.removeLayer(window.userMarker);
  }

  const userIcon = window.createUserLocationIcon();
  
  window.userMarker = L.marker(userPos, {
    icon: userIcon,
    zIndexOffset: 2000
  }).addTo(window.map);

  // Popup'ı kapat
  window.userMarker.off('click');
};

// Otobüs marker'ı oluşturma veya güncelleme
window.createOrUpdateBusMarker = function(bus, isNew = false) {
  const busPos = [parseFloat(bus.lat), parseFloat(bus.lng)];
  const busIcon = window.createBusIconWithPlate(bus.plateNumber, bus.bearing);
  
  let marker;
  
  if (isNew) {
    marker = L.marker(busPos, {
      icon: busIcon,
      zIndexOffset: 1000
    }).addTo(window.map);
    
    // Marker'a tıklama event'i ekle - popup açılmasın
    marker.on('click', function(e) {
      e.target.closePopup();
      window.toggleBusTracking(bus.plateNumber);
    });
  } else {
    marker = window.activeBusMarkers[bus.plateNumber];
    if (marker) {
      marker.setIcon(busIcon);
    }
  }
  
  // Popup'ları kapat
  if (marker) {
    marker.off('popupopen');
    marker.closePopup();
  }
  
  return marker;
};

// Harita temizleme (otobüsler hariç)
window.clearMapLayers = function() {
  window.map.eachLayer(layer => {
    if (layer instanceof L.Polyline ||
      (layer instanceof L.Marker && layer !== window.userMarker &&
        !Object.values(window.activeBusMarkers).includes(layer))) {
      window.map.removeLayer(layer);
    }
  });
};

// Otobüs marker'larını temizleme
window.clearBusMarkers = function(keepPlates = []) {
  Object.keys(window.activeBusMarkers).forEach(plate => {
    if (!keepPlates.includes(plate)) {
      window.map.removeLayer(window.activeBusMarkers[plate]);
      delete window.activeBusMarkers[plate];
      delete window.prevBusPositions[plate];
      
      if (window.busAnimations[plate]) {
        cancelAnimationFrame(window.busAnimations[plate].animationId);
        delete window.busAnimations[plate];
      }
    }
  });
};

// Haritayı rota sınırlarına sığdırma - animasyonlu
window.fitMapToBounds = function() {
  if (window.routePolyline) {
    window.map.fitBounds(window.routePolyline.getBounds(), {
      padding: [20, 20],
      animate: true,
      duration: 1
    });
  }
};

// Belirli bir konuma odaklanma - animasyonlu
window.focusOnLocation = function(position, zoomLevel = 16) {
  window.map.flyTo(position, zoomLevel, {
    animate: true,
    duration: 1.5
  });
};

// Otobüs takibi için odaklanma
window.focusOnBus = function(plate) {
  const marker = window.activeBusMarkers[plate];
  if (marker) {
    window.isFlying = true;
    window.map.flyTo(marker.getLatLng(), 16, {
      animate: true,
      duration: 1.5
    }); 
    setTimeout(() => { window.isFlying = false; }, 1500);
  }
};

// Kullanıcı konumuna odaklanma
window.centerToUserLocation = function() {
  if (window.userLocation) {
    window.focusOnLocation(window.userLocation, 16);
  } else {
    alert('Konum bilgisi bulunamadı. Lütfen konum izni verin.');
  }
};

// Otobüs hareket animasyonu - gerçek konumları kullanarak
// Akıcı ve Tahminli Otobüs Hareketi (Sürekli Akış Sistemi)
window.animateBusMovement = function(busPlate, startPos, endPos, bearing) {
  if (window.busAnimations[busPlate]) {
    cancelAnimationFrame(window.busAnimations[busPlate].animationId);
  }

  const duration = 10000; 
  const startTime = performance.now();
  let startBearing = bearing;
  
  if (window.prevBusPositions[busPlate] && window.prevBusPositions[busPlate].bearing !== undefined) {
    startBearing = window.prevBusPositions[busPlate].bearing;
  }

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    let progress = Math.min(1, elapsed / duration);
    
    // Smooth Easing (easeInOutQuad)
    let easedProgress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

    const currentPos = [
      startPos[0] + (endPos[0] - startPos[0]) * easedProgress,
      startPos[1] + (endPos[1] - startPos[1]) * easedProgress
    ];

    // Yön (bearing) interpolasyonu
    let currentBearing = bearing;
    if (startBearing !== bearing) {
      let angleDiff = ((bearing - startBearing + 180) % 360) - 180;
      if (angleDiff < -180) angleDiff += 360;
      currentBearing = startBearing + angleDiff * easedProgress;
    }

    const marker = window.activeBusMarkers[busPlate];
    if (marker) {
      marker.setLatLng(currentPos);
      
      // Performansı artırmak ve titremeyi önlemek için ikonu yeniden oluşturmak yerine
      // mevcut DOM elementini bularak SVG'nin rotasyonunu güncelliyoruz.
      const el = marker.getElement();
      if (el) {
        const svgEl = el.querySelector('svg');
        if (svgEl) {
          svgEl.style.transform = `rotate(${currentBearing - 90}deg)`;
        }
      }

      if (window.trackedBusPlate === busPlate && !window.isFlying) {
        window.map.panTo(currentPos, { animate: true, duration: 0.2 });
      }
    }

    if (progress < 1) {
      window.busAnimations[busPlate].animationId = requestAnimationFrame(animate);
    }
  }

  window.busAnimations[busPlate] = {
    animationId: requestAnimationFrame(animate)
  };
};