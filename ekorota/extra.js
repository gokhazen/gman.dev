// ekorota/extra.js

// extra.js içerisinde kullanılacak global değişkenler ve fonksiyonlar (full.js'den erişim için)
// full.js'de tüm ilgili değişkenler ve fonksiyonlar window objesine eklendiği için,
// burada doğrudan window.degiskenAdi veya window.fonksiyonAdi() şeklinde erişebiliriz.

// *** activeScheduleTab değişkeninin başlangıç değeri ***
// Sayfa yüklendiğinde haftanın gününe göre varsayılan sekmeyi ayarla
// 0: Hafta İçi, 1: Cumartesi, 2: Pazar
if (typeof window.activeScheduleTab === 'undefined' || window.activeScheduleTab === null) {
  const today = new Date();
  const dayOfWeek = today.getDay(); // Pazar = 0, Pazartesi = 1, ..., Cumartesi = 6

  if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Pazartesi'den Cuma'ya (Hafta içi)
    window.activeScheduleTab = 0;
  } else if (dayOfWeek === 6) { // Cumartesi
    window.activeScheduleTab = 1;
  } else { // Pazar (dayOfWeek === 0)
    window.activeScheduleTab = 2;
  }
}

// *** Genişletme durumunu takip eden global değişkenler ***
window.expandedScheduleState = window.expandedScheduleState || {};

// Buton işlevleri
function goBack() {
  if (window.backLink) {
    window.location.href = window.backLink;
  }
}

function toggleDirection() {
  window.currentDirection = window.currentDirection === 0 ? 1 : 0;
  window.directionChanged = true;

  if (window.routeUpdateInterval) clearInterval(window.routeUpdateInterval);

  if (window.currentRouteCode) {
    window.fetchRouteInfo(window.currentRouteCode);

    window.routeUpdateInterval = setInterval(() => {
      if (window.currentRouteCode) {
        window.fetchRouteInfo(window.currentRouteCode);
      }
    }, 10000);
  }
}

function centerToUserLocation() {
  if (window.userLocation && window.map) {
    window.map.setView(window.userLocation, 16);
  } else {
    window.getUserLocation();
  }
}

function openSearchPage() {
  window.location.href = '../ekoarama/';
}

function redirectToStop(stopId) {
  const currentUrl = window.location.href;
  const regionMatch = currentUrl.match(/[?&]region=([^&#]*)/);
  const typeMatch = currentUrl.match(/[?&]type=([^&#]*)/);
  let redirectUrl = "../ekostop/?";
  if (regionMatch) {
    const region = regionMatch[1];
    redirectUrl += `region=${region}&`;
  }
  if (typeMatch) {
    const type = typeMatch[1];
    redirectUrl += `type=${type}&`;
  }
  redirectUrl += `stop=${stopId}&back=${encodeURIComponent(currentUrl)}`;
  window.location.href = redirectUrl;
}

// Saat tablosu işlevleri - Stabil ve Temiz Tasarım
function generateScheduleDisplay(scheduleList) {
  if (!scheduleList || scheduleList.length === 0) return '';
  
  const dayLabels = ["Hafta İçi", "Cumartesi", "Pazar"];
  const currentHour = new Date().getHours();
  const currentMinute = new Date().getMinutes();

  // Tek satır kontrol barı
  const controlItems = scheduleList.map((schedule, index) => {
    const label = dayLabels[index] || schedule.description;
    const active = index === window.activeScheduleTab ? 'active' : '';
    return `<button class="sched-chip ${active}" data-tab="${index}"><span>${label}</span></button>`;
  }).join('');

  const activeIdx = window.activeScheduleTab || 0;
  const isExpanded = window.expandedScheduleState[activeIdx];
  const expandBtn = `
    <button class="sched-inline-expand ${isExpanded ? 'is-expanded' : ''}" data-tab="${activeIdx}">
      <i class="fas ${isExpanded ? 'fa-chevron-up' : 'fa-history'}"></i>
    </button>
  `;

  // Aktif panel içeriği
  const schedule = scheduleList[activeIdx] || scheduleList[0];
  const today = new Date().getDay();
  const isToday = (activeIdx === 0 && today >= 1 && today <= 5)
               || (activeIdx === 1 && today === 6)
               || (activeIdx === 2 && today === 0);

  const hourBuckets = {};
  schedule.timeList.forEach(t => {
    const [h] = t.departureTime.split(':');
    if (!hourBuckets[h]) hourBuckets[h] = [];
    hourBuckets[h].push(t.departureTime);
  });

  const sortedHours = Object.keys(hourBuckets).sort();
  const visibleHours = isToday && !isExpanded 
    ? sortedHours.filter(h => parseInt(h) >= currentHour) 
    : sortedHours;

  let panelHtml = '';
  visibleHours.forEach(hour => {
    const mins = hourBuckets[hour];
    const hourNum = parseInt(hour);
    const isCurrentHour = isToday && hourNum === currentHour;
    const isPastHour = isToday && hourNum < currentHour;

    panelHtml += `<div class="sched-hour-row ${isPastHour ? 'past-hour' : ''} ${isCurrentHour ? 'current-hour' : ''}">
      <div class="sched-hour-label">${hour}</div>
      <div class="sched-minutes">`;
    mins.forEach(timeStr => {
      const [h, m] = timeStr.split(':').map(Number);
      const isPast = isToday && (h < currentHour || (h === currentHour && m < currentMinute));
      const isCurrent = isToday && h === currentHour && Math.abs(m - currentMinute) <= 2;
      let cls = `sched-min-pill ${isCurrent ? 'current-departure' : (isPast ? 'past-departure' : 'upcoming-departure')}`;
      panelHtml += `<span class="${cls}">${String(m).padStart(2,'0')}</span>`;
    });
    panelHtml += `</div></div>`;
  });

  if (!panelHtml) panelHtml = '<div class="sched-empty">Bu gün için seçili saat bulunmuyor.</div>';

  return `<div id="schedule-tabs" class="sched-root">
    <div class="sched-top-bar">
      <div class="sched-chips-scroll">${controlItems}</div>
      <div class="sched-actions">${expandBtn}</div>
    </div>
    <div class="sched-panel active">${panelHtml}</div>
  </div>`;
}

function setupScheduleTabs() {
  // Chip seçici
  document.querySelectorAll('#schedule-tabs .sched-chip').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabIndex = parseInt(this.getAttribute('data-tab'), 10);
      window.activeScheduleTab = tabIndex;
      if (window.currentRouteCode) window.fetchRouteInfo(window.currentRouteCode);
    });
  });

  // Genişletme/Daraltma Butonu
  document.querySelectorAll('.sched-inline-expand').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabIndex = parseInt(this.getAttribute('data-tab'), 10);
      window.expandedScheduleState[tabIndex] = !window.expandedScheduleState[tabIndex];
      if (window.currentRouteCode) window.fetchRouteInfo(window.currentRouteCode);
    });
  });
}