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
    const hiddenPicker = document.getElementById('hiddenDatePicker');
    
    datePickerContainer.addEventListener('click', () => {
        const offset = currentViewDate.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(currentViewDate - offset)).toISOString().split('T')[0];
        hiddenPicker.value = localISOTime;
        hiddenPicker.showPicker();
    });

    hiddenPicker.addEventListener('change', (e) => {
        if(e.target.value) {
            currentViewDate = new Date(e.target.value);
            updateDateDisplay();
            renderTodayView();
        }
    });
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
            Storage.updateClass(id, { name, day, time });
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
                    <span class="class-id-badge">${cls.id}</span>
                </div>
                <div style="display:flex; gap:0.5rem">
                    <button class="icon-btn" style="color:var(--info)" onclick="openEditModal('${cls.id}')">
                        <i data-lucide="edit"></i>
                    </button>
                    <button class="icon-btn text-danger" onclick="deleteClass('${cls.id}', ${cls.day})">
                        <i data-lucide="trash-2"></i>
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
        `;
        container.appendChild(div);
    });
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
        const hash = Storage.generateExportHash();
        const url = window.location.origin + window.location.pathname + '#import=' + hash;
        const container = document.getElementById('qrcode-container');
        container.innerHTML = ''; 
        new QRCode(container, { text: url, width: 200, height: 200, colorDark : "#000000", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.L });
        document.getElementById('qrModal').classList.add('active');
    });

    // MANUAL EXPORT
    document.getElementById('btnExportManual').addEventListener('click', () => {
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
    document.getElementById('btnScanQRInfo').addEventListener('click', () => {
        showToast('Kamera uygulamasını veya Denetim Merkezi\'ndeki QR kod okuyucuyu açın ve ekrandaki kodu tarayın.');
    });

    // MANUAL IMPORT
    document.getElementById('btnImportManual').addEventListener('click', () => {
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

    // FILE EXPORT/IMPORT
    document.getElementById('btnExportFile').addEventListener('click', () => {
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
        const hash = Storage.generateScheduleHash();
        document.getElementById('manualCodeExportText').value = hash;
        document.getElementById('manualCodeExportModal').classList.add('active');
        showToast('Sadece ders programı kodu hazırlandı.');
    });

    document.getElementById('btnImportScheduleOnly').addEventListener('click', () => {
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
    const termSelect = document.getElementById('prebuiltTermSelect');
    const deptSelect = document.getElementById('prebuiltDeptSelect');
    const gradeSelect = document.getElementById('prebuiltGradeSelect');
    const applyBtn = document.getElementById('btnApplyPrebuilt');

    let currentUni = null;
    let currentTerm = null;
    let currentDept = null;

    uniSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        termSelect.style.display = 'none';
        deptSelect.style.display = 'none';
        gradeSelect.style.display = 'none';
        applyBtn.disabled = true;
        
        if (!val) return;
        
        currentUni = window.prebuiltData.universities.find(u => u.id === val);
        if(!currentUni) return;
        
        termSelect.innerHTML = '<option value="">Dönem seçin...</option>';
        currentUni.terms.forEach(t => {
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
        applyBtn.disabled = true;
        
        if (!val) return;
        
        currentTerm = currentUni.terms.find(t => t.id === val);
        if(!currentTerm) return;
        
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
        applyBtn.disabled = true;
        
        if (!val) return;
        
        currentDept = currentTerm.departments.find(d => d.id === val);
        if(!currentDept) return;
        
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
        applyBtn.disabled = !e.target.value;
    });
    
    applyBtn.addEventListener('click', () => {
        const gradeId = gradeSelect.value;
        if (!gradeId || !currentDept) return;
        const currentGrade = currentDept.grades.find(g => g.id === gradeId);
        if (currentGrade && currentGrade.classes) {
            customConfirm('TÜM verileriniz (Dersler ve Yoklama Geçmişi) SİLİNECEK ve bu program yüklenecek. Emin misiniz?', () => {
                const currentTheme = Storage.load().theme;
                Storage.clearAll();
                const freshData = Storage.load(); 
                freshData.theme = currentTheme; 
                Storage.save(freshData);
                
                Storage.importPrebuilt(currentGrade.classes);
                showToast('Hazır program başarıyla yüklendi! Yenileniyor...');
                setTimeout(() => window.location.reload(), 1000);
            });
        }
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
