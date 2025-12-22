// Uygulama değişkenleri
window.currentDirection = 0;
window.currentRouteCode = '';
window.currentRegion = '004';
window.stopPositions = [];
window.segmentDistances = [];
window.backLink = "";
window.userLocation = null;
window.nearestStop = null;
window.activeScheduleTab = 0; 
window.isFirstLoad = true;
window.directionChanged = false;
window.trackedBusPlate = null;
window.routeUpdateInterval = null;
window.locationUpdateInterval = null;

// Otobüs takip fonksiyonları
window.toggleBusTracking = function(plate) {
  // Önce tüm tracking durumlarını temizle
  document.querySelectorAll('.info-item[data-plate]').forEach(item => {
    item.classList.remove('tracking-active');
  });

  if (window.trackedBusPlate === plate) {
    // Eğer aynı otobüsü tekrar tıkladıysa tracking'i durdur
    window.stopBusTracking();
  } else {
    // Yeni otobüsü takip et
    if (window.trackedBusPlate) {
      window.stopBusTracking();
    }
    
    window.trackedBusPlate = plate;
    localStorage.setItem('trackedBusPlate', window.trackedBusPlate);
    
    // Hemen görsel güncellemesini yap
    const targetItem = document.querySelector(`.info-item[data-plate="${plate}"]`);
    if (targetItem) {
      targetItem.classList.add('tracking-active');
    }
    
    // Otobüsü haritada odakla
    window.focusOnBus(plate);
  }
};

window.stopBusTracking = function() {
  window.trackedBusPlate = null;
  localStorage.removeItem('trackedBusPlate');
  document.querySelectorAll('.info-item[data-plate]').forEach(item => {
    item.classList.remove('tracking-active'); 
  });
};

// Yardımcı fonksiyonlar
window.formatDistance = function(distance) {
  return distance >= 1000
    ? `${(distance / 1000).toFixed(1)} km`
    : `${Math.round(distance)} m`;
};

window.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

window.calculateSegmentDistances = function(routeCoordinates) {
  const segments = [];
  let total = 0;
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const dist = window.calculateDistance(
      routeCoordinates[i][0], routeCoordinates[i][1],
      routeCoordinates[i + 1][0], routeCoordinates[i + 1][1]
    );
    segments.push({
      startIndex: i,
      endIndex: i + 1,
      distance: dist,
      cumulativeDistance: total
    });
    total += dist;
  }
  return {
    segments,
    totalDistance: total
  };
};

window.projectBusPosition = function(busPos, routeCoords, segments) {
  let minDist = Infinity;
  let nearest = null;
  segments.forEach(seg => {
    const start = routeCoords[seg.startIndex];
    const end = routeCoords[seg.endIndex];
    const dx = end[1] - start[1];
    const dy = end[0] - start[0];
    const segmentLengthSq = dx * dx + dy * dy;
    let t = 0;
    if (segmentLengthSq > 0) {
      t = ((busPos[1] - start[1]) * dx + (busPos[0] - start[0]) * dy) / segmentLengthSq;
    }
    const clampedT = Math.max(0, Math.min(1, t));
    const proj = [
      start[0] + clampedT * dy,
      start[1] + clampedT * dx
    ];
    const dist = window.calculateDistance(busPos[0], busPos[1], proj[0], proj[1]);
    if (dist < minDist) {
      minDist = dist;
      nearest = {
        point: proj,
        segment: seg,
        t: clampedT,
        cumulativeDistance: seg.cumulativeDistance + (clampedT * seg.distance),
        distanceToRoute: dist 
      };
    }
  });
  return nearest;
};

window.findSurroundingStops = function(cumulativeDist, stops) {
  let prevStop = null;
  let nextStop = null;
  for (let i = 0; i < stops.length; i++) {
    if (stops[i].cumulativeDistance <= cumulativeDist) {
      prevStop = stops[i];
    } else {
      nextStop = stops[i];
      break;
    }
  }
  return {
    prevStop,
    nextStop
  };
};

window.calculateDistanceAlongRoute = function(point, routeCoords, segments) {
  const proj = window.projectBusPosition(point, routeCoords, segments);
  return proj ? proj.cumulativeDistance : 0;
};

window.findNearestStop = function(userPos) {
  if (!userPos || !window.stopPositions.length) return null;

  let minDist = Infinity;
  let nearest = null;

  window.stopPositions.forEach(stop => {
    const dist = window.calculateDistance(
      userPos[0], userPos[1],
      stop.position[0], stop.position[1]
    );

    if (dist < minDist) {
      minDist = dist;
      nearest = {
        ...stop,
        distance: dist
      };
    }
  });

  return nearest;
};

// Konum işlemleri
window.getUserLocation = function() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(position => {
      const userPos = [position.coords.latitude, position.coords.longitude];
      window.userLocation = userPos;

      // Haritaya kullanıcı konumunu ekle
      window.addUserLocationToMap(userPos);

      window.nearestStop = window.findNearestStop(userPos);

      if (window.currentRouteCode) {
        window.fetchRouteInfo(window.currentRouteCode);
      }
      
      // Konum API çağrısı
      fetch('https://gman.dev/location', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            lat: userPos[0],
            lng: userPos[1]
          })
        })
        .then(res => res.json())
        .then(data => console.log('Location API yanıtı:', data))
        .catch(err => console.error('Location API hatası:', err));

    }, error => {
      console.error("Konum alınamadı: ", error.message);
    });
  }
};

// Rota bilgilerini getirme ve gösterme
window.fetchRouteInfo = async function(routeCode) {
  try {
    window.currentRouteCode = routeCode;
    const data = await fetchRouteInfoFromApi(routeCode, window.currentDirection, window.currentRegion);
    window.displayRouteOnMap(data);
  } catch (error) {
    document.getElementById('route-info').innerHTML = `
      <div class="info-item" style="color:#f56565; border-left-color:#f56565;">
        <strong>Hata</strong>
        <div class="info-detail">
          ${error.message}
        </div>
      </div>`;
  }
};

window.displayRouteOnMap = function(data) {
  const prevMarkers = { ...window.activeBusMarkers };
  const prevBuses = Object.keys(prevMarkers);
  const newBusMarkers = {};

  // Harita katmanlarını temizle
  window.clearMapLayers();

  window.activeBusMarkers = {};
  window.stopPositions = [];
  window.segmentDistances = [];
  
  const route = data.pathList[0];
  document.getElementById('route-title').textContent = `Hat: ${route.displayRouteCode}`;
  
  // Rota koordinatları
  const routeCoords = route.pointList.map(p => [parseFloat(p.lat), parseFloat(p.lng)]);
  const { segments } = window.calculateSegmentDistances(routeCoords);
  window.segmentDistances = segments;

  // Rotayı haritaya çiz
  window.drawRoute(routeCoords);

  // İlk yükleme veya yön değişikliğinde haritayı sığdır
  if (window.isFirstLoad || window.directionChanged) {
    window.fitMapToBounds();
    window.isFirstLoad = false;
    window.directionChanged = false;
  }
  
  // Durak pozisyonlarını hesapla
  window.stopPositions = route.busStopList.map(stop => ({
    ...stop,
    position: [parseFloat(stop.lat), parseFloat(stop.lng)],
    cumulativeDistance: window.calculateDistanceAlongRoute(
      [parseFloat(stop.lat), parseFloat(stop.lng)],
      routeCoords,
      window.segmentDistances
    )
  })).sort((a, b) => a.cumulativeDistance - b.cumulativeDistance);
  
  window.stopPositions.forEach((stop, idx) => stop.index = idx + 1);
  
  // Durakları haritaya ekle
  window.addStopsToMap(window.stopPositions, window.nearestStop);
  
  // En yakın durağı güncelle
  if (window.userLocation) {
    window.nearestStop = window.findNearestStop(window.userLocation);
  }

  // Otobüs verilerini işle
  const busesBetweenStops = {};
  const busesAtStopExact = {}; 

  const busesInfo = route.busList.map(bus => {
    const busPos = [parseFloat(bus.lat), parseFloat(bus.lng)];
    const proj = window.projectBusPosition(busPos, routeCoords, window.segmentDistances);

    if (!proj) {
      console.warn(`Bus ${bus.plateNumber} could not be projected onto the route.`);
      return null; 
    }

    const stops = window.findSurroundingStops(proj.cumulativeDistance, window.stopPositions);

    let isAtStop = false;
    let targetStopForDisplay = null;
    let distanceToTargetForDisplay = 0;

    // Durakta mı kontrolü
    if (stops.nextStop && window.calculateDistance(busPos[0], busPos[1], stops.nextStop.position[0], stops.nextStop.position[1]) <= 20) {
      isAtStop = true;
      targetStopForDisplay = stops.nextStop;
      if (!busesAtStopExact[stops.nextStop.stopId]) {
        busesAtStopExact[stops.nextStop.stopId] = [];
      }
      busesAtStopExact[stops.nextStop.stopId].push(bus.plateNumber);
    } else if (stops.prevStop && window.calculateDistance(busPos[0], busPos[1], stops.prevStop.position[0], stops.prevStop.position[1]) <= 20) {
      isAtStop = true;
      targetStopForDisplay = stops.prevStop;
      if (!busesAtStopExact[stops.prevStop.stopId]) {
        busesAtStopExact[stops.prevStop.stopId] = [];
      }
      busesAtStopExact[stops.prevStop.stopId].push(bus.plateNumber);
    }

    const displayStatus = isAtStop ? 'Durakta' : 'Sırada';
    const targetStopName = targetStopForDisplay ? targetStopForDisplay.stopName : (stops.nextStop ? stops.nextStop.stopName : 'Rota Sonu');
    distanceToTargetForDisplay = isAtStop ? 0 : (stops.nextStop ? stops.nextStop.cumulativeDistance - proj.cumulativeDistance : 0);

    // Duraklar arası otobüs bilgisi
    if (!isAtStop && stops.prevStop && stops.nextStop) {
      const segmentKey = `${stops.prevStop.stopId}-${stops.nextStop.stopId}`;
      if (!busesBetweenStops[segmentKey]) {
        busesBetweenStops[segmentKey] = [];
      }
      busesBetweenStops[segmentKey].push({
        plate: bus.plateNumber,
        distanceFromPrev: proj.cumulativeDistance - stops.prevStop.cumulativeDistance,
        distanceToNext: stops.nextStop.cumulativeDistance - proj.cumulativeDistance
      });
    }

    let marker;

    // Otobüs marker'ı oluştur veya güncelle
    if (prevMarkers[bus.plateNumber]) {
      marker = prevMarkers[bus.plateNumber];
      const prevPosition = marker.getLatLng();
      const prevPos = [prevPosition.lat, prevPosition.lng];

      // Animasyon başlat
      window.animateBusMovement(
        bus.plateNumber,
        prevPos,
        busPos,
        bus.bearing,
        routeCoords,
        window.segmentDistances
      );
    } else {
      // Yeni otobüs marker'ı oluştur
      marker = window.createOrUpdateBusMarker(bus, true);
    }

    newBusMarkers[bus.plateNumber] = marker;
    window.activeBusMarkers[bus.plateNumber] = marker;

    window.prevBusPositions[bus.plateNumber] = {
      position: busPos,
      bearing: bus.bearing
    };
    
    // Kullanıcı mesafe bilgisi
    let userDistanceInfo = null;
    let distanceToUser = Infinity;
    let passedUser = false;
    
    if (window.nearestStop && window.userLocation) {
      const nearestStopIndex = window.stopPositions.findIndex(s => s.stopId === window.nearestStop.stopId);
      const nextStopIndex = stops.nextStop ? window.stopPositions.findIndex(s => s.stopId === stops.nextStop.stopId) : -1;

      if (nearestStopIndex >= 0 && nextStopIndex >= 0) {
        if (nextStopIndex < nearestStopIndex) {
          const stopsAway = nearestStopIndex - nextStopIndex;
          const distToUser = window.stopPositions[nearestStopIndex].cumulativeDistance - proj.cumulativeDistance;
          userDistanceInfo = {
            type: "approaching",
            stopsAway: stopsAway,
            distance: distToUser
          };
          passedUser = false;
        } else if (nextStopIndex === nearestStopIndex) {
          const distToUser = window.stopPositions[nearestStopIndex].cumulativeDistance - proj.cumulativeDistance;
          userDistanceInfo = {
            type: "approaching",
            stopsAway: 0,
            distance: distToUser
          };
          passedUser = false;
        } else {
          userDistanceInfo = {
            type: "passed"
          };
          passedUser = true;
        }
      }
    }
    
    return {
      plate: bus.plateNumber,
      position: busPos,
      marker: marker,
      nextStop: stops.nextStop,
      nextDistance: distanceToTargetForDisplay, 
      isAtStop: isAtStop, 
      cumDistance: proj.cumulativeDistance,
      userDistanceInfo: userDistanceInfo,
      passedUser: passedUser
    };
  }).filter(Boolean).sort((a, b) => { 
    if (a.passedUser !== b.passedUser) {
      return a.passedUser ? 1 : -1;
    }
    if (a.userDistanceInfo?.distance !== undefined && b.userDistanceInfo?.distance !== undefined) {
      return a.userDistanceInfo.distance - b.userDistanceInfo.distance;
    }
    return 0;
  });

  // Eski marker'ları temizle
  Object.keys(prevMarkers).forEach(plate => {
    if (!newBusMarkers[plate]) {
      window.map.removeLayer(prevMarkers[plate]);
      delete window.prevBusPositions[plate];
      if (window.busAnimations[plate]) {
        cancelAnimationFrame(window.busAnimations[plate].animationId);
        delete window.busAnimations[plate];
      }
    }
  });

  // Otobüs listesi HTML'i oluştur
  const busesHTML = busesInfo.map(bus => {
    let userStatusHtml = '';
    if (bus.userDistanceInfo) {
      if (bus.userDistanceInfo.type === "approaching") {
        userStatusHtml = `
        <div class="bus-user-status approaching">
          <div class="user-status-icon">👤</div>
          <span>Size ${bus.userDistanceInfo.stopsAway} durak • ${window.formatDistance(bus.userDistanceInfo.distance)}</span>
        </div>
      `;
      } else if (bus.userDistanceInfo.type === "passed") {
        userStatusHtml = `
        <div class="bus-user-status passed">
          <div class="user-status-icon">✕</div>
          <span>Durağınızı geçti</span>
        </div>
      `;
      }
    }

    const statusText = bus.isAtStop ? 'DURAKTA' : 'YOLDA';
    const statusValue = bus.isAtStop ? '' : (bus.nextDistance > 0 ? window.formatDistance(bus.nextDistance) : '---');
    const targetStopName = bus.isAtStop ?
      (bus.nextStop ? bus.nextStop.stopName : 'Terminal') :
      (bus.nextStop ? bus.nextStop.stopName : 'Son Durak');

    return `<div class="info-item" data-plate="${bus.plate}" ${bus.passedUser ? 'style="opacity:0.8;"' : ''}>
    <div class="bus-main-content">
      <div class="bus-plate-header">
        <div class="bus-plate-number">${bus.plate}</div>
      </div>

      <div class="bus-destination">
        <div class="destination-icon"></div>
        <div class="destination-text">${targetStopName}</div>
      </div>

      ${userStatusHtml}
    </div>

    <div class="bus-status-panel">
      <div class="status-text">${statusText}</div>
      <div class="status-value">${statusValue}</div>
    </div>
  </div>`;
  }).join('');

  // Duraklar HTML'i oluştur
  let stopsHTML = '';
  for (let i = 0; i < window.stopPositions.length; i++) {
    const stop = window.stopPositions[i];
    const isFirst = i === 0;
    const isLast = i === window.stopPositions.length - 1;
    const isNearest = window.nearestStop && stop.stopId === window.nearestStop.stopId;
    const busesCurrentlyAtThisStop = busesAtStopExact[stop.stopId] || [];

    stopsHTML += `
      <div class="info-item stop-item ${isNearest ? 'nearest-stop-highlight' : ''}" onclick="window.redirectToStop('${stop.stopId}')">
        <div class="stop-main-info">
          <div class="stop-name-and-badges">
            <span class="stop-index">${stop.index}.</span> <strong>${stop.stopName}</strong>
            ${isFirst ? '<span class="stop-badge start-badge">Başlangıç</span>' : ''}
            ${isLast ? '<span class="stop-badge end-badge">Bitiş</span>' : ''}
            ${isNearest ? '<span class="stop-badge nearest-badge">Size En Yakın</span>' : ''}
          </div>
        </div>
        ${busesCurrentlyAtThisStop.length > 0 ? `
          <div class="buses-at-stop-indicator">
            <i class="fas fa-bus"></i> Durakta:
            ${busesCurrentlyAtThisStop.map(plate => `<span class="bus-plate-tag-at-stop">${plate}</span>`).join(', ')}
          </div>
        ` : ''}
      </div>
    `;

    if (!isLast) {
      const nextStop = window.stopPositions[i + 1];
      const segmentKey = `${stop.stopId}-${nextStop.stopId}`;
      const busesInThisSegment = busesBetweenStops[segmentKey] || [];

      if (busesInThisSegment.length > 0) {
        stopsHTML += `
          <div class="segment-buses-summary">
            <div class="segment-arrow"><i class="fas fa-arrow-down"></i></div>
            <div class="segment-bus-plates">
              ${busesInThisSegment.map(busInfo => `
                <span class="bus-plate-tag-between-stops">${busInfo.plate}</span>
                <span class="segment-distance-info">(${window.formatDistance(busInfo.distanceFromPrev)} / ${window.formatDistance(busInfo.distanceToNext)})</span>
              `).join('')}
            </div>
          </div>
        `;
      }
    }
  }

  // En yakın durak bilgisi
  let nearestStopInfo = '';
  if (window.nearestStop) {
    nearestStopInfo = `
      <div class="info-item nearest-user-stop" onclick="window.redirectToStop('${window.nearestStop.stopId}')">
        <strong>Size En Yakın Durak: ${window.nearestStop.stopName}</strong>
        <div class="info-detail">
          <i class="fas fa-walking" style="margin-right: 5px;"></i>
          Mesafe: ${window.formatDistance(window.nearestStop.distance)}
        </div>
      </div>
    `;
  }

  // Ana içeriği güncelle
  document.getElementById('route-info').innerHTML = `
    <h3 class="section-title"><i class="fas fa-bus-alt" style="margin-right: 8px;"></i>(${route.busList.length}) ${route.headSign}</h3>
    ${busesHTML}

    <h3 class="section-title"><i class="fas fa-location-arrow" style="margin-right: 8px;"></i>Konum Bilgisi</h3>
    ${nearestStopInfo || '<div class="info-item">Konum bilgisi alınamadı.</div>'}

    <h3 class="section-title"><i class="fas fa-map-marker-alt" style="margin-right: 8px;"></i>Duraklar (${window.stopPositions.length})</h3>
        ${stopsHTML}

    <h3 class="section-title"><i class="fas fa-clock" style="margin-right: 8px;"></i>Sefer Saatleri</h3>
    <div id="schedule-section">
      ${window.generateScheduleDisplay(route.scheduleList)}
    </div>
  `;
  
  // Sefer saatleri tablarını ayarla
  window.setupScheduleTabs();
  
  // Liste elemanlarına tıklama event'i ekle
  document.querySelectorAll('.info-item[data-plate]').forEach(item => {
    item.addEventListener('click', () => {
      const plate = item.dataset.plate;
      window.toggleBusTracking(plate);
      const marker = window.activeBusMarkers[plate];
      if (marker) {
        window.map.setView(marker.getLatLng(), 16);
      }
    });
  });

  // Takip edilen otobüsün görsel durumunu güncelle
  document.querySelectorAll('.info-item[data-plate]').forEach(item => {
    if (item.dataset.plate === window.trackedBusPlate) {
      item.classList.add('tracking-active');
    } else {
      item.classList.remove('tracking-active');
    }
  });

  // Takip edilen otobüse odaklan
  if (window.trackedBusPlate && window.activeBusMarkers[window.trackedBusPlate]) {
    window.focusOnBus(window.trackedBusPlate);
  }
};

// Uygulama başlatma
function init() {
  const params = new URLSearchParams(window.location.search);
  window.currentRouteCode = params.get('route');
  window.currentDirection = parseInt(params.get('direction')) || 0;
  window.backLink = params.get('back') || "";
  window.currentRegion = params.get('region') || '004';
  window.trackedBusPlate = localStorage.getItem('trackedBusPlate');

  // Haritayı başlat
  window.initializeMap();

  // Kullanıcı konumunu al
  window.getUserLocation();

  if (window.currentRouteCode) {
    window.fetchRouteInfo(window.currentRouteCode);

    // Interval'ları temizle
    if (window.routeUpdateInterval) clearInterval(window.routeUpdateInterval);
    if (window.locationUpdateInterval) clearInterval(window.locationUpdateInterval);

    // Yeni interval'ları ayarla
    window.routeUpdateInterval = setInterval(() => {
      if (window.currentRouteCode) {
        window.fetchRouteInfo(window.currentRouteCode);
      }
    }, 10000);

    window.locationUpdateInterval = setInterval(() => {
      window.getUserLocation();
    }, 5000);
  }

  // Event listener'ları ekle
  document.getElementById('toggleDirectionBtn').addEventListener('click', window.toggleDirection);
  document.getElementById('centerToUserLocationBtn').addEventListener('click', window.centerToUserLocation);
  document.getElementById('openSearchPageBtn').addEventListener('click', window.openSearchPage);
  document.getElementById('goBackBtn').addEventListener('click', window.goBack);
}

window.onload = init;