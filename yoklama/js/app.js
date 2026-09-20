/**
 * App.js - Yoklama Takip (Rebuilt from scratch with Lucide icons & UTF-8 fixes)
 */

let currentViewDate = new Date();
let currentScheduleDayIndex = 1; // Default to Monday

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    checkUrlForImport();
    setupNavigation();
    setupThemeToggle();
    setupModals();
    setupForms();
    setupSettings();
    setupDateNavigation();
    
    updateDateDisplay();
    renderTodayView();
    renderScheduleView(1); // Default to Monday (1) instead of current day
}

/* ==========================================================================
   DATE NAVIGATION
   ========================================================================== */
function setupDateNavigation() {
    document.getElementById('btnPrevDay').addEventListener('click', () => {
        currentViewDate.setDate(currentViewDate.getDate() - 1);
        updateDateDisplay();
        renderTodayView();
    });

    document.getElementById('btnNextDay').addEventListener('click', () => {
        currentViewDate.setDate(currentViewDate.getDate() + 1);
        updateDateDisplay();
        renderTodayView();
    });

    document.querySelectorAll('.day-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            const dayIndex = parseInt(e.currentTarget.getAttribute('data-day'));
            renderScheduleView(dayIndex);
            
            // Scroll to center the clicked pill
            const scroller = document.getElementById('scheduleWeekScroller');
            const scrollLeft = e.currentTarget.offsetLeft - (scroller.clientWidth / 2) + (e.currentTarget.clientWidth / 2);
            scroller.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        });
    });

    const datePickerContainer = document.getElementById('btnDatePicker');
    
    datePickerContainer.addEventListener('click', () => {
        pickerCurrentDate = new Date(currentViewDate);
        renderCustomDatePicker();
        document.getElementById('customDatePickerModal').classList.add('active');
    });

    document.getElementById('btnPickerPrevMonth').addEventListener('click', () => {
        pickerCurrentDate.setMonth(pickerCurrentDate.getMonth() - 1);
        renderCustomDatePicker();
    });

    document.getElementById('btnPickerNextMonth').addEventListener('click', () => {
        pickerCurrentDate.setMonth(pickerCurrentDate.getMonth() + 1);
        renderCustomDatePicker();
    });

    document.getElementById('btnPickerToday').addEventListener('click', () => {
        pickerCurrentDate = new Date();
        renderCustomDatePicker();
    });
}

let pickerCurrentDate = new Date();

function renderCustomDatePicker() {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    document.getElementById('datePickerMonthYear').textContent = `${months[pickerCurrentDate.getMonth()]} ${pickerCurrentDate.getFullYear()}`;

    const grid = document.getElementById('datePickerGrid');
    grid.innerHTML = '';

    const firstDayIndex = new Date(pickerCurrentDate.getFullYear(), pickerCurrentDate.getMonth(), 1).getDay();
    const startDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(pickerCurrentDate.getFullYear(), pickerCurrentDate.getMonth() + 1, 0).getDate();

    for (let i = 0; i < startDay; i++) {
        const div = document.createElement('div');
        grid.appendChild(div);
    }

    const today = new Date();
    
    for (let i = 1; i <= daysInMonth; i++) {
        const div = document.createElement('div');
        div.textContent = i;
        div.style.padding = '8px 4px';
        div.style.cursor = 'pointer';
        div.style.borderRadius = 'var(--radius-sm)';
        
        const isSelected = i === currentViewDate.getDate() && pickerCurrentDate.getMonth() === currentViewDate.getMonth() && pickerCurrentDate.getFullYear() === currentViewDate.getFullYear();
        const isToday = i === today.getDate() && pickerCurrentDate.getMonth() === today.getMonth() && pickerCurrentDate.getFullYear() === today.getFullYear();
        
        if (isSelected) {
            div.style.background = 'var(--primary)';
            div.style.color = '#fff';
            div.style.fontWeight = 'bold';
        } else if (isToday) {
            div.style.border = '1px solid var(--primary)';
            div.style.color = 'var(--primary)';
            div.style.fontWeight = 'bold';
        } else {
            div.style.color = 'var(--text-main)';
        }

        div.addEventListener('mouseover', () => { if(!isSelected) div.style.background = 'var(--bg-base)'; });
        div.addEventListener('mouseout', () => { if(!isSelected) div.style.background = 'transparent'; });

        div.onclick = () => {
            currentViewDate = new Date(pickerCurrentDate.getFullYear(), pickerCurrentDate.getMonth(), i);
            document.getElementById('customDatePickerModal').classList.remove('active');
            updateDateDisplay();
            renderTodayView();
        };

        grid.appendChild(div);
    }
}

function updateDateDisplay() {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    let displayStr = `${currentViewDate.getDate()} ${months[currentViewDate.getMonth()]} ${currentViewDate.getFullYear()}`;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    const viewDate = new Date(currentViewDate);
    viewDate.setHours(0,0,0,0);
    
    const diffTime = viewDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        displayStr += " (Bugün)";
    } else if (diffDays === 1) {
        displayStr += " (Yarın)";
    } else if (diffDays === -1) {
        displayStr += " (Dün)";
    }
    
    document.getElementById('currentDay').textContent = days[currentViewDate.getDay()];
    document.getElementById('currentDate').textContent = displayStr;
}

/* ==========================================================================
   ROUTING & NAVIGATION
   ========================================================================== */
function setupNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    const views = document.querySelectorAll('.view');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'view-today') {
                document.getElementById('pageTitle').textContent = 'Takvim';
                currentViewDate = new Date();
                updateDateDisplay();
                renderTodayView();
            } else if (targetId === 'view-schedule') {
                document.getElementById('pageTitle').textContent = 'Program';
                renderScheduleView(currentScheduleDayIndex); // Render last viewed schedule day
            } else if (targetId === 'view-stats') {
                document.getElementById('pageTitle').textContent = 'Devamsızlık Durumu';
                renderStatsView();
            } else if (targetId === 'view-settings') {
                document.getElementById('pageTitle').textContent = 'Ayarlar';
            }
        });
    });
}

/* ==========================================================================
   THEME
   ========================================================================== */
function setupThemeToggle() {
    const select = document.getElementById('themeSelect');
    
    // Load theme from Storage
    const data = Storage.load();
    let currentTheme = data.theme || 'dark';

    const applyTheme = (themeName) => {
        if (themeName === 'light' || themeName === 'default') {
            document.body.removeAttribute('data-theme');
        } else {
            document.body.setAttribute('data-theme', themeName);
        }
        
        if (select) select.value = themeName;
        lucide.createIcons();
        
        // Save to storage
        const currentData = Storage.load();
        if (currentData.theme !== themeName) {
            currentData.theme = themeName;
            Storage.save(currentData);
        }
    };
    
    applyTheme(currentTheme);
    
    // Settings dropdown
    if (select) {
        select.addEventListener('change', (e) => {
            currentTheme = e.target.value;
            applyTheme(currentTheme);
        });
    }
}

/* ==========================================================================
   MODALS
   ========================================================================== */
function setupModals() {
    document.getElementById('btnOpenAddClassModal').addEventListener('click', () => {
        document.getElementById('addClassForm').reset();
        document.getElementById('addClassModal').classList.add('active');
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/* ==========================================================================
   FORMS (Add/Edit Class)
   ========================================================================== */
function setupForms() {
    const timeInputs = [document.getElementById('classTime'), document.getElementById('editClassTime')];
    timeInputs.forEach(input => {
        if(input) {
            input.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val.length > 2) {
                    val = val.substring(0, 2) + ':' + val.substring(2, 4);
                }
                e.target.value = val;
            });
        }
    });

    const editHourInput = document.getElementById('editClassHour');
    const editMinInput = document.getElementById('editClassMin');
    const editClassTime = document.getElementById('editClassTime');

    function updateHiddenTime() {
        if(editClassTime && editHourInput && editMinInput) {
            editClassTime.value = `${editHourInput.value}:${editMinInput.value}`;
        }
    }

    if(document.getElementById('btnEditHourUp')) {
        document.getElementById('btnEditHourUp').addEventListener('click', () => {
            let hr = parseInt(editHourInput.value);
            hr = hr >= 23 ? 0 : hr + 1;
            editHourInput.value = hr.toString().padStart(2, '0');
            updateHiddenTime();
        });
        document.getElementById('btnEditHourDown').addEventListener('click', () => {
            let hr = parseInt(editHourInput.value);
            hr = hr <= 0 ? 23 : hr - 1;
            editHourInput.value = hr.toString().padStart(2, '0');
            updateHiddenTime();
        });
        document.getElementById('btnEditMinUp').addEventListener('click', () => {
            let min = parseInt(editMinInput.value);
            min = min >= 59 ? 0 : min + 1;
            editMinInput.value = min.toString().padStart(2, '0');
            updateHiddenTime();
        });
        document.getElementById('btnEditMinDown').addEventListener('click', () => {
            let min = parseInt(editMinInput.value);
            min = min <= 0 ? 59 : min - 1;
            editMinInput.value = min.toString().padStart(2, '0');
            updateHiddenTime();
        });
    }

    // Add Class Spinner Logic
    const addHourInput = document.getElementById('addClassHour');
    const addMinInput = document.getElementById('addClassMin');
    const addClassTime = document.getElementById('classTime');

    function updateAddHiddenTime() {
        if(addClassTime && addHourInput && addMinInput) {
            addClassTime.value = `${addHourInput.value}:${addMinInput.value}`;
        }
    }

    if(document.getElementById('btnAddHourUp')) {
        document.getElementById('btnAddHourUp').addEventListener('click', () => {
            let hr = parseInt(addHourInput.value);
            hr = hr >= 23 ? 0 : hr + 1;
            addHourInput.value = hr.toString().padStart(2, '0');
            updateAddHiddenTime();
        });
        document.getElementById('btnAddHourDown').addEventListener('click', () => {
            let hr = parseInt(addHourInput.value);
            hr = hr <= 0 ? 23 : hr - 1;
            addHourInput.value = hr.toString().padStart(2, '0');
            updateAddHiddenTime();
        });
        document.getElementById('btnAddMinUp').addEventListener('click', () => {
            let min = parseInt(addMinInput.value);
            min = min >= 59 ? 0 : min + 1;
            addMinInput.value = min.toString().padStart(2, '0');
            updateAddHiddenTime();
        });
        document.getElementById('btnAddMinDown').addEventListener('click', () => {
            let min = parseInt(addMinInput.value);
            min = min <= 0 ? 59 : min - 1;
            addMinInput.value = min.toString().padStart(2, '0');
            updateAddHiddenTime();
        });
    }

    document.getElementById('addClassForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('className').value.trim();
        const day = parseInt(document.getElementById('classDay').value);
        const time = document.getElementById('classTime').value;

        if (name && time) {
            Storage.addClass({ name, day, time });
            document.getElementById('addClassModal').classList.remove('active');
            renderScheduleView(day);
            renderTodayView();
            renderStatsView();
            showToast('Ders başarıyla eklendi!');
        }
    });

    document.getElementById('editClassForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('editClassId').value;
        const name = document.getElementById('editClassName').value.trim();
        const day = parseInt(document.getElementById('editClassDay').value);
        const time = document.getElementById('editClassTime').value;

        if (id && name && time) {
            Storage.editClass(id, { name, day, time });
            document.getElementById('editClassModal').classList.remove('active');
            renderScheduleView(day);
            renderTodayView();
            renderStatsView();
            showToast('Ders güncellendi!');
        }
    });
}

/* ==========================================================================
   VIEWS RENDER
   ========================================================================== */
function getDayName(dayIndex) {
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return days[dayIndex];
}

function renderScheduleView(dayIndex) {
    const data = Storage.load();
    const container = document.getElementById('scheduleList');
    container.innerHTML = '';
    
    currentScheduleDayIndex = dayIndex;
    
    document.querySelectorAll('.day-pill').forEach(pill => {
        if (parseInt(pill.getAttribute('data-day')) === dayIndex) {
            pill.classList.add('active');
            // Auto scroll active pill to center
            const scroller = document.getElementById('scheduleWeekScroller');
            const scrollLeft = pill.offsetLeft - (scroller.clientWidth / 2) + (pill.clientWidth / 2);
            scroller.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        } else {
            pill.classList.remove('active');
        }
    });

    const classesToday = data.classes
        .filter(c => c.day === dayIndex)
        .sort((a, b) => a.time.localeCompare(b.time));

    if (classesToday.length === 0) {
        container.innerHTML = `<div class="empty-state glass-panel"><i data-lucide="smile"></i><p>${getDayName(dayIndex)} günü dersin yok.</p></div>`;
        lucide.createIcons();
        return;
    }

    classesToday.forEach(cls => {
        const div = document.createElement('div');
        div.className = 'class-card glass-panel';
        div.innerHTML = `
            <div class="class-card-header" style="margin-bottom:0">
                <div>
                    <span class="class-time">${cls.time}</span>
                    <h3 class="class-name">${cls.name}</h3>
                    <span class="class-id-badge">ID: ${cls.id}</span>
                </div>
                <div style="display:flex; flex-direction:column; gap:0.25rem; align-items:center; justify-content:center;">
                    <button class="icon-btn" style="color:var(--info); padding:6px;" onclick="openEditModal('${cls.id}')">
                        <i data-lucide="edit" style="width:16px; height:16px;"></i>
                    </button>
                    <button class="icon-btn text-danger" style="padding:6px;" onclick="deleteClass('${cls.id}', ${cls.day})">
                        <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                    </button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

window.openEditModal = (classId) => {
    const data = Storage.load();
    const cls = data.classes.find(c => c.id === classId);
    if (cls) {
        document.getElementById('editClassId').value = cls.id;
        document.getElementById('editClassName').value = cls.name;
        document.getElementById('editClassDay').value = cls.day;
        document.getElementById('editClassTime').value = cls.time;
        
        const [hr, min] = cls.time.split(':');
        document.getElementById('editClassHour').value = hr;
        document.getElementById('editClassMin').value = min;
        
        document.getElementById('editClassModal').classList.add('active');
    }
};

window.deleteClass = (id, dayIndex) => {
    customConfirm('Dersi ve yoklama geçmişini silmek istediğinize emin misiniz?', () => {
        Storage.deleteClass(id);
        renderScheduleView(dayIndex);
        renderTodayView(); 
        renderStatsView();
        showToast('Ders silindi.');
    });
};

function renderTodayView() {
    const offset = currentViewDate.getTimezoneOffset() * 60000;
    const dateStr = (new Date(currentViewDate - offset)).toISOString().split('T')[0]; 
    const dayIndex = currentViewDate.getDay();
    
    const data = Storage.load();
    const container = document.getElementById('todayClassesList');
    container.innerHTML = '';
    const classesToday = data.classes.filter(c => c.day === dayIndex).sort((a, b) => a.time.localeCompare(b.time));
    
    if (classesToday.length === 0) {
        container.innerHTML = `<div class="empty-state glass-panel"><i data-lucide="calendar-off"></i><p>Bu tarihte hiç dersin yok! 🎉</p></div>`;
        lucide.createIcons();
        return;
    }

    classesToday.forEach(cls => {
        const status = data.attendance[cls.id] ? data.attendance[cls.id][dateStr] : null;
        const div = document.createElement('div');
        div.className = 'class-card glass-panel';
        div.innerHTML = `
            <div class="class-card-header">
                <div>
                    <span class="class-time">${cls.time}</span>
                    <h3 class="class-name">${cls.name}</h3>
                </div>
            </div>
            <div class="attendance-actions">
                <button class="btn-attend btn-present ${status === 'present' ? 'selected' : ''}" onclick="markAttendance(this, '${cls.id}', '${dateStr}', 'present')">
                    <i data-lucide="check"></i> Geldim
                </button>
                <button class="btn-attend btn-proxy ${status === 'proxy' ? 'selected' : ''}" onclick="markAttendance(this, '${cls.id}', '${dateStr}', 'proxy')">
                    <i data-lucide="pen-tool"></i> İmza Attırdım
                </button>
                <button class="btn-attend btn-absent ${status === 'absent' ? 'selected' : ''}" onclick="markAttendance(this, '${cls.id}', '${dateStr}', 'absent')">
                    <i data-lucide="x"></i> Yokum
                </button>
                <button class="btn-attend btn-canceled ${status === 'canceled' ? 'selected' : ''}" onclick="markAttendance(this, '${cls.id}', '${dateStr}', 'canceled')">
                    <i data-lucide="ban"></i> İşlenmedi
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

window.markAttendance = (btnElement, classId, dateStr, status) => {
    Storage.markAttendance(classId, dateStr, status);
    const parent = btnElement.closest('.attendance-actions');
    const wasSelected = btnElement.classList.contains('selected');
    parent.querySelectorAll('.btn-attend').forEach(b => b.classList.remove('selected'));
    if (!wasSelected) btnElement.classList.add('selected');
};

window.goToDateFromStats = (dateStr) => {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    const todayNav = document.querySelector('.bottom-nav .nav-item[data-target="view-today"]');
    if(todayNav) todayNav.classList.add('active');
    
    document.getElementById('view-today').classList.add('active');
    document.getElementById('pageTitle').textContent = 'Takvim';
    
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        currentViewDate = new Date(parts[0], parseInt(parts[1])-1, parts[2]);
    } else {
        currentViewDate = new Date(dateStr);
    }
    
    updateDateDisplay();
    renderTodayView();
};

function renderStatsView() {
    const data = Storage.load();
    const container = document.getElementById('statsContainer');
    container.innerHTML = '';
    if (data.classes.length === 0) {
        container.innerHTML = '<div class="empty-state glass-panel"><i data-lucide="pie-chart"></i><p>Henüz ders programı bulunmuyor.</p></div>';
        lucide.createIcons();
        return;
    }

    let classesWithStats = data.classes.map(cls => {
        return {
            ...cls,
            stats: Storage.getClassStats(cls.id)
        };
    });

    classesWithStats.sort((a, b) => b.stats.absent - a.stats.absent);

    classesWithStats.forEach(item => {
        const stats = item.stats;
        const cls = item;

        let total = stats.absent + stats.present;
        let absentPct = 0;
        let presentPct = 0;
        if (total > 0) {
            absentPct = (stats.absent / total) * 100;
            presentPct = (stats.present / total) * 100;
        }

        let absentDatesHtml = '';
        if (stats.absentDates && stats.absentDates.length > 0) {
            const sortedDates = [...stats.absentDates].sort((a, b) => new Date(b) - new Date(a));
            const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
            const today = new Date();
            today.setHours(0,0,0,0);
            
            let datesList = sortedDates.map(d => {
                const dateObj = new Date(d);
                const dayName = days[dateObj.getDay()];
                const diffTime = today.getTime() - dateObj.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                let timeAgoStr = "";
                if (diffDays === 0) timeAgoStr = "(Bugün)";
                else if (diffDays === 1) timeAgoStr = "(Dün)";
                else timeAgoStr = `(${diffDays} gün önce)`;

                const dd = String(dateObj.getDate()).padStart(2, '0');
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const yyyy = dateObj.getFullYear();

                return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(239, 68, 68, 0.1); padding:4px 8px; border-radius:4px; margin-top:4px; font-size:0.8rem; border-left:2px solid var(--danger);">
                    <div>
                        <span style="color:var(--text-main); font-weight:500; display:block;">${dd}.${mm}.${yyyy} - ${dayName}</span>
                        <span style="color:var(--text-muted); font-size:0.75rem;">${timeAgoStr}</span>
                    </div>
                    <button class="icon-btn" onclick="goToDateFromStats('${d}')" style="padding:4px; color:var(--text-main);" title="Bu güne git ve düzenle">
                        <i data-lucide="edit" style="width:14px; height:14px;"></i>
                    </button>
                </div>`;
            }).join('');

            absentDatesHtml = `
                <div style="margin-top:0.75rem; border-top:1px solid var(--border-color); padding-top:0.5rem;">
                    <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600; display:block; margin-bottom:0.25rem;"><i data-lucide="calendar-x" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>Devamsızlık Geçmişi:</span>
                    ${datesList}
                </div>
            `;
        }

        const div = document.createElement('div');
        div.className = 'stat-card glass-panel';
        div.innerHTML = `
            <h3 style="font-size:1.1rem; margin-bottom:0.5rem">${cls.name}</h3>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <span class="text-danger" style="font-weight:bold; font-size:0.9rem">${stats.absent} Devamsız</span>
                <span class="text-success" style="font-weight:bold; font-size:0.9rem">${stats.present} Katılım</span>
            </div>
            <div class="dual-bar">
                <div class="dual-bar-absent" style="width: ${absentPct}%"></div>
                <div class="dual-bar-present" style="width: ${presentPct}%"></div>
            </div>
            ${stats.canceled > 0 ? `<div class="stat-label" style="font-size:0.85rem; margin-top:0.5rem">İşlenmeyen Ders: ${stats.canceled}</div>` : ''}
            ${absentDatesHtml}
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

/* ==========================================================================
   SETTINGS & EXPORT/IMPORT LOGIC
   ========================================================================== */
function setupSettings() {
    // MODALS
    document.getElementById('btnOpenExportModal').addEventListener('click', () => {
        document.getElementById('exportDataModal').classList.add('active');
    });
    document.getElementById('btnOpenImportModal').addEventListener('click', () => {
        document.getElementById('importDataModal').classList.add('active');
    });
    document.getElementById('btnOpenScheduleOpsModal').addEventListener('click', () => {
        document.getElementById('scheduleOpsModal').classList.add('active');
        if (!window.prebuiltData) {
            loadPrebuiltList();
        }
    });
    document.getElementById('btnOpenPwaModal').addEventListener('click', () => {
        document.getElementById('pwaGuideModal').classList.add('active');
    });

    // MAGIC LINK SHARE
    document.getElementById('btnExportShare').addEventListener('click', () => {
        const hash = Storage.generateExportHash();
        const url = window.location.origin + window.location.pathname + '#import=' + hash;
        if (navigator.share) {
            navigator.share({ title: 'Yoklama Takip', text: 'Tüm verilerimi içe aktar:', url: url }).catch(e => console.log(e));
        } else {
            navigator.clipboard.writeText(url);
            showToast('Sihirli link kopyalandı!');
        }
    });

        // QR EXPORT
    document.getElementById('btnExportQR').addEventListener('click', () => {
        document.getElementById('exportDataModal').classList.remove('active');
        const hash = Storage.generateExportHash();
        const url = window.location.origin + window.location.pathname + '#import=' + hash;
        const container = document.getElementById('qrcode-container');
        container.innerHTML = ''; 
        
        if (url.length > 2900) {
            container.innerHTML = '<p class="text-danger" style="margin-top:2rem;"><i data-lucide="alert-triangle"></i> Veri çok büyük! Aylar süren yoklama kayıtları QR koda sığmaz. Lütfen Manuel Kod veya Dosya Olarak İndir seçeneğini kullanın.</p>';
            lucide.createIcons();
            document.getElementById('btnDownloadQR').style.display = 'none';
        } else {
            new QRCode(container, { text: url, width: 200, height: 200, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.L });
            document.getElementById('btnDownloadQR').style.display = 'block';
            
            // Set up download button
            document.getElementById('btnDownloadQR').onclick = () => {
                const canvas = container.querySelector('canvas');
                if(canvas) {
                    const link = document.createElement('a');
                    link.download = 'yoklama_qr_yedek.png';
                    link.href = canvas.toDataURL();
                    link.click();
                } else {
                    const img = container.querySelector('img');
                    if(img && img.src) {
                        const link = document.createElement('a');
                        link.download = 'yoklama_qr_yedek.png';
                        link.href = img.src;
                        link.click();
                    }
                }
            };
        }
        document.getElementById('qrModal').classList.add('active');
    });

    // MANUAL EXPORT
    document.getElementById('btnExportManual').addEventListener('click', () => {
        document.getElementById('exportDataModal').classList.remove('active');
        const hash = Storage.generateExportHash();
        document.getElementById('manualCodeExportText').value = hash;
        document.getElementById('manualCodeExportModal').classList.add('active');
    });

    document.getElementById('btnCopyManualCode').addEventListener('click', () => {
        const text = document.getElementById('manualCodeExportText');
        text.select();
        document.execCommand('copy');
        showToast('Kod kopyalandı! İstediğin yere kaydedebilirsin.');
    });

        // IMPORT SCANNED QR
    let html5QrcodeScanner = null;
    document.getElementById('btnScanQRInfo').addEventListener('click', () => {
        document.getElementById('qrScannerModal').classList.add('active');
        if (!html5QrcodeScanner) {
            html5QrcodeScanner = new Html5QrcodeScanner(
                "qr-reader", { fps: 10, qrbox: 250 }, false);
            html5QrcodeScanner.render((decodedText, decodedResult) => {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
                document.getElementById('qrScannerModal').classList.remove('active');
                
                let hash = decodedText;
                if (hash.includes('#import=')) {
                    hash = hash.split('#import=')[1];
                }
                confirmImport(hash, (success) => {
                    if(success) {
                        showToast('Veriler başarıyla aktarıldı!');
                        setTimeout(() => window.location.reload(), 1000);
                    }
                });
            }, (error) => {
                // Ignore errors
            });
        }
    });

    document.getElementById('btnCloseScanner').addEventListener('click', () => {
        if(html5QrcodeScanner) {
            html5QrcodeScanner.clear();
            html5QrcodeScanner = null;
        }
        document.getElementById('qrScannerModal').classList.remove('active');
    });

    

    // MANUAL IMPORT
    document.getElementById('btnImportManual').addEventListener('click', () => {
        document.getElementById('importDataModal').classList.remove('active');
        document.getElementById('manualCodeImportText').value = '';
        document.getElementById('manualCodeImportModal').classList.add('active');
    });

    document.getElementById('btnApplyManualCode').addEventListener('click', () => {
        const hash = document.getElementById('manualCodeImportText').value.trim();
        if(hash) {
            confirmImport(hash, (success) => {
                if (success) {
                    showToast('Veriler başarıyla aktarıldı!');
                    setTimeout(() => window.location.reload(), 1000);
                }
            });
        }
    });

    // TXT FILE EXPORT (btnExportFile is the setting-item div in exportDataModal)
    document.getElementById('btnExportFile').addEventListener('click', () => {
        document.getElementById('exportDataModal').classList.remove('active');
        const hash = Storage.generateExportHash();
        const blob = new Blob([hash], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR').replace(/\./g, '-');
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
        a.download = `yoklama_yedek_${dateStr}_${timeStr}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        showToast('TXT yedeği başarıyla indirildi!');
    });

    // TXT FILE IMPORT (the invisible input overlaid on the setting-item)
    document.getElementById('fileImportInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const hash = event.target.result.trim();
            if (hash) {
                confirmImport(hash, (success) => {
                    if (success) {
                        showToast('Dosyadan veriler başarıyla alındı!');
                        setTimeout(() => window.location.reload(), 1000);
                    }
                });
            } else {
                showToast('Hata: TXT dosyası boş veya geçersiz.');
            }
        };
        reader.readAsText(file);
    });


    // IMAGE EXPORT/IMPORT
    document.getElementById('btnExportImage').addEventListener('click', () => {
        document.getElementById('exportDataModal').classList.remove('active');
        const dataURL = Storage.exportToImage();
        const a = document.createElement('a');
        a.href = dataURL;
        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR').replace(/\./g, '-');
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }).replace(':', '-');
        a.download = `yoklama_yedek_${dateStr}_${timeStr}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Resim yedeği başarıyla indirildi!');
    });

    document.getElementById('imageImportInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            Storage.importFromImage(event.target.result, (hash) => {
                if (hash) {
                    confirmImport(hash, (success) => {
                        if (success) {
                            showToast('Resimden veriler başarıyla alındı!');
                            setTimeout(() => window.location.reload(), 1000);
                        }
                    });
                } else {
                    showToast('Hata: Resim bozulmuş. (Eğer resmi WhatsApp vs. ile gönderdiyseniz kalitesi düşüp bozulmuş olabilir)');
                }
            });
        };
        reader.readAsDataURL(file);
    });

    // SCHEDULE ONLY EXPORT/IMPORT
    document.getElementById('btnExportScheduleOnly').addEventListener('click', () => {
        document.getElementById('scheduleOpsModal').classList.remove('active');
        const hash = Storage.generateScheduleHash();
        document.getElementById('manualCodeExportText').value = hash;
        document.getElementById('manualCodeExportModal').classList.add('active');
        showToast('Sadece ders programı kodu hazırlandı.');
    });

    document.getElementById('btnImportScheduleOnly').addEventListener('click', () => {
        document.getElementById('scheduleOpsModal').classList.remove('active');
        document.getElementById('manualCodeImportText').value = '';
        document.getElementById('manualCodeImportModal').classList.add('active');
    });

    // PREBUILT SCHEDULES
    // Event listener will be attached inside setupCascadingSelects()

    // CLEAR ALL
    document.getElementById('btnClearData').addEventListener('click', () => {
        customConfirm('TÜM veriler silinecek. Emin misiniz?', () => {
            Storage.clearAll();
            window.location.reload();
        });
    });
}

function loadPrebuiltList() {
    const uniSelect = document.getElementById('prebuiltUniSelect');
    fetch('https://gman.dev/data/yoklama/programlar.json')
        .then(res => res.json())
        .then(data => {
            window.prebuiltData = data;
            uniSelect.innerHTML = '<option value="">Üniversite seçin...</option>';
            data.universities.forEach(uni => {
                const opt = document.createElement('option');
                opt.value = uni.id;
                opt.textContent = uni.name;
                uniSelect.appendChild(opt);
            });
            setupCascadingSelects();
        })
        .catch(err => {
            uniSelect.innerHTML = '<option value="">Programlar yüklenemedi.</option>';
        });
}

function setupCascadingSelects() {
    const uniSelect = document.getElementById('prebuiltUniSelect');
    const yearSelect = document.getElementById('prebuiltYearSelect');
    const termSelect = document.getElementById('prebuiltTermSelect');
    const deptSelect = document.getElementById('prebuiltDeptSelect');
    const gradeSelect = document.getElementById('prebuiltGradeSelect');
    const applyBtn = document.getElementById('btnApplyPrebuilt');
    const previewBtn = document.getElementById('btnPreviewPrebuilt');

    let currentUni = null;
    let currentYear = null;
    let currentTerm = null;
    let currentDept = null;
    let currentGradeClasses = null;

    uniSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        yearSelect.style.display = 'none';
        termSelect.style.display = 'none';
        deptSelect.style.display = 'none';
        gradeSelect.style.display = 'none';
        applyBtn.style.display = 'none';
        previewBtn.style.display = 'none';
        
        if (!val) return;
        
        currentUni = window.prebuiltData.universities.find(u => u.id === val);
        if(!currentUni || !currentUni.years) return;
        
        yearSelect.innerHTML = '<option value="">Yıl seçin...</option>';
        currentUni.years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y.id;
            opt.textContent = y.name;
            yearSelect.appendChild(opt);
        });
        yearSelect.style.display = 'block';
        yearSelect.disabled = false;
    });

    yearSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        termSelect.style.display = 'none';
        deptSelect.style.display = 'none';
        gradeSelect.style.display = 'none';
        applyBtn.style.display = 'none';
        previewBtn.style.display = 'none';
        
        if (!val) return;
        
        currentYear = currentUni.years.find(y => y.id === val);
        if(!currentYear || !currentYear.terms) return;
        
        termSelect.innerHTML = '<option value="">Dönem seçin...</option>';
        currentYear.terms.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            termSelect.appendChild(opt);
        });
        termSelect.style.display = 'block';
        termSelect.disabled = false;
    });

    termSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        deptSelect.style.display = 'none';
        gradeSelect.style.display = 'none';
        applyBtn.style.display = 'none';
        previewBtn.style.display = 'none';
        
        if (!val) return;
        
        currentTerm = currentYear.terms.find(t => t.id === val);
        if(!currentTerm || !currentTerm.departments) return;
        
        deptSelect.innerHTML = '<option value="">Bölüm seçin...</option>';
        currentTerm.departments.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            deptSelect.appendChild(opt);
        });
        deptSelect.style.display = 'block';
        deptSelect.disabled = false;
    });

    deptSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        gradeSelect.style.display = 'none';
        applyBtn.style.display = 'none';
        previewBtn.style.display = 'none';
        
        if (!val) return;
        
        currentDept = currentTerm.departments.find(d => d.id === val);
        if(!currentDept || !currentDept.grades) return;
        
        gradeSelect.innerHTML = '<option value="">Sınıf seçin...</option>';
        currentDept.grades.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            gradeSelect.appendChild(opt);
        });
        gradeSelect.style.display = 'block';
        gradeSelect.disabled = false;
    });

    gradeSelect.addEventListener('change', (e) => {
        const gradeId = e.target.value;
        if (gradeId && currentDept) {
            const currentGrade = currentDept.grades.find(g => g.id === gradeId);
            if (currentGrade && currentGrade.classes) {
                currentGradeClasses = currentGrade.classes;
                applyBtn.style.display = 'block';
                previewBtn.style.display = 'block';
            } else {
                applyBtn.style.display = 'none';
                previewBtn.style.display = 'none';
            }
        } else {
            applyBtn.style.display = 'none';
            previewBtn.style.display = 'none';
        }
    });
    
    applyBtn.addEventListener('click', () => {
        if (!currentGradeClasses) return;
        customConfirm('TÜM verileriniz (Dersler ve Yoklama Geçmişi) SİLİNECEK ve bu program yüklenecek. Emin misiniz?', () => {
            const currentTheme = Storage.load().theme;
            Storage.clearAll();
            const freshData = Storage.load(); 
            freshData.theme = currentTheme; 
            Storage.save(freshData);
            
            Storage.importPrebuilt(currentGradeClasses);
            showToast('Hazır program başarıyla yüklendi! Yenileniyor...');
            setTimeout(() => window.location.reload(), 1000);
        });
    });

    previewBtn.addEventListener('click', () => {
        if (!currentGradeClasses) return;
        const container = document.getElementById('previewScheduleContainer');
        container.innerHTML = '';
        
        // Group by day
        const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
        const dayMap = [1, 2, 3, 4, 5, 6, 0];
        
        days.forEach((dayName, idx) => {
            const dayClasses = currentGradeClasses.filter(c => c.day === dayMap[idx]);
            if (dayClasses.length > 0) {
                // Sort by time
                dayClasses.sort((a, b) => a.time.localeCompare(b.time));
                
                const dayHeader = document.createElement('h4');
                dayHeader.textContent = dayName;
                dayHeader.style.cssText = 'padding:0 1rem; margin-top:1rem; margin-bottom:0.5rem; color:var(--text-main); font-size:1.1rem; border-bottom:1px solid var(--border-color); padding-bottom:5px;';
                container.appendChild(dayHeader);
                
                const list = document.createElement('div');
                list.style.cssText = 'padding: 0 1rem;';
                dayClasses.forEach(cls => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding: 8px 0; font-size:0.85rem;';
                    
                    row.innerHTML = `
                        <div style="flex:1; display:flex; align-items:center; gap:10px;">
                            <span style="color:var(--text-muted); width:40px; font-weight:600;">${cls.time}</span>
                            <span style="color:var(--text-main); font-weight:500;">${cls.name}</span>
                        </div>
                    `;
                    list.appendChild(row);
                });
                container.appendChild(list);
            }
        });
        
        lucide.createIcons();
        document.getElementById('previewScheduleModal').classList.add('active');
    });
}

function customConfirm(message, onConfirm) {
    document.getElementById('confirmActionTitle').textContent = 'Uyarı';
    document.getElementById('confirmActionMessage').textContent = message;
    const modal = document.getElementById('confirmActionModal');
    modal.classList.add('active');
    
    document.getElementById('btnCancelAction').onclick = () => {
        modal.classList.remove('active');
    };
    document.getElementById('btnConfirmAction').onclick = () => {
        modal.classList.remove('active');
        if(onConfirm) onConfirm();
    };
}

function checkUrlForImport() {
    const hash = window.location.hash;
    if (hash.startsWith('#import=')) {
        const dataHash = hash.replace('#import=', '');
        confirmImport(dataHash, (success) => {
            if (success) {
                window.location.hash = ''; 
                showToast('Veriler başarıyla aktarıldı!');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                window.location.hash = '';
            }
        });
    }
}

function confirmImport(hash, callback) {
    const preview = Storage.previewHash(hash);
    if (preview === false) {
        showToast('Hata: Bağlantı bozuk veya veriler hatalı.');
        return;
    }
    
    let msg = 'Veriler içeri aktarılacak. Eski verileriniz SİLİNECEK. Emin misiniz?';
    
    if (preview.isScheduleOnly) {
        msg = 'Bu bir "Sadece Ders Programı" yedeği. Mevcut ders programınız tamamen SİLİNİP bununla değiştirilecek. Onaylıyor musunuz?';
    } else if (preview.exportedAt) {
        const diffMs = Date.now() - preview.exportedAt;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        let ageStr = '';
        if (diffDays > 0) ageStr = `${diffDays} gün önce`;
        else if (diffHours > 0) ageStr = `${diffHours} saat önce`;
        else if (diffMins > 0) ageStr = `${diffMins} dakika önce`;
        else ageStr = 'az önce';
        
        const dateStr = new Date(preview.exportedAt).toLocaleString('tr-TR');
        msg = `Bu tam yedek ${dateStr} tarihinde (${ageStr}) oluşturulmuş. Mevcut verilerinizin ÜZERİNE YAZILSIN MI? (Eskiler silinir)`;
    } else {
        msg = `Bu yedeğin tarihi bilinmiyor. Mevcut verilerinizin ÜZERİNE YAZILSIN MI? (Eskiler silinir)`;
    }
    
    customConfirm(msg, () => {
        let success = false;
        if (preview.isScheduleOnly) {
            success = Storage.importScheduleHash(hash, false); // false = overwrite
        } else {
            success = Storage.importFromHash(hash); // always overwrites
        }
        
        if (success) {
            if (callback) callback(true);
        } else {
            showToast('Hata: İçe aktarılamadı.');
            if (callback) callback(false);
        }
    });
}
