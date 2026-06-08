// Rota Bulma İşlevleri - rotabulma.js

/**
 * İki koordinat arasındaki mesafeyi hesaplar (Haversine formülü)
 */
function getDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Dünya'nın yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1000; // metre cinsinden
}

/**
 * Belirtilen koordinata en yakın durakları bulur
 */
function findNearestStops(lat, lng, stops, maxDistance = 100, maxCount = 10) {
    const distances = stops.map(stop => {
        const distance = getDistance(lat, lng, parseFloat(stop.lat), parseFloat(stop.lng));
        return { stop, distance };
    }).sort((a, b) => a.distance - b.distance);
    
    const nearbyStops = distances.filter(d => d.distance <= maxDistance);
    
    if (nearbyStops.length > 0) {
        const result = nearbyStops.slice(0, maxCount);
        console.log(`100m çapında ${result.length} durak bulundu (max ${maxCount})`);
        return result;
    } else {
        const result = distances.slice(0, 1);
        console.log(`100m çapında durak yok, en yakın durak: ${result[0].distance.toFixed(0)}m`);
        return result;
    }
}

/**
 * Belirtilen koordinata en yakın tek durak bulur
 */
function findNearestStop(lat, lng, stops) {
    let nearest = null;
    let minDistance = Infinity;
    
    stops.forEach(stop => {
        const distance = getDistance(lat, lng, parseFloat(stop.lat), parseFloat(stop.lng));
        if (distance < minDistance) {
            minDistance = distance;
            nearest = stop;
        }
    });
    
    return { stop: nearest, distance: minDistance };
}

/**
 * Belirtilen güzergahta alternatif hatları bulur
 */
function findAlternativeRoutes(startStopId, endStopId, currentRouteNumber, routes) {
    const alternatives = [];
    
    for (const [routeKey, stopList] of Object.entries(routes)) {
        const routeNumber = routeKey.split('_')[0];
        
        if (routeNumber === currentRouteNumber) continue;
        
        const startIdx = stopList.indexOf(startStopId);
        const endIdx = stopList.indexOf(endStopId);
        
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const stopCount = endIdx - startIdx + 1;
            alternatives.push({
                routeNumber: routeNumber,
                routeKey: routeKey,
                stopCount: stopCount,
                stops: stopList.slice(startIdx, endIdx + 1)
            });
        }
    }
    
    return alternatives.sort((a, b) => a.stopCount - b.stopCount);
}

/**
 * En iyi rotayı bulur (başlangıç ve bitiş koordinatlarına göre)
 */
function findBestRoute(startLat, startLng, endLat, endLng, stops, routes, map, routeMarkers, routeLines, makeRouteNumberClickable, displayRouteOnMap) {
    console.log('100m çapında 10 durak ile rota aranıyor...');
    
    const startStops = findNearestStops(startLat, startLng, stops);
    const endStops = findNearestStops(endLat, endLng, stops);
    
    console.log(`Başlangıç durakları: ${startStops.map(s => `${s.stop.stopName}(${Math.round(s.distance)}m)`).join(', ')}`);
    console.log(`Bitiş durakları: ${endStops.map(s => `${s.stop.stopName}(${Math.round(s.distance)}m)`).join(', ')}`);
    
    let bestRoute = null;
    let bestScore = Infinity;
    let bestStartStop = null;
    let bestEndStop = null;
    let totalCombinations = 0;
    
    for (const startCandidate of startStops) {
        for (const endCandidate of endStops) {
            totalCombinations++;
            const route = findRouteBetweenStops(startCandidate.stop.stopId, endCandidate.stop.stopId, routes, stops);
            
            if (route) {
                const transferPenalty = (route.transferCount || 0) * 10;
                const stopPenalty = route.totalStops || 0;
                const distancePenalty = (startCandidate.distance + endCandidate.distance) / 100;
                
                const score = transferPenalty + stopPenalty + distancePenalty;
                
                if (score < bestScore) {
                    bestScore = score;
                    bestRoute = route;
                    bestStartStop = startCandidate;
                    bestEndStop = endCandidate;
                }
            }
        }
    }
    
    console.log(`${totalCombinations} kombinasyon test edildi`);
    
    if (bestRoute) {
        console.log(`En iyi rota: ${bestStartStop.stop.stopName}(${Math.round(bestStartStop.distance)}m) -> ${bestEndStop.stop.stopName}(${Math.round(bestEndStop.distance)}m) (skor: ${bestScore.toFixed(1)})`);
        return {
            route: bestRoute,
            startStop: bestStartStop,
            endStop: bestEndStop,
            score: bestScore,
            combinationsTested: totalCombinations
        };
    }
    
    console.log('Hiçbir kombinasyonda rota bulunamadı');
    return null;
}

/**
 * İki durak arasında rota bulur (BFS algoritması kullanarak)
 */
function findRouteBetweenStops(startStopId, endStopId, routes, stops) {
    console.log(`BFS ile rota aranıyor: ${startStopId} -> ${endStopId}`);
    
    if (startStopId === endStopId) {
        return {
            type: 'same_stop',
            message: 'Başlangıç ve bitiş aynı durak!'
        };
    }

    const stopToRoutes = new Map();
    for (const [routeKey, stopList] of Object.entries(routes)) {
        stopList.forEach((stopId, index) => {
            if (!stopToRoutes.has(stopId)) {
                stopToRoutes.set(stopId, []);
            }
            stopToRoutes.get(stopId).push({
                routeKey: routeKey,
                routeNumber: routeKey.split('_')[0],
                index: index,
                stopList: stopList
            });
        });
    }

    const queue = [{
        stopId: startStopId,
        path: [],
        transfers: 0
    }];
    
    const visited = new Set([startStopId]);
    const maxTransfers = 5;
    
    while (queue.length > 0) {
        const current = queue.shift();
        
        if (current.transfers > maxTransfers) continue;
        
        if (current.stopId === endStopId) {
            return buildRouteResult(current.path, startStopId, endStopId, routes);
        }

        const currentRoutes = stopToRoutes.get(current.stopId) || [];
        
        for (const routeInfo of currentRoutes) {
            const { routeKey, routeNumber, index, stopList } = routeInfo;
            
            for (let i = index + 1; i < stopList.length; i++) {
                const nextStopId = stopList[i];
                
                if (visited.has(nextStopId)) continue;
                
                visited.add(nextStopId);
                
                const newPath = [...current.path];
                
                const isTransfer = current.path.length > 0 && 
                                 current.path[current.path.length - 1].routeKey !== routeKey;
                
                if (newPath.length === 0 || newPath[newPath.length - 1].routeKey !== routeKey) {
                    newPath.push({
                        routeKey: routeKey,
                        routeNumber: routeNumber,
                        startStopId: current.stopId,
                        startIndex: index,
                        stops: [current.stopId, nextStopId],
                        endStopId: nextStopId,
                        endIndex: i
                    });
                } else {
                    const lastSegment = newPath[newPath.length - 1];
                    lastSegment.stops.push(nextStopId);
                    lastSegment.endStopId = nextStopId;
                    lastSegment.endIndex = i;
                }
                
                queue.push({
                    stopId: nextStopId,
                    path: newPath,
                    transfers: current.transfers + (isTransfer ? 1 : 0)
                });
            }
        }
    }

    console.log('BFS tamamlandı, rota bulunamadı');
    return null;
}

/**
 * Rota sonucunu oluşturur
 */
function buildRouteResult(pathSegments, startStopId, endStopId, routes) {
    if (pathSegments.length === 0) return null;
    
    let totalStops = 0;
    const transferCount = pathSegments.length - 1;
    
    let routeType;
    if (transferCount === 0) {
        routeType = 'direct';
    } else if (transferCount === 1) {
        routeType = 'transfer';
    } else {
        routeType = 'multi_transfer';
    }

    const processedRoutes = pathSegments.map(segment => {
        const fullRouteStops = routes[segment.routeKey];
        
        if (fullRouteStops) {
            const startIdx = segment.startIndex;
            const endIdx = segment.endIndex;
            const allStopsInSegment = fullRouteStops.slice(startIdx, endIdx + 1);
            
            totalStops += allStopsInSegment.length - 1;
            
            console.log(`Hat ${segment.routeNumber}: ${allStopsInSegment.length} durak (${startIdx} → ${endIdx})`);
            
            return {
                type: 'segment',
                routeNumber: segment.routeNumber,
                routeKey: segment.routeKey,
                stops: allStopsInSegment,
                startIdx: startIdx,
                endIdx: endIdx
            };
        }
        
        return {
            type: 'segment',
            routeNumber: segment.routeNumber,
            routeKey: segment.routeKey,
            stops: segment.stops,
            startIdx: segment.startIndex,
            endIdx: segment.endIndex
        };
    });

    totalStops = processedRoutes.reduce((sum, route) => sum + route.stops.length, 0) - transferCount;

    const result = {
        type: routeType,
        totalStops: totalStops,
        transferCount: transferCount,
        routes: processedRoutes
    };

    if (transferCount > 0) {
        result.transferStops = [];
        for (let i = 0; i < pathSegments.length - 1; i++) {
            result.transferStops.push(pathSegments[i].endStopId);
        }
    }

    console.log(`Rota oluşturuldu: ${transferCount} aktarma, ${totalStops} toplam durak, ${processedRoutes.map(r => r.stops.length).join('+')} detay durak`);
    return result;
}

/**
 * Rotayı haritada görüntüler
 */
function displayRouteOnMap(routeData, startStopCandidate, endStopCandidate, stops, map, routeMarkers, routeLines) {
    routeMarkers.forEach(marker => map.removeLayer(marker));
    routeLines.forEach(line => map.removeLayer(line));
    routeMarkers.length = 0;
    routeLines.length = 0;

    if (!routeData || routeData.type === 'same_stop') return;

    const startStop = startStopCandidate.stop;
    const endStop = endStopCandidate.stop;

    const colors = ['var(--primary-color)', 'var(--accent-color)', 'var(--success-color)', 'var(--warning-color)', '#6f42c1', '#fd7e14'];
    
    routeData.routes.forEach((route, routeIdx) => {
        if (route.type === 'walk') {
            // Yürüyüş Rotası (Kesik Çizgi)
            const fromStop = stops.find(s => s.stopId === route.from);
            const toStop = stops.find(s => s.stopId === route.to);
            if (fromStop && toStop) {
                const walkCoords = [
                    [parseFloat(fromStop.lat), parseFloat(fromStop.lng)],
                    [parseFloat(toStop.lat), parseFloat(toStop.lng)]
                ];
                const walkLine = L.polyline(walkCoords, {
                    color: 'var(--warning-color)',
                    weight: 4,
                    opacity: 0.9,
                    dashArray: '5, 8' // Kesik çizgi deseni
                }).addTo(map);
                routeLines.push(walkLine);
            }
        } 
        else {
            // Otobüs Rotası
            const routeStops = route.stops.map(stopId => {
                const stop = stops.find(s => s.stopId === stopId);
                return stop ? [parseFloat(stop.lat), parseFloat(stop.lng)] : null;
            }).filter(coord => coord !== null);

            if (routeStops.length > 1) {
                const line = L.polyline(routeStops, {
                    color: colors[routeIdx % colors.length],
                    weight: 5,
                    opacity: 0.8
                }).addTo(map);
                routeLines.push(line);
            }

            route.stops.forEach((stopId, idx) => {
                const stop = stops.find(s => s.stopId === stopId);
                if (!stop) return;

                let markerIcon, popupText;
                const isStartStop = stopId === startStop.stopId;
                const isEndStop = stopId === endStop.stopId;
                
                if (isStartStop) {
                    markerIcon = L.divIcon({
                        className: 'start-stop-marker',
                        html: '<div style="background: var(--success-color); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: var(--shadow-lg);">B</div>',
                        iconSize: [32, 32]
                    });
                    popupText = `<b>🚩 Başlangıç:</b> ${stop.stopName}<br><small>Hat ${route.routeNumber} - ${Math.round(startStopCandidate.distance)}m uzaklıkta</small>`;
                } else if (isEndStop) {
                    markerIcon = L.divIcon({
                        className: 'end-stop-marker',
                        html: '<div style="background: var(--danger-color); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: var(--shadow-lg);">S</div>',
                        iconSize: [32, 32]
                    });
                    popupText = `<b>🏁 Bitiş:</b> ${stop.stopName}<br><small>Hat ${route.routeNumber} - ${Math.round(endStopCandidate.distance)}m uzaklıkta</small>`;
                } else if (idx === 0 || idx === route.stops.length - 1) {
                    markerIcon = L.divIcon({
                        className: 'transfer-stop-marker',
                        html: '<div style="background: var(--warning-color); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white; box-shadow: var(--shadow);">A</div>',
                        iconSize: [28, 28]
                    });
                    popupText = `<b>🔄 Aktarma/Biniş:</b> ${stop.stopName}<br><small>Hat ${route.routeNumber}</small>`;
                } else {
                    markerIcon = L.divIcon({
                        className: 'intermediate-stop-marker',
                        html: `<div style="background: ${colors[routeIdx % colors.length]}; color: white; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; border: 2px solid white; box-shadow: var(--shadow-sm); cursor: pointer;" title="${stop.stopName}">${idx + 1}</div>`,
                        iconSize: [18, 18]
                    });
                    popupText = `<b>🚌 ${stop.stopName}</b><br><small>Hat ${route.routeNumber} - ${idx + 1}. durak</small>`;
                }

                const stopMarker = L.marker([parseFloat(stop.lat), parseFloat(stop.lng)], {
                    icon: markerIcon
                }).addTo(map).bindPopup(popupText);
                
                routeMarkers.push(stopMarker);
            });
        }
    });

    routeData.routes.forEach((route, routeIdx) => {
        if (route.type !== 'walk' && route.stops && route.stops.length > 1) {
            const firstStop = stops.find(s => s.stopId === route.stops[0]);
            const lastStop = stops.find(s => s.stopId === route.stops[route.stops.length - 1]);
            
            if (firstStop && lastStop) {
                const midLat = (parseFloat(firstStop.lat) + parseFloat(lastStop.lat)) / 2;
                const midLng = (parseFloat(firstStop.lng) + parseFloat(lastStop.lng)) / 2;
                
                const routeLabel = L.marker([midLat, midLng], {
                    icon: L.divIcon({
                        className: 'route-label',
                        html: `<div style="background: ${colors[routeIdx % colors.length]}; color: white; padding: 4px 8px; border-radius: var(--radius); font-size: 11px; font-weight: bold; border: 2px solid white; box-shadow: var(--shadow); white-space: nowrap;">Hat ${route.routeNumber}</div>`,
                        iconSize: [60, 20]
                    })
                }).addTo(map);
                
                routeMarkers.push(routeLabel);
            }
        }
    });

    const allCoords = [];
    routeMarkers.forEach(marker => {
        allCoords.push(marker.getLatLng());
    });
    
    if (allCoords.length > 0) {
        const group = new L.featureGroup(routeMarkers.concat(routeLines));
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

/**
 * HTML sonuç şablonları
 */
function createSameStopResult() {
    return `
        <div style="background: var(--card-background); border-radius: var(--radius); padding: 24px; margin-top: 16px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-light); text-align: center;">
            <div style="width: 64px; height: 64px; background: var(--success-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                <i class="fas fa-walking" style="font-size: 2rem; color: var(--success-color);"></i>
            </div>
            <h3 style="margin: 0 0 8px 0; color: var(--text-primary); font-size: 1.2rem;">Kısa Mesafe</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0 0 16px 0; line-height: 1.4;">
                Seçtiğiniz noktalar birbirine çok yakın (Aynı durak bölgesinde). Otobüs kullanmanıza gerek yok.
            </p>
            <div style="background: var(--background-soft); padding: 10px; border-radius: var(--radius); font-size: 0.85rem; color: var(--text-muted);">
                Kısa bir yürüyüş ile hedefinize kolayca ulaşabilirsiniz.
            </div>
        </div>
    `;
}

function createSelectedPointsInfo(startStop, endStop) {
    return `
        <div class="section-title">📍 Seçilen Konumlar</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div class="info-item" style="border-left-color: var(--success-color); background: var(--success-light);">
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="background: var(--success-color); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 8px; font-size: 12px;">B</div>
                    <strong style="color: var(--success-color);">Başlangıç</strong>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">${startStop.stop.stopName}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                    <i class="fas fa-walking"></i> ${Math.round(startStop.distance)}m uzaklık
                </div>
            </div>
            <div class="info-item" style="border-left-color: var(--danger-color); background: var(--danger-light);">
                <div style="display: flex; align-items: center; margin-bottom: 6px;">
                    <div style="background: var(--danger-color); color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 8px; font-size: 12px;">S</div>
                    <strong style="color: var(--danger-color);">Bitiş</strong>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">${endStop.stop.stopName}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                    <i class="fas fa-walking"></i> ${Math.round(endStop.distance)}m uzaklık
                </div>
            </div>
        </div>
    `;
}

function createDirectRouteResult(route, routeData, alternatives, makeRouteNumberClickable) {
    let result = `
        <div class="info-item" style="border-left-color: var(--success-color); background: linear-gradient(135deg, var(--success-light) 0%, var(--card-background) 100%);">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <i class="fas fa-bus" style="color: var(--success-color); font-size: 1.2rem; margin-right: 8px;"></i>
                <strong style="color: var(--success-color); font-size: 1rem;">Direkt Rota</strong>
                <span style="background: var(--success-color); color: white; border-radius: var(--radius-sm); padding: 2px 6px; font-size: 0.75rem; font-weight: bold; margin-left: 8px;">Aktarmasız</span>
            </div>
            
            <!-- Ana rota bilgisi -->
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <div style="background: var(--success-color); color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 16px; box-shadow: var(--shadow-lg);">
                    <i class="fas fa-route" style="font-size: 1rem;"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 1.1rem; margin-bottom: 4px;">
                        ${makeRouteNumberClickable(route.routeNumber, routeData.routes[0].routeKey || `${route.routeNumber}_0`)}
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        <i class="fas fa-arrow-right" style="color: var(--success-color); margin-right: 6px;"></i>
                        Tek hat ile direkt ulaşım
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                        <i class="fas fa-list-ol" style="margin-right: 4px;"></i>
                        Toplam ${routeData.totalStops} durak
                    </div>
                </div>
            </div>
    `;
    
    if (alternatives.length > 0) {
        result += `
            <div style="background: linear-gradient(135deg, var(--background-soft) 0%, rgba(226, 232, 240, 0.3) 100%); padding: 12px; border-radius: var(--radius); border: 1px solid var(--border-light); margin-top: 12px;">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <i class="fas fa-route" style="color: var(--primary-color); margin-right: 8px;"></i>
                    <strong style="color: var(--primary-color); font-size: 0.9rem;">Alternatif Hatlar</strong>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 8px;">Bu güzergahta çalışan diğer hatlar:</div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        `;
        
        alternatives.forEach(alt => {
            result += `
                <div style="background: var(--card-background); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 6px 10px; box-shadow: var(--shadow-sm); display: flex; align-items: center;">
                    <i class="fas fa-bus" style="color: var(--primary-color); font-size: 0.8rem; margin-right: 6px;"></i>
                    <strong style="color: var(--primary-color); font-size: 0.85rem;">${makeRouteNumberClickable(alt.routeNumber, alt.routeKey)}</strong>
                    <span style="color: var(--text-muted); margin-left: 6px; font-size: 0.75rem;">(${alt.stopCount} durak)</span>
                </div>
            `;
        });
        
        result += `</div></div>`;
    }
    
    result += `
            <div style="background: linear-gradient(135deg, var(--success-color) 0%, #22c55e 100%); color: white; padding: 12px; border-radius: var(--radius); margin-top: 16px; text-align: center;">
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 4px;">
                    <i class="fas fa-check-circle" style="margin-right: 8px; font-size: 1.1rem;"></i>
                    <span style="font-weight: bold;">En Kolay Rota!</span>
                </div>
                <div style="font-size: 0.85rem; opacity: 0.9;">Aktarma yapmadan hedefinize ulaşacaksınız</div>
            </div>
        </div>
    `;
    
    return result;
}

function createTransferRouteResult(route1, route2, transferStop, routeData, alternatives1, alternatives2, makeRouteNumberClickable) {
    let result = `
        <div class="info-item" style="border-left-color: var(--warning-color); background: linear-gradient(135deg, var(--card-background) 0%, var(--background-secondary) 100%);">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <i class="fas fa-exchange-alt" style="color: var(--warning-color); font-size: 1.1rem; margin-right: 8px;"></i>
                <strong style="color: var(--warning-color); font-size: 1rem;">Aktarmalı Rota</strong>
                <span style="background: var(--warning-color); color: white; border-radius: var(--radius-sm); padding: 2px 6px; font-size: 0.75rem; font-weight: bold; margin-left: 8px;">1 Aktarma</span>
            </div>
            
            <div style="display: flex; margin-bottom: 12px; position: relative;">
                <div style="background: var(--primary-color); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; box-shadow: var(--shadow); z-index: 2;">1</div>
                <div style="flex: 1; background: var(--background-soft); padding: 10px 12px; border-radius: var(--radius); border: 1px solid var(--border-light);">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                        <i class="fas fa-bus" style="color: var(--primary-color); margin-right: 6px;"></i>
                        ${makeRouteNumberClickable(route1.routeNumber, routeData.routes[0].routeKey || `${route1.routeNumber}_0`)} ile başlayın
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">
                        <i class="fas fa-arrow-right" style="margin-right: 4px;"></i>
                        <strong style="color: var(--warning-color);">${transferStop.stopName}</strong> durağına gidin
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        <i class="fas fa-list-ol" style="margin-right: 4px;"></i>
                        ${route1.stops.length} durak
    `;
    
    if (alternatives1.length > 0) {
        result += `
                        <span style="margin-left: 8px; color: var(--success-color); font-weight: 500;">
                            | Alternatifler: ${alternatives1.map(alt => makeRouteNumberClickable(alt.routeNumber, alt.routeKey).replace('Hat ', '')).join(', ')}
                        </span>
        `;
    }
    
    result += `
                    </div>
                </div>
                <div style="position: absolute; left: 15px; top: 32px; width: 2px; height: 20px; background: var(--border-accent);"></div>
            </div>
            
            <div style="display: flex; margin-bottom: 12px; position: relative;">
                <div style="background: var(--warning-color); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; box-shadow: var(--shadow); z-index: 2;">A</div>
                <div style="flex: 1; background: linear-gradient(135deg, var(--warning-light) 0%, rgba(245, 158, 11, 0.05) 100%); padding: 10px 12px; border-radius: var(--radius); border: 1px solid var(--warning-border);">
                    <div style="font-weight: 600; color: var(--warning-color); margin-bottom: 4px;">
                        <i class="fas fa-exchange-alt" style="margin-right: 6px;"></i>
                        Aktarma Noktası
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        <strong style="color: var(--warning-color);">${transferStop.stopName}</strong> durağında <strong>${makeRouteNumberClickable(route2.routeNumber, routeData.routes[1].routeKey || `${route2.routeNumber}_0`)}</strong> numaralı hatta geçin
                    </div>
                </div>
                <!-- Bağlantı çizgisi -->
                <div style="position: absolute; left: 15px; top: 32px; width: 2px; height: 20px; background: var(--border-accent);"></div>
            </div>
            
            <div style="display: flex; margin-bottom: 12px;">
                <div style="background: var(--primary-color); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; box-shadow: var(--shadow);">2</div>
                <div style="flex: 1; background: var(--background-soft); padding: 10px 12px; border-radius: var(--radius); border: 1px solid var(--border-light);">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
                        <i class="fas fa-bus" style="color: var(--primary-color); margin-right: 6px;"></i>
                        ${makeRouteNumberClickable(route2.routeNumber, routeData.routes[1].routeKey || `${route2.routeNumber}_0`)} ile hedefinize ulaşın
                    </div>
                    <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">
                        <i class="fas fa-flag-checkered" style="margin-right: 4px; color: var(--success-color);"></i>
                        Son durak hedefiniz
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        <i class="fas fa-list-ol" style="margin-right: 4px;"></i>
                        ${route2.stops.length} durak
    `;
    
    if (alternatives2.length > 0) {
        result += `
                        <span style="margin-left: 8px; color: var(--success-color); font-weight: 500;">
                            | Alternatifler: ${alternatives2.map(alt => makeRouteNumberClickable(alt.routeNumber, alt.routeKey).replace('Hat ', '')).join(', ')}
                        </span>
        `;
    }
    
    result += `
                    </div>
                </div>
            </div>
            
            <div style="background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-light) 100%); color: white; padding: 10px 12px; border-radius: var(--radius); margin-top: 12px; text-align: center;">
                <div style="font-weight: bold; margin-bottom: 2px;">
                    <i class="fas fa-calculator" style="margin-right: 6px;"></i>
                    Toplam ${routeData.totalStops} Durak
                </div>
                <div style="font-size: 0.8rem; opacity: 0.9;">1 aktarma ile hedefinize ulaşacaksınız</div>
            </div>
        </div>
    `;
    
    return result;
}

function createMultiTransferRouteResult(routeData, stops, routes, makeRouteNumberClickable) {
    let result = `
        <div class="info-item" style="border-left-color: var(--accent-color); background: linear-gradient(135deg, var(--card-background) 0%, var(--background-secondary) 100%);">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
                <i class="fas fa-project-diagram" style="color: var(--accent-color); font-size: 1.1rem; margin-right: 8px;"></i>
                <strong style="color: var(--accent-color); font-size: 1rem;">Çoklu Aktarmalı Rota</strong>
                <span style="background: var(--accent-color); color: white; border-radius: var(--radius-sm); padding: 2px 6px; font-size: 0.75rem; font-weight: bold; margin-left: 8px;">${routeData.transferCount} Aktarma</span>
            </div>
    `;
    
    routeData.routes.forEach((route, idx) => {
        const stepNum = idx + 1;
        const isLast = idx === routeData.routes.length - 1;
        
        const segmentStartId = route.stops[0];
        const segmentEndId = route.stops[route.stops.length - 1];
        
        const alternatives = findAlternativeRoutes(
            segmentStartId,
            segmentEndId,
            route.routeNumber,
            routes
        );
        
        result += `
            <div style="display: flex; margin-bottom: 12px; position: relative;">
                <div style="background: var(--accent-color); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; box-shadow: var(--shadow); z-index: 2; font-size: 0.9rem;">${stepNum}</div>
                <div style="flex: 1; background: var(--background-soft); padding: 10px 12px; border-radius: var(--radius); border: 1px solid var(--border-light);">
                    <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 0.9rem;">
                        <i class="fas fa-bus" style="color: var(--accent-color); margin-right: 6px;"></i>
                        ${makeRouteNumberClickable(route.routeNumber, routeData.routes[idx].routeKey || `${route.routeNumber}_0`)} ${isLast ? '- Hedefe ulaşın' : '- Aktarma durağına gidin'}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">
                        <i class="fas fa-list-ol" style="margin-right: 4px;"></i>
                        ${route.stops.length} durak
        `;
        
        if (alternatives.length > 0) {
            result += `
                        <span style="margin-left: 8px; color: var(--success-color); font-weight: 500; font-size: 0.75rem;">
                            | Alt: ${alternatives.slice(0, 2).map(alt => makeRouteNumberClickable(alt.routeNumber, alt.routeKey).replace('Hat ', '')).join(', ')}
                        </span>
            `;
        }
        
        result += `</div></div>`;
        
        if (!isLast) {
            result += `<div style="position: absolute; left: 14px; top: 30px; width: 2px; height: 16px; background: var(--border-accent);"></div>`;
        }
        
        result += `</div>`;
        
        if (!isLast && routeData.transferStops && routeData.transferStops[idx]) {
            const transferStop = stops.find(s => s.stopId === routeData.transferStops[idx]);
            result += `
                <div style="display: flex; margin-bottom: 12px; position: relative;">
                    <div style="background: var(--warning-color); color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 12px; box-shadow: var(--shadow); z-index: 2; font-size: 0.8rem;">A</div>
                    <div style="flex: 1; background: var(--warning-light); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--warning-border);">
                        <div style="font-weight: 500; color: var(--warning-color); font-size: 0.85rem;">
                            <i class="fas fa-exchange-alt" style="margin-right: 6px;"></i>
                            ${transferStop.stopName} - Aktarma
                        </div>
                    </div>
                    ${idx < routeData.routes.length - 2 ? `<div style="position: absolute; left: 14px; top: 30px; width: 2px; height: 16px; background: var(--border-accent);"></div>` : ''}
                </div>
            `;
        }
    });
    
    result += `
        <div style="background: var(--card-background); border-radius: var(--radius); padding: 12px; margin-top: 16px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-light); display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--success-color);"></div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Başlangıç</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--danger-color);"></div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Bitiş</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--warning-color);"></div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Aktarma</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 16px; height: 2px; background: var(--warning-color); border-bottom: 2px dashed white;"></div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Yürüyüş</span>
            </div>
        </div>
    `;
    
    return result;
}

function createMapLegend(routeData) {
    return `
        <div style="background: var(--card-background); border-radius: var(--radius); padding: 12px; margin-top: 16px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-light); display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--success-color);"></div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Başlangıç</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--danger-color);"></div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Bitiş</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: var(--warning-color);"></div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Aktarma</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="width: 16px; height: 2px; background: var(--warning-color); border-bottom: 2px dashed white;"></div>
                <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 500;">Yürüyüş</span>
            </div>
        </div>
    `;
}

function createNoRouteFoundResult(startNearest, endNearest) {
    return `
        <div style="background: var(--card-background); border-radius: var(--radius); padding: 24px; margin-top: 16px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-light); text-align: center;">
            <div style="width: 64px; height: 64px; background: var(--danger-light); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                <i class="fas fa-route" style="font-size: 2rem; color: var(--danger-color); opacity: 0.7;"></i>
            </div>
            <h3 style="margin: 0 0 8px 0; color: var(--text-primary); font-size: 1.1rem;">Rota Bulunamadı</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; margin: 0; line-height: 1.4;">
                Seçtiğiniz noktalar arasında uygun bir toplu taşıma bağlantısı bulunmuyor. Farklı konumlar deneyebilirsiniz.
            </p>
        </div>
    `;
}

/**
 * ========================================================
 * Gelişmiş Yürüme Mesafeli Dijkstra Algoritması (V2)
 * ========================================================
 */

class MinHeap {
    constructor() { this.heap = []; }
    push(val) {
        this.heap.push(val);
        this.bubbleUp(this.heap.length - 1);
    }
    pop() {
        if(this.heap.length === 1) return this.heap.pop();
        const top = this.heap[0];
        this.heap[0] = this.heap.pop();
        this.sinkDown(0);
        return top;
    }
    bubbleUp(idx) {
        while(idx > 0) {
            let p = Math.floor((idx - 1) / 2);
            if(this.heap[p].cost <= this.heap[idx].cost) break;
            [this.heap[p], this.heap[idx]] = [this.heap[idx], this.heap[p]];
            idx = p;
        }
    }
    sinkDown(idx) {
        while(true) {
            let left = 2*idx + 1, right = 2*idx + 2, smallest = idx;
            if(left < this.heap.length && this.heap[left].cost < this.heap[smallest].cost) smallest = left;
            if(right < this.heap.length && this.heap[right].cost < this.heap[smallest].cost) smallest = right;
            if(smallest === idx) break;
            [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
            idx = smallest;
        }
    }
    isEmpty() { return this.heap.length === 0; }
}

async function findBestRouteAdvanced(startLat, startLng, endLat, endLng, stops, routes, onProgress) {
    onProgress(5, "Başlangıç hazırlıkları yapılıyor...");
    await new Promise(r => setTimeout(r, 50)); 
    
    const startStops = findNearestStops(startLat, startLng, stops, 600, 5);
    const endStops = findNearestStops(endLat, endLng, stops, 600, 5);
    
    if (startStops.length === 0 || endStops.length === 0) return null;
    
    onProgress(15, "Durak ağı haritalanıyor...");
    await new Promise(r => setTimeout(r, 50));
    
    const stopToRoutes = new Map();
    for (const [routeKey, stopList] of Object.entries(routes)) {
        stopList.forEach((stopId, index) => {
            if (!stopToRoutes.has(stopId)) stopToRoutes.set(stopId, []);
            stopToRoutes.get(stopId).push({ routeKey, index, stopList, routeNumber: routeKey.split('_')[0] });
        });
    }

    onProgress(30, "Spatio-Temporal Ağ Örülüyor (Yürüme Mesafeleri)...");
    await new Promise(r => setTimeout(r, 50));

    // Spatial Hashing for fast walking distances
    const grid = new Map();
    const getCell = (lat, lng) => `${Math.floor(lat * 100)},${Math.floor(lng * 100)}`;
    stops.forEach(stop => {
        const cell = getCell(parseFloat(stop.lat), parseFloat(stop.lng));
        if (!grid.has(cell)) grid.set(cell, []);
        grid.get(cell).push(stop);
    });

    const getNearbyStops = (lat, lng, maxDist) => {
        const cLat = Math.floor(lat * 100);
        const cLng = Math.floor(lng * 100);
        const nearby = [];
        for(let i = -1; i <= 1; i++) {
            for(let j = -1; j <= 1; j++) {
                const cell = `${cLat + i},${cLng + j}`;
                if (grid.has(cell)) {
                    grid.get(cell).forEach(s => {
                        const dist = getDistance(lat, lng, parseFloat(s.lat), parseFloat(s.lng));
                        if (dist > 0 && dist <= maxDist) nearby.push({stop: s, distance: dist});
                    });
                }
            }
        }
        return nearby;
    };

    onProgress(45, "Aktarma senaryoları (Dijkstra) taranıyor...");
    await new Promise(r => setTimeout(r, 50));

    const maxTransfers = 3;
    const WALKING_SPEED_MPM = 60; // 60 metres / min
    
    const distances = new Map();
    const pq = new MinHeap();
    
    for (const ss of startStops) {
        const stopId = ss.stop.stopId;
        const walkTime = ss.distance / WALKING_SPEED_MPM;
        const stateKey = `${stopId}_WALK`;
        distances.set(stateKey, walkTime);
        pq.push({ id: stopId, routeKey: 'WALK', cost: walkTime, transfers: 0, path: [] });
    }

    let iterations = 0;
    let bestEndState = null;
    let bestTotalCost = Infinity;

    const endStopIds = new Set(endStops.map(s => s.stop.stopId));
    const endStopDetails = new Map(endStops.map(s => [s.stop.stopId, s]));

    while (!pq.isEmpty()) {
        const current = pq.pop();
        
        if (iterations++ % 8000 === 0) {
            onProgress(45 + Math.min(45, Math.floor(iterations / 4000)), `Düğümler çözülüyor (${iterations.toLocaleString()})...`);
            await new Promise(r => setTimeout(r, 0));
        }

        const stateKey = `${current.id}_${current.routeKey}`;
        if (distances.has(stateKey) && distances.get(stateKey) < current.cost) continue;

        if (endStopIds.has(current.id)) {
            const finalWalkTime = endStopDetails.get(current.id).distance / WALKING_SPEED_MPM;
            const totalCost = current.cost + finalWalkTime;
            
            if (totalCost < bestTotalCost) {
                bestTotalCost = totalCost;
                bestEndState = { ...current, finalWalkTime, finalStopId: current.id };
            }
            continue;
        }

        if (current.transfers > maxTransfers) continue;

        const neighbors = [];
        
        // 1. Continue on the same bus route
        if (current.routeKey !== 'WALK') {
            const rInfo = stopToRoutes.get(current.id)?.find(r => r.routeKey === current.routeKey);
            if (rInfo && rInfo.index + 1 < rInfo.stopList.length) {
                const nextStopId = rInfo.stopList[rInfo.index + 1];
                neighbors.push({
                    id: nextStopId,
                    routeKey: current.routeKey,
                    routeNumber: rInfo.routeNumber,
                    cost: current.cost + 2, 
                    transfers: current.transfers,
                    action: 'RIDE'
                });
            }
        }

        // 2. Board a new bus line (Transfer)
        const routesHere = stopToRoutes.get(current.id) || [];
        for (const r of routesHere) {
            if (r.routeKey !== current.routeKey) {
                neighbors.push({
                    id: current.id,
                    routeKey: r.routeKey,
                    routeNumber: r.routeNumber,
                    cost: current.cost + 6, // 6 min wait penalty
                    transfers: current.routeKey === 'WALK' ? current.transfers : current.transfers + 1,
                    action: 'BOARD'
                });
            }
        }

        // 3. Walk to nearby stops (Walking Transfer)
        if (current.routeKey !== 'WALK') {
            const currentStopObj = stops.find(s => s.stopId === current.id);
            if (currentStopObj) {
                const nearby = getNearbyStops(parseFloat(currentStopObj.lat), parseFloat(currentStopObj.lng), 350); 
                for (const n of nearby) {
                    if (n.stop.stopId !== current.id) {
                        const walkTime = n.distance / WALKING_SPEED_MPM;
                        neighbors.push({
                            id: n.stop.stopId,
                            routeKey: 'WALK',
                            routeNumber: 'Yürüyüş',
                            cost: current.cost + walkTime + 2, // +2 min mental penalty for walking
                            transfers: current.transfers, 
                            action: 'WALK',
                            walkDist: n.distance
                        });
                    }
                }
            }
        }

        for (const n of neighbors) {
            const nKey = `${n.id}_${n.routeKey}`;
            if (!distances.has(nKey) || n.cost < distances.get(nKey)) {
                distances.set(nKey, n.cost);
                
                const newPath = [...current.path, {
                    from: current.id,
                    to: n.id,
                    routeKey: n.routeKey,
                    routeNumber: n.routeNumber,
                    action: n.action,
                    walkDist: n.walkDist
                }];

                pq.push({ id: n.id, routeKey: n.routeKey, cost: n.cost, transfers: n.transfers, path: newPath });
            }
        }
    }

    onProgress(95, "En iyi rota derleniyor...");
    await new Promise(r => setTimeout(r, 50));

    if (!bestEndState) return null;

    const processedRoutes = [];
    let currentSegment = null;
    let actualTransfers = 0;

    for (const step of bestEndState.path) {
        if (step.action === 'BOARD') {
            if (currentSegment) processedRoutes.push(currentSegment);
            currentSegment = {
                type: 'segment',
                routeKey: step.routeKey,
                routeNumber: step.routeNumber,
                stops: [step.from]
            };
            if (processedRoutes.length > 0 && processedRoutes[processedRoutes.length-1].type === 'segment') {
                actualTransfers++;
            }
        } else if (step.action === 'RIDE') {
            if (currentSegment) currentSegment.stops.push(step.to);
        } else if (step.action === 'WALK') {
            if (currentSegment) {
                processedRoutes.push(currentSegment);
                currentSegment = null;
                actualTransfers++;
            }
            processedRoutes.push({
                type: 'walk',
                from: step.from,
                to: step.to,
                distance: Math.round(step.walkDist)
            });
        }
    }
    if (currentSegment) processedRoutes.push(currentSegment);

    const finalRoutes = processedRoutes.filter(r => r.type === 'walk' || r.stops.length > 1);

    if (finalRoutes.length === 0) return { type: 'same_stop', message: 'Çok yakın.' };

    const firstStopId = finalRoutes[0].type === 'walk' ? finalRoutes[0].from : finalRoutes[0].stops[0];
    const lastSeg = finalRoutes[finalRoutes.length-1];
    const finalStopId = lastSeg.type === 'walk' ? lastSeg.to : lastSeg.stops[lastSeg.stops.length-1];

    const startStopDetails = startStops.find(s => s.stop.stopId === firstStopId) || startStops[0];
    const endStopDetails2 = endStops.find(s => s.stop.stopId === finalStopId) || endStops[0];

    let routeType = 'advanced';
    
    let totalStopsCount = 0;
    finalRoutes.forEach(r => {
        if (r.type === 'segment') totalStopsCount += (r.stops.length - 1);
    });

    const routeData = {
        type: routeType,
        totalStops: totalStopsCount,
        transferCount: actualTransfers,
        routes: finalRoutes
    };

    onProgress(100, "Rota hazır!");
    await new Promise(r => setTimeout(r, 100));

    return {
        route: routeData,
        startStop: startStopDetails,
        endStop: endStopDetails2,
        score: bestTotalCost
    };
}

/**
 * Gelişmiş Rota HTML Çıktısı (Yürüyüş ve Otobüs karışık)
 */
function createAdvancedRouteResult(routeData, stops, routes, makeRouteNumberClickable) {
    let result = `
        <div style="background: var(--card-background); border-radius: var(--radius); padding: 16px; margin-top: 16px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-light);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                <div style="display: flex; align-items: center;">
                    <i class="fas fa-brain" style="color: var(--primary-color); font-size: 1.2rem; margin-right: 10px;"></i>
                    <h3 style="margin: 0; color: var(--text-primary); font-size: 1.1rem; font-weight: 600;">Akıllı Rota</h3>
                </div>
                <div style="background: var(--background-soft); color: var(--text-secondary); padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600;">
                    ${routeData.transferCount} Aktarma
                </div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 0; position: relative;">
                <!-- Dikey bağlantı çizgisi -->
                <div style="position: absolute; left: 15px; top: 20px; bottom: 20px; width: 2px; background: var(--border-light); z-index: 1;"></div>
    `;
    
    routeData.routes.forEach((segment, idx) => {
        const isLast = idx === routeData.routes.length - 1;
        
        if (segment.type === 'segment') {
            const alternatives = findAlternativeRoutes(segment.stops[0], segment.stops[segment.stops.length-1], segment.routeNumber, routes);
            
            let altHtml = '';
            if (alternatives.length > 0) {
                altHtml = `
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border-light);">
                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Alternatif Hatlar</div>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            ${alternatives.slice(0, 3).map(alt => `
                                <div style="background: var(--background-soft); border: 1px solid var(--border-light); border-radius: 4px; padding: 3px 8px; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary);">
                                    ${makeRouteNumberClickable(alt.routeNumber, alt.routeKey).replace('Hat ', '')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            result += `
                <div style="display: flex; align-items: flex-start; position: relative; z-index: 2; margin-bottom: ${isLast ? '0' : '20px'};">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--card-background); border: 2px solid var(--primary-color); display: flex; align-items: center; justify-content: center; margin-right: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <i class="fas fa-bus" style="color: var(--primary-color); font-size: 0.8rem;"></i>
                    </div>
                    <div style="flex: 1; background: var(--card-background); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <div style="font-size: 1rem; font-weight: 600; color: var(--primary-color);">
                                ${makeRouteNumberClickable(segment.routeNumber, segment.routeKey)}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                                <i class="fas fa-chevron-right"></i> ${segment.stops.length} durak
                            </div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">
                            Bin: <b>${stops.find(s => s.stopId === segment.stops[0])?.stopName || 'Durak'}</b><br>
                            İn: <b>${stops.find(s => s.stopId === segment.stops[segment.stops.length-1])?.stopName || 'Durak'}</b>
                        </div>
                        ${altHtml}
                    </div>
                </div>
            `;
        } 
        else if (segment.type === 'walk') {
            const stopTo = stops.find(s => s.stopId === segment.to);
            result += `
                <div style="display: flex; align-items: center; position: relative; z-index: 2; margin-bottom: ${isLast ? '0' : '20px'};">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--background-soft); display: flex; align-items: center; justify-content: center; margin-right: 12px;">
                        <i class="fas fa-walking" style="color: var(--text-secondary); font-size: 0.9rem;"></i>
                    </div>
                    <div style="flex: 1; padding: 8px 0;">
                        <div style="font-size: 0.85rem; color: var(--text-secondary); font-weight: 500;">
                            <b>${segment.distance}m yürü</b> ${stopTo ? `(Hedef: ${stopTo.stopName})` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    result += `
            </div>
            
            <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fas fa-flag-checkered" style="color: var(--success-color);"></i>
                    <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">Toplam ${routeData.totalStops} Durak</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">
                    Yapay Zeka Destekli Rota
                </div>
            </div>
        </div>
    `;
    return result;
}