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
    zoomControl: true,
    attributionControl: true,
    preferCanvas: true // Performans iyileştirmesi
  }).setView([defaultLat, defaultLng], 12);

  // Ana harita katmanı - OpenStreetMap'in daha detaylı versiyonu
  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
    minZoom: 8
  });

  // Alternatif detaylı harita katmanları
  const cartoDB = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 19,
    minZoom: 8
  });

  const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles © Esri',
    maxZoom: 19,
    minZoom: 8
  });

  osmLayer.addTo(window.map);

  // Harita katmanları kontrolü ekle
  const baseLayers = {
    "Detaylı Harita": cartoDB,
    "Standart": osmLayer,
    "Uydu": esriSatellite
  };

  L.control.layers(baseLayers).addTo(window.map);

  // Drag olayını dinle
  window.map.on('dragstart', function() {
    if (window.trackedBusPlate) {
      window.stopBusTracking();
    }
  });

  // Harita stili iyileştirmeleri
  window.map.getContainer().style.borderRadius = '12px';
  window.map.getContainer().style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
};

// Gelişmiş otobüs ikonu - parlak turuncu tasarım
window.createBusIconWithPlate = function(plateNumber, bearing) {
  const iconHtml = `
    <div style="position:relative;">
      <svg width="36" height="36" viewBox="0 0 72 72" style="transform:rotate(${bearing-90}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <rect x="12" y="20" width="48" height="28" rx="8" fill="#0d9488" stroke="#0f766e" stroke-width="2"/>
        <rect x="18" y="24" width="10" height="12" rx="3" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
        <rect x="31" y="24" width="10" height="12" rx="3" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
        <rect x="44" y="24" width="10" height="12" rx="3" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="1"/>
        <circle cx="24" cy="52" r="6" fill="#1f2937" stroke="#111827" stroke-width="2"/>
        <circle cx="48" cy="52" r="6" fill="#1f2937" stroke="#111827" stroke-width="2"/>
        <circle cx="24" cy="52" r="3" fill="#4b5563"/>
        <circle cx="48" cy="52" r="3" fill="#4b5563"/>
        <circle cx="60" cy="34" r="3" fill="#fde047" stroke="#eab308" stroke-width="1"/>
        <rect x="12" y="26" width="48" height="3" rx="1" fill="#5eead4" opacity="0.7"/>
      </svg>
      <div style="position:absolute; top:-25px; left:50%; transform:translateX(-50%); 
                  background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%); 
                  color:white; font-weight:bold; padding:3px 8px; 
                  border-radius:6px; border:2px solid white; 
                  box-shadow:0 3px 8px rgba(0,0,0,0.3); 
                  font-size:11px; text-align:center; white-space:nowrap; 
                  min-width:45px; font-family: 'Arial', sans-serif;">
        ${plateNumber}
      </div>
    </div>
    
    `
    
    ;
    
  return L.divIcon({
    html: iconHtml,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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

// Durak ikonu - daha güzel tasarım
window.createStopIcon = function(isFirst, isLast, isNearest) {
  let color, size, label;
  
  if (isFirst) {
    color = '#059669'; // Yeşil - başlangıç
    size = 24;
    label = 'B';
  } else if (isLast) {
    color = '#dc2626'; // Kırmızı - bitiş
    size = 24;
    label = 'S';
  } else if (isNearest) {
    color = '#ea580c'; // Turuncu - en yakın
    size = 20;
    label = '●';
  } else {
    color = '#0284c7'; // Mavi - normal durak
    size = 16;
    label = '●';
  }
  
  return L.divIcon({
    html: `<div style="background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
           width:${size}px; height:${size}px; border-radius:50%;
           border:3px solid white; box-shadow:0 3px 6px rgba(0,0,0,0.3);
           display:flex; align-items:center; justify-content:center;
           color:white; font-weight:bold; font-size:${size > 16 ? '12px' : '10px'};
           font-family: 'Arial', sans-serif;">
           ${isFirst || isLast ? label : ''}
           </div>`,
    iconSize: [size, size],
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
    
    const stopIcon = window.createStopIcon(isFirst, isLast, isNearest);
    
    const marker = L.marker(stop.position, {
      icon: stopIcon
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
    window.map.flyTo(marker.getLatLng(), 16, {
      animate: true,
      duration: 1
    }); 
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
window.animateBusMovement = function(busPlate, startPos, endPos, bearing) {
  if (window.busAnimations[busPlate]) {
    cancelAnimationFrame(window.busAnimations[busPlate].animationId);
  }

  const startTime = performance.now();
  const duration = 9900; // 9.9 saniye animasyon

  let startBearing = bearing;
  if (window.prevBusPositions[busPlate] && window.prevBusPositions[busPlate].bearing !== undefined) {
    startBearing = window.prevBusPositions[busPlate].bearing;
  }

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    let progress = Math.min(1, elapsed / duration);

    // Yumuşak easing fonksiyonu
    progress = progress < 0.5 
      ? 4 * progress * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Gerçek koordinatlar arasında doğrusal interpolasyon
    const currentPos = [
      startPos[0] + (endPos[0] - startPos[0]) * progress,
      startPos[1] + (endPos[1] - startPos[1]) * progress
    ];

    let currentBearing = bearing;
    if (startBearing !== bearing) {
      let angleDiff = ((bearing - startBearing + 180) % 360) - 180;
      if (angleDiff < -180) angleDiff += 360;

      currentBearing = startBearing + angleDiff * progress;
    }

    const marker = window.activeBusMarkers[busPlate];
    if (marker) {
      marker.setLatLng(currentPos);

      const updatedIcon = window.createBusIconWithPlate(busPlate, currentBearing);
      marker.setIcon(updatedIcon);

      if (window.trackedBusPlate === busPlate) {
        window.map.panTo(currentPos, {
          animate: true,
          duration: 0.25
        });
      }
    }

    if (progress < 1) {
      window.busAnimations[busPlate].animationId = requestAnimationFrame(animate);
    } else {
      delete window.busAnimations[busPlate];
    }
  }

  window.busAnimations[busPlate] = {
    animationId: requestAnimationFrame(animate)
  };
};