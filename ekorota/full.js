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
window.currentVehicleType = 1; // 1: Bus, 2: Tram, 3: Metro/Train, 4: Funicular, 5: Ship
window.routeUpdateInterval = null;
window.locationUpdateInterval = null;
window.APP_DATA = null;

// Config Yükle
window.fetchConfig = async function() {
  try {
    const res = await fetch('../ekodata/kentkartinfo.json');
    window.APP_DATA = await res.json();
    
    // Manuel Mapping Kontrolü (URL'de yoksa config'ten bak)
    const params = new URLSearchParams(window.location.search);
    if (!params.get('type') && window.APP_DATA) {
       const region = window.currentRegion;
       const route = window.currentRouteCode;
       const specials = window.APP_DATA.regions[region]?.specialVehicles || [];
       const found = specials.find(v => v.split(',')[0] === route);
       if (found) {
         window.currentVehicleType = parseInt(found.split(',')[1]);
       }
    }
  } catch (e) {
    console.error('Config fetch error:', e);
  }
};

// Smart Guess Vehicle Type
window.guessVehicleType = function(routeCode) {
  if (!routeCode) return 1;
  const code = routeCode.toString().toUpperCase();
  if (code.startsWith('T')) return 2; // Tram
  if (code.startsWith('M')) return 3; // Metro
  if (code.startsWith('F')) return 4; // Funicular
  if (code.startsWith('B') && code.length < 3) return 5; // Sea Bus (B1, B2...)
  return 1; // Default Bus
};

// Otobüs takip fonksiyonları
window.toggleBusTracking = function(plate) {
  // Önce tüm tracking durumlarını temizle
  document.querySelectorAll('.bus-info-card[data-plate]').forEach(item => {
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
    const targetItem = document.querySelector(`.bus-info-card[data-plate="${plate}"]`);
    if (targetItem) {
      targetItem.classList.add('tracking-active');
      targetItem.classList.add('pulse-anim');
      setTimeout(() => targetItem.classList.remove('pulse-anim'), 400);
    }
    
    // Otobüsü haritada odakla
    window.focusOnBus(plate);
  }
};

window.stopBusTracking = function() {
  window.trackedBusPlate = null;
  localStorage.removeItem('trackedBusPlate');
  document.querySelectorAll('.bus-info-card[data-plate]').forEach(item => {
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

window.calculateSmartETA = function(distance, stopDiff, vehicleType) {
  const routeCurvatureFactor = 1.28;
  const estimatedRoadDistance = distance * routeCurvatureFactor;
  let baseSpeed = 11.1; 
  if (vehicleType === 2) baseSpeed = 8.3;  
  if (vehicleType === 3) baseSpeed = 16.6; 
  if (vehicleType === 5) baseSpeed = 7.7;  
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  let trafficFactor = 1.0;
  const isWeekend = (day === 0 || day === 6);
  if (!isWeekend) {
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19.5)) {
      trafficFactor = 1.45;
    } else if (hour >= 12 && hour <= 14) {
      trafficFactor = 1.15;
    }
  }
  let travelTime = (estimatedRoadDistance / baseSpeed) * trafficFactor;
  let dwellTimePerStop = 25;
  if (vehicleType === 2) dwellTimePerStop = 20; 
  if (vehicleType === 3) dwellTimePerStop = 30; 
  if (stopDiff > 0) {
    const intermediateStops = Math.max(0, stopDiff - 1);
    travelTime += intermediateStops * dwellTimePerStop;
  } else {
    const estimatedStops = Math.floor(estimatedRoadDistance / 400);
    travelTime += Math.max(0, estimatedStops - 1) * dwellTimePerStop;
  }
  const trafficLightDelay = Math.floor(estimatedRoadDistance / 1000) * 30;
  travelTime += trafficLightDelay;
  let etaMinutes = Math.round(travelTime / 60);
  if (distance > 50 && etaMinutes < 1) { etaMinutes = 1; }
  if (distance <= 50 && stopDiff <= 1) { etaMinutes = 0; }
  return etaMinutes;
};

// İki nokta arasındaki açıyı (bearing) hesapla
window.calculateBearing = function(lat1, lng1, lat2, lng2) {
  const y = Math.sin((lng2 - lng1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lng2 - lng1) * Math.PI / 180);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
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

// Konum işlemleri — EkoLocation Engine kullanır
window.getUserLocation = function() {
  if (!window.EkoLocation) return;

  window.EkoLocation.onUpdate((coords) => {
    const userPos = [coords.lat, coords.lng];
    window.userLocation = userPos;
    window.addUserLocationToMap(userPos);
    window.nearestStop = window.findNearestStop(userPos);
  });

  window.EkoLocation.onError((err) => {
    console.warn('[EkoRota] Konum alınamadı:', err);
  });
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
  const busesHTML = busesInfo.map((bus, index) => {
    const statusText = bus.isAtStop ? 'DURAKTA' : 'YOLDA';
    const statusValue = bus.isAtStop ? '' : (bus.nextDistance > 0 ? window.formatDistance(bus.nextDistance) : '---');
    const targetStopName = bus.isAtStop ?
      (bus.nextStop ? bus.nextStop.stopName : 'Terminal') :
      (bus.nextStop ? bus.nextStop.stopName : 'Son Durak');

    let rightBoxHtml = '';
    let bottomBoxHtml = '';

    if (bus.userDistanceInfo) {
      if (bus.userDistanceInfo.type === "approaching") {
        const eta = window.calculateSmartETA(bus.userDistanceInfo.distance, bus.userDistanceInfo.stopsAway, window.currentVehicleType);
        
        rightBoxHtml = `
          <div class="card-status-orb" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:6px 10px; background:${bus.isAtStop ? 'var(--success-light)' : 'transparent'}; border:${bus.isAtStop ? '1px solid var(--success-border)' : 'none'};">
            <span style="font-size:1.2rem; font-weight:var(--font-weight-black); color:${bus.isAtStop ? 'var(--success-color)' : 'var(--primary-color)'}; line-height:1;">${eta} <span style="font-size:0.75rem;">dk</span></span>
            <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${window.formatDistance(bus.userDistanceInfo.distance)}</span>
          </div>
        `;

        bottomBoxHtml = `
          <div class="route-details" style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
            <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
              <i class="fas fa-arrow-right" style="color:var(--primary-light); font-size:0.65rem;"></i>
              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px;">${targetStopName}</span>
              <strong style="color:var(--primary-color);">${statusValue}</strong>
            </div>
            <div style="display:inline-flex; align-items:center; gap:5px; background:var(--background-soft); border:1px solid var(--border-light); padding:3px 8px; border-radius:6px; width:fit-content;">
              <i class="fas fa-map-marker-alt" style="color:var(--text-muted); font-size:0.65rem;"></i>
              <span style="font-size:0.7rem; font-weight:600; color:var(--text-secondary);">Size <strong style="color:var(--primary-color);">${bus.userDistanceInfo.stopsAway}</strong> durak mesafede</span>
            </div>
          </div>
        `;
      } else if (bus.userDistanceInfo.type === "passed") {
        rightBoxHtml = `
          <div class="card-status-orb" style="display:flex; align-items:center; justify-content:center; background:var(--danger-light); padding:8px 12px; border-radius:12px;">
            <span style="font-size:0.8rem; font-weight:var(--font-weight-black); color:var(--danger-color);">GEÇTİ</span>
          </div>
        `;
        bottomBoxHtml = `
          <div class="route-details" style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
            <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
              <i class="fas fa-arrow-right" style="color:var(--primary-light); font-size:0.65rem;"></i>
              <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:150px;">${targetStopName}</span>
            </div>
            <div style="display:inline-flex; align-items:center; gap:5px; background:var(--danger-light); padding:3px 8px; border-radius:6px; width:fit-content;">
              <i class="fas fa-times-circle" style="color:var(--danger-color); font-size:0.65rem;"></i>
              <span style="font-size:0.7rem; font-weight:600; color:var(--danger-color);">Durağınızı geçti</span>
            </div>
          </div>
        `;
      }
    } else {
      rightBoxHtml = `
        <div class="card-status-orb ${bus.isAtStop ? 'at-stop' : 'in-motion'}">
          <div class="status-label">${statusText}</div>
          <div class="status-dist">${statusValue}</div>
        </div>
      `;
      bottomBoxHtml = `
        <div class="route-details" style="margin-top:6px;">
          <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">
            <i class="fas fa-arrow-right" style="color:var(--primary-light); font-size:0.65rem;"></i>
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;">Sonraki: <strong>${targetStopName}</strong></span>
          </div>
        </div>
      `;
    }

    return `<div class="bus-info-card" data-plate="${bus.plate}" ${bus.passedUser ? 'style="opacity:0.65;"' : ''}>
      <div class="card-glow" style="background: ${bus.isAtStop ? 'var(--success-color)' : 'var(--primary-color)'};">
        <div class="sequence-mini">#${index + 1}</div>
      </div>
      
      <div class="card-main">
        <div class="bus-id-section">
          <div class="bus-icon-pill">
            <i class="fas fa-bus"></i>
          </div>
          <div class="plate-number">${bus.plate}</div>
        </div>
        ${bottomBoxHtml}
      </div>

      ${rightBoxHtml}
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
      <div class="stop-entry ${isNearest ? 'nearest' : ''}">
        <div class="stop-node-container">
          <div class="stop-node ${isFirst ? 'start' : ''} ${isLast ? 'end' : ''} ${isNearest ? 'nearest' : ''}">
            ${isNearest ? '<i class="fas fa-location-dot"></i>' : stop.index}
          </div>
          ${!isLast ? '<div class="stop-line"></div>' : ''}
        </div>
        
        <div class="stop-content-card ${isNearest ? 'nearest-stop-highlight' : ''}" onclick="window.redirectToStop('${stop.stopId}')">
          <div class="stop-info-main">
            <div class="stop-name-row">
              <span class="stop-name">${stop.stopName}</span>
              <div class="stop-badges">
                ${isFirst ? '<span class="sbadge start">BAŞLANGIÇ</span>' : ''}
                ${isLast ? '<span class="sbadge end">BİTİŞ</span>' : ''}
              </div>
            </div>
          </div>
          
          ${busesCurrentlyAtThisStop.length > 0 ? `
            <div class="buses-dock">
              ${busesCurrentlyAtThisStop.map(plate => `
                <div class="bus-badge at-stop">
                  <i class="fas fa-bus"></i>
                  <span>${plate}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    if (!isLast) {
      const nextStop = window.stopPositions[i + 1];
      const segmentKey = `${stop.stopId}-${nextStop.stopId}`;
      const busesInThisSegment = busesBetweenStops[segmentKey] || [];

      if (busesInThisSegment.length > 0) {
        stopsHTML += `
          <div class="segment-container">
            <div class="segment-line-container">
              <div class="segment-line"></div>
            </div>
            <div class="segment-buses">
              ${busesInThisSegment.map(busInfo => `
                <div class="bus-badge moving" data-plate="${busInfo.plate}">
                  <i class="fas fa-bus"></i>
                  <span class="plate">${busInfo.plate}</span>
                  <span class="dist"><i class="fas fa-arrow-down"></i> ${window.formatDistance(busInfo.distanceToNext)}</span>
                </div>
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
      <div class="nearest-stop-card" onclick="window.redirectToStop('${window.nearestStop.stopId}')" style="background:var(--card-background); border:1px solid var(--border-light); border-radius:16px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; cursor:pointer; box-shadow:var(--shadow-sm); transition:all 0.2s;">
        <div style="display:flex; align-items:center; gap:14px;">
          <div style="width:40px; height:40px; background:var(--primary-soft); color:var(--primary-color); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">
            <i class="fas fa-map-marker-alt"></i>
          </div>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <div style="font-size:0.75rem; color:var(--text-muted); font-weight:600; letter-spacing:0.5px; text-transform:uppercase;">Konumunuza Yakın</div>
            <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary); line-height:1.2;">${window.nearestStop.stopName}</div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px; display:flex; align-items:center; gap:6px;">
              <div style="background:var(--background-soft); padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:5px; border:1px solid var(--border-light);">
                <i class="fas fa-walking" style="color:var(--primary-light); font-size:0.75rem;"></i>
                <span style="font-weight:600; font-size:0.75rem;">${window.formatDistance(window.nearestStop.distance)} yürüme</span>
              </div>
            </div>
          </div>
        </div>
        <div style="color:var(--border-color);"><i class="fas fa-chevron-right"></i></div>
      </div>
    `;
  }

  // Ana içeriği güncelle
  document.getElementById('route-info').innerHTML = `
    <div class="section-container first-section">
      <div class="section-meta-label">${route.headSign}</div>
      <h3 class="section-title"><i class="fas fa-bus-alt"></i>Aktif Otobüsler <span class="count-badge">${route.busList.length}</span></h3>
      <div class="bus-cards-grid">${busesHTML}</div>
    </div>

    <div class="section-container">
      <h3 class="section-title"><i class="fas fa-location-arrow"></i>En Yakın Durak</h3>
      ${nearestStopInfo || '<div class="info-item empty-state">Konum bilgisi alınamadı.</div>'}
    </div>

    <div class="section-container">
      <h3 class="section-title"><i class="fas fa-map-marker-alt"></i>Durak Listesi <span class="count-badge">${window.stopPositions.length}</span></h3>
      <div class="timeline-container">${stopsHTML}</div>
    </div>

    <div class="section-container">
      <h3 class="section-title"><i class="fas fa-clock"></i>Sefer Saatleri</h3>
      <div id="schedule-section">
        ${window.generateScheduleDisplay(route.scheduleList)}
      </div>
    </div>
  `;
  
  // Sefer saatleri tablarını ayarla
  window.setupScheduleTabs();
  
  // Liste elemanlarına tıklama event'i ekle
  document.querySelectorAll('.bus-info-card[data-plate]').forEach(item => {
    item.addEventListener('click', () => {
      const plate = item.dataset.plate;
      window.toggleBusTracking(plate);
    });
  });

  // Takip edilen otobüsün görsel durumunu güncelle
  document.querySelectorAll('.bus-info-card[data-plate]').forEach(item => {
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
  const routeCode = params.get('route');
  window.currentRouteCode = routeCode;
  window.currentDirection = parseInt(params.get('direction')) || 0;
  window.backLink = params.get('back') || "";
  window.currentRegion = params.get('region') || '004';
  window.trackedBusPlate = localStorage.getItem('trackedBusPlate');

  // Config yükle
  window.fetchConfig();

  // Araç tipi belirleme (URL override > Smart Guess)
  const typeParam = params.get('type');
  window.currentVehicleType = typeParam ? parseInt(typeParam) : window.guessVehicleType(routeCode);

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
    // Konum güncellemeleri artık watchPosition ile yapıldığı için locationUpdateInterval kaldırıldı
  }

  // Event listener'ları ekle
  document.getElementById('toggleDirectionBtn').addEventListener('click', window.toggleDirection);
  document.getElementById('centerToUserLocationBtn').addEventListener('click', window.centerToUserLocation);
  document.getElementById('openSearchPageBtn').addEventListener('click', window.openSearchPage);
  document.getElementById('goBackBtn').addEventListener('click', window.goBack);
}

window.onload = init;