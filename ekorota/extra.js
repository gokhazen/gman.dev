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
  window.location.href = 'https://gman.dev/ekoarama/';
}

function redirectToStop(stopId) {
  const currentUrl = window.location.href;
  const regionMatch = currentUrl.match(/[?&]region=([^&#]*)/);
  let redirectUrl = "https://gman.dev/ekostop/?";
  if (regionMatch) {
    const region = regionMatch[1];
    redirectUrl += `region=${region}&`;
  }
  redirectUrl += `stop=${stopId}&back=${encodeURIComponent(currentUrl)}`;
  window.location.href = redirectUrl;
}

// Saat tablosu işlevleri
function generateScheduleDisplay(scheduleList) {
  const dayLabels = ["Hafta İçi", "Cumartesi", "Pazar"];
  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Tab butonları - minimal
  const tabButtons = scheduleList
    .map((schedule, index) => {
      const label = dayLabels[index] || schedule.description;
      const activeClass = index === window.activeScheduleTab ? 'active' : '';
      return `<button class="tab-btn ${activeClass}" data-tab="${index}">${label}</button>`;
    })
    .join('');

  // Tab panelleri
  const tabPanels = scheduleList
    .map((schedule, index) => {
      const label = dayLabels[index] || schedule.description;
      let timesHtml = '';
      let addedCurrentTimeIndicator = false;
      let startIndex = 0;
      let endIndex = schedule.timeList.length;

      // Bugünkü tarifeyi kontrol et
      const today = new Date();
      const dayOfWeek = today.getDay();
      let isCurrentDaySchedule = false;

      if (dayOfWeek >= 1 && dayOfWeek <= 5 && index === 0) { // Hafta içi
        isCurrentDaySchedule = true;
      } else if (dayOfWeek === 6 && index === 1) { // Cumartesi
        isCurrentDaySchedule = true;
      } else if (dayOfWeek === 0 && index === 2) { // Pazar
        isCurrentDaySchedule = true;
      }

      // Sadece bugünkü tarifeyi daralt/genişlet
      if (isCurrentDaySchedule && !window.expandedScheduleState[index]) {
        let currentIndex = -1;
        for (let i = 0; i < schedule.timeList.length; i++) {
          const [departureHour, departureMinute] = schedule.timeList[i].departureTime.split(':').map(Number);
          if (departureHour > currentHour || (departureHour === currentHour && departureMinute >= currentMinute)) {
            currentIndex = i;
            break;
          }
        }

        if (currentIndex === -1) {
          startIndex = Math.max(0, schedule.timeList.length - 5);
          endIndex = schedule.timeList.length;
        } else {
          startIndex = Math.max(0, currentIndex - 2);
          endIndex = Math.min(schedule.timeList.length, currentIndex + 3);
        }
      }

      // Yukarı genişletme butonu - minimal
      if (isCurrentDaySchedule && startIndex > 0 && !window.expandedScheduleState[index]) {
        timesHtml += `
          <div class="expand-btn-wrapper">
            <button class="expand-btn" data-action="expand-up" data-tab="${index}">
              ↑ Önceki seferler
            </button>
          </div>`;
      }

      // Saat listesi
      for (let i = startIndex; i < endIndex; i++) {
        const time = schedule.timeList[i];
        const [departureHour, departureMinute] = time.departureTime.split(':').map(Number);
        const isPast = (departureHour < currentHour) || (departureHour === currentHour && departureMinute < currentMinute);

        // Şu anki saat göstergesi
        if (isCurrentDaySchedule && !addedCurrentTimeIndicator && (departureHour > currentHour || (departureHour === currentHour && departureMinute >= currentMinute))) {
          timesHtml += `
            <div class="time-item current-time">
              <span class="time-display">Şu An: ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}</span>
              <span class="time-badge live">Canlı</span>
            </div>`;
          addedCurrentTimeIndicator = true;
        }

        // Sefer saati
        const statusClass = isPast && isCurrentDaySchedule ? 'missed' : 'upcoming';
        const statusText = isPast && isCurrentDaySchedule ? 'Geçti' : label;
        
        timesHtml += `
          <div class="time-item ${statusClass}">
            <span class="time-display">${time.departureTime}</span>
            <span class="time-badge">${statusText}</span>
          </div>`;
      }

      // Eğer şu anki saat göstergesi eklenmemişse en sona ekle
      if (isCurrentDaySchedule && !addedCurrentTimeIndicator) {
        timesHtml += `
          <div class="time-item current-time">
            <span class="time-display">Şu An: ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}</span>
            <span class="time-badge live">Canlı</span>
          </div>`;
      }

      // Aşağı genişletme/daraltma butonu - minimal
      if (isCurrentDaySchedule) {
        if (window.expandedScheduleState[index]) {
          timesHtml += `
            <div class="expand-btn-wrapper">
              <button class="expand-btn" data-action="collapse" data-tab="${index}">
                ↑ Daralt
              </button>
            </div>`;
        } else if (endIndex < schedule.timeList.length) {
          timesHtml += `
            <div class="expand-btn-wrapper">
              <button class="expand-btn" data-action="expand-down" data-tab="${index}">
                ↓ Sonraki seferler
              </button>
            </div>`;
        }
      }

      const activeClass = index === window.activeScheduleTab ? 'active' : '';
      return `<div class="tab-panel ${activeClass}" data-tab="${index}">${timesHtml}</div>`;
    })
    .join('');

  return `
    <div id="schedule-tabs">
      <div class="tab-buttons">${tabButtons}</div>
      <div class="tab-content">${tabPanels}</div>
    </div>`;
}

function setupScheduleTabs() {
  const tabButtons = document.querySelectorAll('#schedule-tabs .tab-btn');
  const tabPanels = document.querySelectorAll('#schedule-tabs .tab-panel');
  
  // Tab buton işlevleri
  tabButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const tabIndex = parseInt(this.getAttribute('data-tab'), 10);
      window.activeScheduleTab = tabIndex;
      
      // Aktif durumları güncelle
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      
      this.classList.add('active');
      document.querySelector(`#schedule-tabs .tab-panel[data-tab="${tabIndex}"]`).classList.add('active');

      // Scroll pozisyonunu sıfırla
      const currentPanel = document.querySelector(`#schedule-tabs .tab-panel[data-tab="${tabIndex}"]`);
      if (currentPanel) {
        currentPanel.scrollTop = 0;
      }
    });
  });

  // Genişletme/Daraltma butonları
  document.querySelectorAll('.expand-btn').forEach(button => {
    button.addEventListener('click', function() {
      const tabIndex = parseInt(this.getAttribute('data-tab'), 10);
      const action = this.getAttribute('data-action');

      if (action === 'expand-up' || action === 'expand-down') {
        window.expandedScheduleState[tabIndex] = true;
      } else if (action === 'collapse') {
        window.expandedScheduleState[tabIndex] = false;
      }

      // Tabloyu yeniden oluştur
      if (window.currentRouteCode) {
        window.fetchRouteInfo(window.currentRouteCode);
      }
    });
  });
}