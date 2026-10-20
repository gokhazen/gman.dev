/**
 * App.js - Yoklama Takip (Rebuilt from scratch with Lucide icons & UTF-8 fixes)
 */

let currentViewDate = new Date();
let currentScheduleDayIndex = 1; // Default to Monday

// Haptic feedback helper
function triggerHaptic(type = 'light') {
    try {
        const data = Storage.load();
        if (data.hapticFeedback === false) return;
        if (!('vibrate' in navigator)) return;
        if (type === 'light') navigator.vibrate(14);
        else if (type === 'medium') navigator.vibrate(28);
        else if (type === 'success') navigator.vibrate([15, 35, 20]);
        else if (type === 'error') navigator.vibrate([40, 50, 40]);
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    checkUrlForImport();
    setupNavigation();
    setupThemeToggle();
    setupModals();
    setupBackButtonModals();
    setupForms();
    setupSettings();
    setupDateNavigation();
    
    updateDateDisplay();
    renderTodayView();
    renderScheduleView(1); // Default to Monday (1) instead of current day

    // Live Class & Countdown real-time updater
    setInterval(() => {
        const todayView = document.getElementById('view-today');
        if (todayView && todayView.classList.contains('active')) {
            renderLiveClassWidget();
        }
    }, 20000);

    // Story Export Button in Schedule view
    const btnDownloadStoryModal = document.getElementById('btnDownloadStoryModal');
    if (btnDownloadStoryModal) {
        btnDownloadStoryModal.addEventListener('click', () => {
            triggerHaptic('light');
            openScheduleStoryModal();
        });
    }
    setupStoryStudio();
}

/* ==========================================================================
   BACK BUTTON FOR MODALS (ANDROID / IOS SWIPE BACK)
   ========================================================================== */
function setupBackButtonModals() {
    window.modalStack = [];
    window.ignoreNextPopState = false;
    let syncTimeout = null;
    
    const observer = new MutationObserver(() => {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            const activeModals = Array.from(document.querySelectorAll('.modal-overlay.active'));
            
            while (window.modalStack.length < activeModals.length) {
                window.modalStack.push(activeModals[window.modalStack.length]);
                history.pushState({ isModal: true }, "");
            }
            
            while (window.modalStack.length > activeModals.length) {
                window.modalStack.pop();
                if (history.state && history.state.isModal) {
                    window.ignoreNextPopState = true;
                    history.back();
                }
            }
            
            for(let i = 0; i < activeModals.length; i++) {
                window.modalStack[i] = activeModals[i];
            }
        }, 10);
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    window.addEventListener('popstate', (e) => {
        if (window.ignoreNextPopState) {
            window.ignoreNextPopState = false;
            return;
        }
        
        if (window.modalStack.length > 0) {
            const topmost = window.modalStack.pop();
            topmost.classList.remove('active');
        }
    });
}

/* ==========================================================================
   DATE NAVIGATION
   ========================================================================== */
function setupDateNavigation() {
    document.getElementById('btnPrevDay').addEventListener('click', () => {
        triggerHaptic('light');
        currentViewDate.setDate(currentViewDate.getDate() - 1);
        updateDateDisplay();
        renderTodayView();
    });

    document.getElementById('btnNextDay').addEventListener('click', () => {
        triggerHaptic('light');
        currentViewDate.setDate(currentViewDate.getDate() + 1);
        updateDateDisplay();
        renderTodayView();
    });

    document.querySelectorAll('.day-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            triggerHaptic('light');
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
            triggerHaptic('light');
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
   THEMES & FULLSCREEN THEME PICKER
   ========================================================================== */
const THEMES_METADATA = [
    // --- Koyu Temalar ---
    { id: 'dark', name: 'Karanlık (Klasik)', category: 'dark', bg: '#121212', panel: '#1e1e1e', primary: '#6366f1', text: '#f8fafc' },
    { id: 'tokyo-night', name: 'Tokyo Night', category: 'dark', bg: '#1a1b26', panel: '#24283b', primary: '#7aa2f7', text: '#c0caf5' },
    { id: 'catppuccin', name: 'Catppuccin Mocha', category: 'dark', bg: '#1e1e2e', panel: '#313244', primary: '#cba6f7', text: '#cdd6f4' },
    { id: 'nord', name: 'Nord', category: 'dark', bg: '#2e3440', panel: '#3b4252', primary: '#88c0d0', text: '#eceff4' },
    { id: 'dracula', name: 'Dracula', category: 'dark', bg: '#282a36', panel: '#44475a', primary: '#bd93f9', text: '#f8f8f2' },
    { id: 'monokai', name: 'Monokai Pro', category: 'dark', bg: '#2d2a2e', panel: '#403d41', primary: '#ffd866', text: '#fcfcfa' },
    { id: 'oled', name: 'OLED Siyah', category: 'dark', bg: '#000000', panel: '#141414', primary: '#3b82f6', text: '#ffffff' },
    { id: 'abyss', name: 'Neon Abyss', category: 'dark', bg: '#050d1a', panel: '#0c1c34', primary: '#00f0ff', text: '#e0f7fa' },
    { id: 'cyberpunk', name: 'Cyberpunk Neon', category: 'dark', bg: '#120458', panel: '#2a0845', primary: '#ff0055', text: '#00ffcc' },
    { id: 'crimson', name: 'Crimson Vampir', category: 'dark', bg: '#14080a', panel: '#2d1218', primary: '#ef4444', text: '#fee2e2' },
    { id: 'amber', name: 'Amber Glow', category: 'dark', bg: '#171109', panel: '#2d1e12', primary: '#f59e0b', text: '#fef3c7' },
    { id: 'midnight', name: 'Gece Yarısı', category: 'dark', bg: '#0a1128', panel: '#1c315e', primary: '#38bdf8', text: '#e2e8f0' },
    { id: 'ocean', name: 'Okyanus (Ocean)', category: 'dark', bg: '#0f172a', panel: '#1e293b', primary: '#0ea5e9', text: '#e0f2fe' },
    { id: 'forest', name: 'Orman (Forest)', category: 'dark', bg: '#022c22', panel: '#064e3b', primary: '#10b981', text: '#d1fae5' },
    { id: 'sunset', name: 'Gün Batımı', category: 'dark', bg: '#2d1b2e', panel: '#452746', primary: '#f67280', text: '#fcd5ce' },
    { id: 'solarized-dark', name: 'Solarized Dark', category: 'dark', bg: '#002b36', panel: '#073642', primary: '#268bd2', text: '#93a1a1' },
    { id: 'slate', name: 'Koyu Kayrak', category: 'dark', bg: '#0f172a', panel: '#1e293b', primary: '#64748b', text: '#f8fafc' },
    { id: 'hacker', name: 'Matrix Hacker', category: 'dark', bg: '#000000', panel: '#001a00', primary: '#00ff00', text: '#00ff00' },

    // --- Açık Temalar ---
    { id: 'sakura', name: 'Sakura (Kiraz Çiçeği)', category: 'light', bg: '#fff5f7', panel: '#ffe4eb', primary: '#ec4899', text: '#831843' },
    { id: 'lavender', name: 'Lavanta', category: 'light', bg: '#f3e8ff', panel: '#ffffff', primary: '#8b5cf6', text: '#4c1d95' },
    { id: 'lilac', name: 'Leylak Rüya', category: 'light', bg: '#f8f7ff', panel: '#ede9fe', primary: '#7c3aed', text: '#3b0764' },
    { id: 'sky', name: 'Gökyüzü', category: 'light', bg: '#f0f9ff', panel: '#bae6fd', primary: '#38bdf8', text: '#0c4a6e' },
    { id: 'glacier', name: 'Buzul Mavi', category: 'light', bg: '#f0f7ff', panel: '#dbeafe', primary: '#2563eb', text: '#1e3a8a' },
    { id: 'mint', name: 'Nane Yeşili', category: 'light', bg: '#f0fdf4', panel: '#bbf7d0', primary: '#4ade80', text: '#14532d' },
    { id: 'matcha', name: 'Matcha Latte', category: 'light', bg: '#f4f8f3', panel: '#e3ede1', primary: '#65a30d', text: '#365314' },
    { id: 'emerald', name: 'Zümrüt', category: 'light', bg: '#ecfdf5', panel: '#d1fae9', primary: '#10b981', text: '#064e3b' },
    { id: 'peach', name: 'Şeftali', category: 'light', bg: '#fff5f5', panel: '#fed7d7', primary: '#f56565', text: '#742a2a' },
    { id: 'rose', name: 'Gül Kurusu', category: 'light', bg: '#fff1f2', panel: '#ffe4e6', primary: '#f43f5e', text: '#881337' },
    { id: 'vanilla', name: 'Vanilya', category: 'light', bg: '#fefce8', panel: '#fef08a', primary: '#eab308', text: '#713f12' },
    { id: 'sand', name: 'Kum Beji', category: 'light', bg: '#f5f5f4', panel: '#e7e5e4', primary: '#a8a29e', text: '#44403c' },
    { id: 'coffee', name: 'Kahve (Latte)', category: 'light', bg: '#f4ecd8', panel: '#fffdf5', primary: '#8d7b68', text: '#4a3c31' },
    { id: 'solarized-light', name: 'Solarized Light', category: 'light', bg: '#fdf6e3', panel: '#eee8d5', primary: '#268bd2', text: '#073642' },
    { id: 'amethyst', name: 'Ametist Kristal', category: 'light', bg: '#faf5ff', panel: '#f3e8ff', primary: '#a855f7', text: '#3b0764' }
];

let currentThemeFilter = 'all';

function applyTheme(themeName, showToastMsg = false) {
    if (themeName === 'light' || themeName === 'default') {
        document.body.removeAttribute('data-theme');
    } else {
        document.body.setAttribute('data-theme', themeName);
    }
    
    // Save to storage
    const currentData = Storage.load();
    if (currentData.theme !== themeName) {
        currentData.theme = themeName;
        Storage.save(currentData);
    }

    const themeObj = THEMES_METADATA.find(t => t.id === themeName) || { name: themeName };
    const labelEl = document.getElementById('currentThemeLabel');
    if (labelEl) labelEl.textContent = themeObj.name;

    const activeBadge = document.getElementById('themeActiveBadge');
    if (activeBadge) activeBadge.textContent = `Aktif: ${themeObj.name}`;

    // Update active class and buttons on cards without full-DOM re-creation
    const container = document.getElementById('themeGridContainer');
    if (container) {
        container.querySelectorAll('.theme-card-clean').forEach(card => {
            const isCardActive = card.getAttribute('data-theme-id') === themeName;
            card.classList.toggle('active-theme', isCardActive);
            const btn = card.querySelector('.theme-action-btn');
            if (btn) {
                btn.classList.toggle('is-active', isCardActive);
                btn.innerHTML = isCardActive ? '<i data-lucide="check"></i> Aktif' : 'Uygula';
            }
        });
        lucide.createIcons();
    }

    // Update story stage ambient glow if rendered
    const glowEl = document.getElementById('storyStageGlow');
    if (glowEl && themeObj.primary) {
        glowEl.style.background = `radial-gradient(circle, ${themeObj.primary} 0%, transparent 70%)`;
    }

    if (showToastMsg) {
        triggerHaptic('success');
        showToast(`${themeObj.name} teması uygulandı!`);
    }
}

function renderThemePickerGrid() {
    const container = document.getElementById('themeGridContainer');
    if (!container) return;

    const data = Storage.load();
    const currentTheme = data.theme || 'dark';

    // Update header badge
    const activeBadge = document.getElementById('themeActiveBadge');
    if (activeBadge) {
        const activeThemeObj = THEMES_METADATA.find(t => t.id === currentTheme);
        if (activeThemeObj) activeBadge.textContent = `Aktif: ${activeThemeObj.name}`;
    }

    container.innerHTML = '';
    THEMES_METADATA.forEach(t => {
        const isActive = currentTheme === t.id;
        const card = document.createElement('div');
        card.className = `theme-card-clean ${isActive ? 'active-theme' : ''}`;
        card.setAttribute('data-theme-id', t.id);
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.innerHTML = `
            <div class="theme-card-preview" style="background:${t.bg};">
                <div class="theme-mock-window" style="background:${t.panel}; border:1px solid ${t.primary}50;">
                    <div class="theme-mock-pill" style="background:${t.primary}; color:#ffffff;">Aa</div>
                    <div class="theme-mock-lines">
                        <div class="theme-mock-bar" style="background:${t.text}; opacity:0.9;"></div>
                        <div class="theme-mock-bar short" style="background:${t.text}; opacity:0.5;"></div>
                    </div>
                </div>
                <div class="theme-palette-dots">
                    <span class="theme-dot" style="background:${t.bg};" title="Arka Plan"></span>
                    <span class="theme-dot" style="background:${t.panel};" title="Panel"></span>
                    <span class="theme-dot" style="background:${t.primary};" title="Vurgu"></span>
                </div>
                <div class="theme-active-indicator">
                    <i data-lucide="check"></i>
                </div>
            </div>
            <div class="theme-card-details">
                <div class="theme-name-row">
                    <span class="theme-name-text">${t.name}</span>
                    <span class="theme-category-tag ${t.category}">${t.category === 'dark' ? 'Koyu' : 'Açık'}</span>
                </div>
                <button type="button" class="theme-action-btn ${isActive ? 'is-active' : ''}">
                    ${isActive ? '<i data-lucide="check"></i> Aktif' : 'Uygula'}
                </button>
            </div>
        `;

        card.addEventListener('click', () => {
            applyTheme(t.id, true);
        });

        container.appendChild(card);
    });

    lucide.createIcons();
}

function setupThemeToggle() {
    const data = Storage.load();
    const currentTheme = data.theme || 'dark';
    applyTheme(currentTheme, false);

    const btnOpenThemeModal = document.getElementById('btnOpenThemeModal');
    if (btnOpenThemeModal) {
        btnOpenThemeModal.addEventListener('click', () => {
            triggerHaptic('light');
            renderThemePickerGrid();
            document.getElementById('themePickerModal').classList.add('active');
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

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function minutesToTime(totalMin) {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getTodayDateString(d = new Date()) {
    const offset = d.getTimezoneOffset() * 60000;
    return (new Date(d - offset)).toISOString().split('T')[0];
}

window.goToToday = () => {
    currentViewDate = new Date();
    updateDateDisplay();
    renderTodayView();
    triggerHaptic('light');
};

function renderLiveClassWidget() {
    const container = document.getElementById('liveClassWidget');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const viewDate = new Date(currentViewDate);
    viewDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((viewDate - today) / (1000 * 60 * 60 * 24));

    // If viewing another date than today
    if (diffDays !== 0) {
        container.innerHTML = `
            <div class="live-class-card done-class glass-panel" style="display:flex; justify-content:space-between; align-items:center; padding:0.8rem 1rem;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <i data-lucide="calendar" style="width:16px; height:16px; color:var(--primary);"></i>
                    <span style="font-size:0.85rem; color:var(--text-muted);">Farklı bir tarihteki derslere bakıyorsunuz.</span>
                </div>
                <button class="btn-primary" onclick="goToToday()" style="padding:4px 12px; font-size:0.75rem; border-radius:20px; white-space:nowrap;">
                    Bugüne Dön
                </button>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay();
    const data = Storage.load();
    const dateStr = getTodayDateString(now);

    const todayClasses = (data.classes || [])
        .filter(c => c.day === currentDay)
        .sort((a, b) => a.time.localeCompare(b.time));

    const DURATION = 50; // Standart üniversite blok/ders süresi (dakika)

    let activeClass = null;
    let upcomingClass = null;
    let allFinished = true;

    for (const cls of todayClasses) {
        const start = timeToMinutes(cls.time);
        const end = start + DURATION;

        if (currentMinutes >= start && currentMinutes < end) {
            activeClass = { ...cls, start, end };
            break;
        } else if (currentMinutes < start) {
            allFinished = false;
            if (!upcomingClass) {
                upcomingClass = { ...cls, start, end };
            }
        }
    }

    if (activeClass) {
        const elapsed = currentMinutes - activeClass.start;
        const remaining = activeClass.end - currentMinutes;
        const progress = Math.min(100, Math.max(0, Math.round((elapsed / DURATION) * 100)));
        const endTimeStr = minutesToTime(activeClass.end);
        const currentStatus = data.attendance[activeClass.id] ? data.attendance[activeClass.id][dateStr] : null;

        let actionBtns = '';
        if (!currentStatus) {
            actionBtns = `
                <div style="display:flex; gap:8px; margin-top:10px;">
                    <button class="btn-attend btn-present" style="flex:1; padding:6px; font-size:0.8rem;" onclick="markAttendance(this, '${activeClass.id}', '${dateStr}', 'present')">
                        <i data-lucide="check"></i> Geldim
                    </button>
                    <button class="btn-attend btn-absent" style="flex:1; padding:6px; font-size:0.8rem;" onclick="markAttendance(this, '${activeClass.id}', '${dateStr}', 'absent')">
                        <i data-lucide="x"></i> Yokum
                    </button>
                </div>
            `;
        } else {
            const statusLabels = {
                present: '✓ Katılım işaretlendi (Geldim)',
                proxy: '✓ İmza attırıldı',
                absent: '✕ Devamsız yazıldı (Yokum)',
                canceled: '— Ders işlenmedi'
            };
            actionBtns = `
                <div style="font-size:0.8rem; color:var(--text-muted); margin-top:8px; font-weight:500;">
                    ${statusLabels[currentStatus] || ''}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="live-class-card active-class glass-panel">
                <span class="live-status-pill now"><span class="pulse-dot"></span> Şu An Derstesin</span>
                <div class="live-class-title">${activeClass.name}</div>
                <div class="live-class-countdown">
                    <i data-lucide="clock" style="width:14px; height:14px; color:#10b981;"></i>
                    <span>${activeClass.time} - ${endTimeStr} • Bitişe <strong>${remaining} dakika</strong> kaldı</span>
                </div>
                <div class="live-class-progress-bar">
                    <div class="live-class-progress-fill" style="width: ${progress}%"></div>
                </div>
                ${actionBtns}
            </div>
        `;
    } else if (upcomingClass) {
        const diffMin = upcomingClass.start - currentMinutes;
        let countdownStr = '';
        if (diffMin < 60) {
            countdownStr = `<strong>${diffMin} dakika</strong> sonra başlıyor`;
        } else {
            const h = Math.floor(diffMin / 60);
            const m = diffMin % 60;
            countdownStr = `<strong>${h} saat ${m > 0 ? m + ' dk' : ''}</strong> sonra başlıyor`;
        }

        container.innerHTML = `
            <div class="live-class-card upcoming-class glass-panel">
                <span class="live-status-pill upcoming"><span class="pulse-dot"></span> Sıradaki Ders</span>
                <div class="live-class-title">${upcomingClass.name}</div>
                <div class="live-class-countdown">
                    <i data-lucide="clock" style="width:14px; height:14px; color:var(--primary);"></i>
                    <span>Saat <strong>${upcomingClass.time}</strong> • ${countdownStr}</span>
                </div>
            </div>
        `;
    } else if (todayClasses.length > 0 && allFinished) {
        container.innerHTML = `
            <div class="live-class-card done-class glass-panel">
                <span class="live-status-pill finished"><i data-lucide="check-circle" style="width:13px; height:13px;"></i> Gün Tamamlandı</span>
                <div class="live-class-title" style="font-size:1.05rem;">Bugünkü tüm derslerin bitti! 🎉</div>
                <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Bugün için planlanan başka dersin kalmadı. İyi dinlenmeler!</p>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="live-class-card done-class glass-panel" style="padding:1rem;">
                <span class="live-status-pill finished"><i data-lucide="coffee" style="width:13px; height:13px;"></i> Bugün Ders Yok</span>
                <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Bugün için kayıtlı dersin bulunmuyor. Keyifli bir gün dileriz!</p>
            </div>
        `;
    }

    lucide.createIcons();
}

function renderTodayView() {
    renderLiveClassWidget();

    const offset = currentViewDate.getTimezoneOffset() * 60000;
    const dateStr = (new Date(currentViewDate - offset)).toISOString().split('T')[0]; 
    const dayIndex = currentViewDate.getDay();
    
    const todayZero = new Date(); todayZero.setHours(0,0,0,0);
    const currentZero = new Date(currentViewDate); currentZero.setHours(0,0,0,0);
    const isToday = currentZero.getTime() === todayZero.getTime();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

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
        const startMin = timeToMinutes(cls.time);
        const isNow = isToday && (currentMinutes >= startMin && currentMinutes < startMin + 50);

        const div = document.createElement('div');
        div.className = `class-card glass-panel ${isNow ? 'is-active-now' : ''}`;
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
    triggerHaptic('medium');
    Storage.markAttendance(classId, dateStr, status);
    
    // Update active state on buttons inside class card if clicked directly
    if (btnElement) {
        const parent = btnElement.closest('.attendance-actions');
        if (parent) {
            const wasSelected = btnElement.classList.contains('selected');
            parent.querySelectorAll('.btn-attend').forEach(b => b.classList.remove('selected'));
            if (!wasSelected) btnElement.classList.add('selected');
        }
    }
    
    // If today view, update the live widget too
    renderLiveClassWidget();
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

        const proxyCount = stats.proxy || 0;
        const total = stats.absent + proxyCount + stats.present;
        let absentPct = 0;
        let proxyPct = 0;
        let presentPct = 0;
        if (total > 0) {
            absentPct = (stats.absent / total) * 100;
            proxyPct = (proxyCount / total) * 100;
            presentPct = (stats.present / total) * 100;
        }

        let absentDatesHtml = '';
        if (stats.absentDates && stats.absentDates.length > 0) {
            const sortedDates = [...stats.absentDates].sort((a, b) => new Date(b) - new Date(a));
            const dayNamesShortTr = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
            const monthNamesTr = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            const today = new Date();
            today.setHours(0,0,0,0);
            
            let datesList = sortedDates.map(d => {
                const dateObj = new Date(d);
                const dayShort = dayNamesShortTr[dateObj.getDay()];
                const dayNum = dateObj.getDate();
                const monthName = monthNamesTr[dateObj.getMonth()];
                const diffTime = today.getTime() - dateObj.getTime();
                const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                
                let timeAgoStr = "";
                if (diffDays === 0) timeAgoStr = "Bugün";
                else if (diffDays === 1) timeAgoStr = "Dün";
                else timeAgoStr = `${diffDays}g önce`;

                return `<div class="absence-pill-item" onclick="goToDateFromStats('${d}')" title="Bu güne git ve düzenle">
                    <span class="absence-dot-glow"></span>
                    <span class="absence-pill-date">${dayNum} ${monthName}</span>
                    <span class="absence-pill-day">${dayShort}</span>
                    <span class="absence-pill-ago">${timeAgoStr}</span>
                    <i data-lucide="arrow-up-right" class="absence-pill-icon"></i>
                </div>`;
            }).join('');

            absentDatesHtml = `
                <div style="margin-top:0.75rem; border-top:1px solid var(--border-color); padding-top:0.45rem;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.35rem;">
                        <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                            <i data-lucide="calendar-x" style="width:12px; height:12px; color:var(--danger);"></i>Devamsızlık Geçmişi
                        </span>
                        <span style="font-size:0.7rem; color:var(--text-muted); font-weight:500;">${sortedDates.length} gün</span>
                    </div>
                    <div class="absence-history-list">
                        ${datesList}
                    </div>
                </div>
            `;
        }

        const div = document.createElement('div');
        div.className = 'stat-card glass-panel';
        div.innerHTML = `
            <h3 style="font-size:1.1rem; margin-bottom:0.5rem">${cls.name}</h3>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                <span class="text-danger" style="font-weight:bold; font-size:0.9rem">${stats.absent} Devamsız</span>
                <span style="color:#3b82f6; font-weight:bold; font-size:0.9rem">${proxyCount} İmza</span>
                <span class="text-success" style="font-weight:bold; font-size:0.9rem">${stats.present} Katılım</span>
            </div>
            <div class="dual-bar">
                <div class="dual-bar-absent" style="width: ${absentPct}%" title="${stats.absent} Devamsız"></div>
                <div class="dual-bar-proxy" style="width: ${proxyPct}%" title="${proxyCount} İmza"></div>
                <div class="dual-bar-present" style="width: ${presentPct}%" title="${stats.present} Katılım"></div>
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
    // HAPTIC FEEDBACK TOGGLE
    const hapticToggle = document.getElementById('hapticToggle');
    if (hapticToggle) {
        const data = Storage.load();
        hapticToggle.checked = data.hapticFeedback !== false;
        hapticToggle.addEventListener('change', (e) => {
            const curData = Storage.load();
            curData.hapticFeedback = e.target.checked;
            Storage.save(curData);
            if (e.target.checked) {
                triggerHaptic('medium');
                showToast('Titreşimli geri bildirim açıldı');
            } else {
                showToast('Titreşimli geri bildirim kapatıldı');
            }
        });
    }

    // CALENDAR (.ICS) EXPORT MODAL TRIGGERS
    const btnOpenCalendarExport = document.getElementById('btnOpenCalendarExportModal');
    if (btnOpenCalendarExport) {
        btnOpenCalendarExport.addEventListener('click', () => {
            openCalendarExportModal();
        });
    }

    const btnExportCalendarFromModal = document.getElementById('btnExportCalendarFromModal');
    if (btnExportCalendarFromModal) {
        btnExportCalendarFromModal.addEventListener('click', () => {
            document.getElementById('exportDataModal').classList.remove('active');
            openCalendarExportModal();
        });
    }

    const btnGenerateIcs = document.getElementById('btnGenerateIcs');
    if (btnGenerateIcs) {
        btnGenerateIcs.addEventListener('click', () => {
            generateIcsCalendar();
        });
    }

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
                let hash = decodedText;
                if (hash.includes('#import=')) {
                    hash = hash.split('#import=')[1];
                }
                
                // Freeze the camera and flash
                html5QrcodeScanner.pause();
                const flashEl = document.getElementById('cameraFlash');
                if (flashEl) {
                    flashEl.classList.add('active');
                    setTimeout(() => flashEl.classList.remove('active'), 1000);
                }
                
                // Wait 1 second before showing confirm modal
                setTimeout(() => {
                    html5QrcodeScanner.clear();
                    html5QrcodeScanner = null;
                    document.getElementById('qrScannerModal').classList.remove('active');
                    
                    confirmImport(hash, (success) => {
                        if(success) {
                            showToast('Veriler başarıyla aktarıldı!');
                            setTimeout(() => window.location.reload(), 1000);
                        }
                    });
                }, 800);
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

    // PDF FILE EXPORT
    document.getElementById('btnExportPdf').addEventListener('click', () => {
        document.getElementById('exportDataModal').classList.remove('active');
        const hash = Storage.generateExportHash();
        
        if (window.jspdf) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            const now = new Date();
            const dateStr = now.toLocaleDateString('tr-TR');
            const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            doc.setFontSize(22);
            doc.text("Yoklama Takip - Yedek Dosyasi", 105, 20, null, null, "center");
            
            doc.setFontSize(12);
            doc.text(`Tarih: ${dateStr} ${timeStr}`, 105, 30, null, null, "center");
            
            doc.setFontSize(10);
            doc.text("Bu PDF dosyasi yedekleme verilerinizi icerir. Uygulamaya yukleyerek geri alabilirsiniz.", 105, 40, null, null, "center");
            
            doc.setFontSize(8);
            const wrappedHash = "YKLM_BGN:" + hash + ":YKLM_END";
            const splitHash = doc.splitTextToSize(wrappedHash, 180);
            doc.text(splitHash, 15, 60);
            
            doc.save(`yoklama_yedek_${dateStr.replace(/\./g, '-')}_${timeStr.replace(':', '-')}.pdf`);
            showToast('PDF yedeği başarıyla indirildi!');
        } else {
            showToast('Hata: PDF kütüphanesi yüklenemedi.');
        }
    });

    // TXT / PDF FILE IMPORT (the invisible input overlaid on the setting-item)
    document.getElementById('fileImportInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.name.toLowerCase().endsWith('.pdf')) {
            // PDF Import
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const typedarray = new Uint8Array(event.target.result);
                    if (window.pdfjsLib) {
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        const pdf = await pdfjsLib.getDocument(typedarray).promise;
                        const page = await pdf.getPage(1);
                        const textContent = await page.getTextContent();
                        
                        const allText = textContent.items.map(item => item.str).join('').replace(/\s+/g, '');
                        
                        const match = allText.match(/YKLM_BGN:(.*?):YKLM_END/);
                        
                        if (match && match[1]) {
                            const extractedHash = match[1];
                            confirmImport(extractedHash, (success) => {
                                if (success) {
                                    showToast('PDF dosyasından veriler başarıyla alındı!');
                                    setTimeout(() => window.location.reload(), 1000);
                                }
                            });
                        } else {
                            showToast('Hata: PDF içinde geçerli veri bulunamadı.');
                        }
                    } else {
                        showToast('Hata: PDF okuyucu yüklenemedi.');
                    }
                } catch(err) {
                    console.error(err);
                    showToast('Hata: PDF dosyası okunamadı.');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            // TXT Import
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
        }
        e.target.value = '';
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

/* ==========================================================================
   CALENDAR (.ICS) EXPORT
   ========================================================================== */
function openCalendarExportModal() {
    triggerHaptic('light');
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
    const distToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distToMonday);
    const defaultDateStr = monday.toISOString().split('T')[0];

    const calStartDate = document.getElementById('calStartDate');
    if (calStartDate && !calStartDate.value) {
        calStartDate.value = defaultDateStr;
    }
    document.getElementById('calendarExportModal').classList.add('active');
}

function generateIcsCalendar() {
    const startDateVal = document.getElementById('calStartDate').value;
    if (!startDateVal) {
        showToast('Lütfen başlangıç tarihi seçin.');
        return;
    }
    const totalWeeks = parseInt(document.getElementById('calDurationWeeks').value) || 14;
    const classDurationMinutes = parseInt(document.getElementById('calClassDuration').value) || 50;

    const data = Storage.load();
    if (!data.classes || data.classes.length === 0) {
        showToast('Takvime aktarılacak ders bulunamadı.');
        return;
    }

    const startMonday = new Date(startDateVal + 'T00:00:00');
    const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const dayOffsets = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };
    let eventsIcs = [];

    data.classes.forEach(cls => {
        const offsetDays = dayOffsets[cls.day] !== undefined ? dayOffsets[cls.day] : 0;
        const firstClassDate = new Date(startMonday);
        firstClassDate.setDate(firstClassDate.getDate() + offsetDays);

        const [startH, startM] = (cls.time || '08:00').split(':').map(Number);
        firstClassDate.setHours(startH, startM, 0, 0);

        const endClassDate = new Date(firstClassDate);
        endClassDate.setMinutes(endClassDate.getMinutes() + classDurationMinutes);

        const formatIcsTime = (d) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const ss = '00';
            return `${yyyy}${mm}${dd}T${hh}${min}${ss}`;
        };

        const dtStart = formatIcsTime(firstClassDate);
        const dtEnd = formatIcsTime(endClassDate);
        const uid = `${cls.id || 'c_' + Math.random().toString(36).substr(2, 6)}-${Date.now()}@yoklamatakip.local`;

        const event = [
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${nowStamp}`,
            `DTSTART;TZID=Europe/Istanbul:${dtStart}`,
            `DTEND;TZID=Europe/Istanbul:${dtEnd}`,
            `RRULE:FREQ=WEEKLY;COUNT=${totalWeeks}`,
            `SUMMARY:${cls.name}`,
            'DESCRIPTION:YoklamaTakip ders programından aktarıldı',
            'STATUS:CONFIRMED',
            'END:VEVENT'
        ].join('\r\n');

        eventsIcs.push(event);
    });

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//YoklamaTakip//Ders Programi//TR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Ders Programı',
        'X-WR-TIMEZONE:Europe/Istanbul',
        eventsIcs.join('\r\n'),
        'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ders_programi.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    document.getElementById('calendarExportModal').classList.remove('active');
    triggerHaptic('success');
    showToast('Ders programı .ICS takvim dosyası olarak indirildi!');
}

/* ==========================================================================
   SCHEDULE WALLPAPER / STORY GENERATOR (MULTI-FORMAT: 9:16, 16:9, 1:1, 3:4)
   ========================================================================== */
/* ==========================================================================
   SCHEDULE WALLPAPER / STORY GENERATOR (MULTI-FORMAT & AUTO-DETECT)
   ========================================================================== */
window.currentStoryRatio = 'device';

const RESOLUTION_PRESETS = {
    'device': {
        label: 'Cihazım',
        dim: 'Otomatik',
        isDevice: true,
        getDimensions: () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 3);
            let w = Math.round((window.screen.width || 390) * dpr);
            let h = Math.round((window.screen.height || 844) * dpr);
            if (h > w && w < 1080) {
                const s = 1080 / w;
                w = 1080;
                h = Math.round(h * s);
            } else if (w > h && h < 1080) {
                const s = 1080 / h;
                h = 1080;
                w = Math.round(w * s);
            }
            return { w, h, isLandscape: w > h, isSquare: Math.abs(w - h) < 100 };
        }
    },
    '20:9': { label: '20:9', dim: '1080×2400', w: 1080, h: 2400, isLandscape: false },
    '19.5:9': { label: '19.5:9', dim: '1170×2532', w: 1170, h: 2532, isLandscape: false },
    '21:9_phone': { label: '21:9 Uzun', dim: '1080×2520', w: 1080, h: 2520, isLandscape: false },
    '9:16': { label: '9:16 Story', dim: '1080×1920', w: 1080, h: 1920, isLandscape: false },
    '16:9': { label: '16:9 PC', dim: '1920×1080', w: 1920, h: 1080, isLandscape: true },
    '16:9_2k': { label: '16:9 2K', dim: '2560×1440', w: 2560, h: 1440, isLandscape: true },
    '16:10': { label: '16:10', dim: '2560×1600', w: 2560, h: 1600, isLandscape: true },
    '21:9_desktop': { label: '21:9 UW', dim: '2560×1080', w: 2560, h: 1080, isLandscape: true },
    '1:1': { label: '1:1 Kare', dim: '1080×1080', w: 1080, h: 1080, isLandscape: false, isSquare: true },
    '3:4': { label: '3:4 Belge', dim: '1200×1600', w: 1200, h: 1600, isLandscape: false }
};

function detectBestDeviceFormat() {
    const sw = window.screen.width || window.innerWidth || 390;
    const sh = window.screen.height || window.innerHeight || 844;
    const isLandscape = sw > sh;
    
    if (isLandscape) {
        const ratio = sw / sh;
        if (ratio >= 2.05) return '21:9_desktop';
        if (ratio >= 1.55 && ratio <= 1.7) return '16:10';
        return '16:9';
    } else {
        const ratio = sh / sw;
        if (ratio >= 2.2) return '21:9_phone';
        if (ratio >= 2.05) return '20:9';
        if (ratio >= 1.9) return '19.5:9';
        if (ratio >= 1.6) return '9:16';
        if (ratio <= 1.45) return '3:4';
        return 'device';
    }
}

function setupStoryStudio() {
    // Ready
}

function renderStudioResolutions() {
    const container = document.getElementById('storyChipsScroll');
    if (!container) return;

    container.innerHTML = '';
    const detectedKey = detectBestDeviceFormat();
    const currentRatio = window.currentStoryRatio || detectedKey;

    Object.entries(RESOLUTION_PRESETS).forEach(([key, preset]) => {
        const isActive = (key === currentRatio) || (currentRatio === 'device' && preset.isDevice);
        let dimText = preset.dim;
        if (preset.isDevice) {
            const d = preset.getDimensions();
            dimText = `${d.w}×${d.h}`;
        }

        const chip = document.createElement('div');
        chip.className = `story-chip ${isActive ? 'active' : ''}`;
        chip.setAttribute('data-ratio', key);
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');

        chip.innerHTML = `
            <span class="chip-label">${preset.label}</span>
            <span class="chip-dim">${dimText}</span>
        `;

        chip.addEventListener('click', () => {
            window.currentStoryRatio = key;
            triggerHaptic('light');
            container.querySelectorAll('.story-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            renderScheduleStoryImage(key);
        });

        container.appendChild(chip);
    });
}

function openScheduleStoryModal(selectedRatio = null) {
    const data = Storage.load();
    if (!data.classes || data.classes.length === 0) {
        showToast('Önce ders programınıza ders ekleyin.');
        return;
    }

    const detected = detectBestDeviceFormat();
    const ratio = selectedRatio || (window.currentStoryRatio === 'device' ? detected : (window.currentStoryRatio || detected));
    window.currentStoryRatio = ratio;

    renderStudioResolutions();
    renderScheduleStoryImage(ratio);

    // Dynamic stage ambient glow matching active theme
    const currentThemeId = data.theme || 'dark';
    const currentThemeMeta = THEMES_METADATA.find(t => t.id === currentThemeId) || THEMES_METADATA[0];
    const glowEl = document.getElementById('storyStageGlow');
    if (glowEl && currentThemeMeta.primary) {
        glowEl.style.background = `radial-gradient(circle, ${currentThemeMeta.primary} 0%, transparent 70%)`;
    }

    document.getElementById('storyExportModal').classList.add('active');
}

function renderScheduleStoryImage(ratioKey = 'device') {
    const data = Storage.load();
    if (!data.classes || data.classes.length === 0) return;

    const preset = RESOLUTION_PRESETS[ratioKey] || RESOLUTION_PRESETS['device'];
    let W, H, isLandscape = false, isSquare = false;

    if (preset.isDevice) {
        const dims = preset.getDimensions();
        W = dims.w;
        H = dims.h;
        isLandscape = dims.isLandscape;
        isSquare = dims.isSquare;
    } else {
        W = preset.w;
        H = preset.h;
        isLandscape = preset.isLandscape;
        isSquare = !!preset.isSquare;
    }

    // Update floating stage badges
    const detected = detectBestDeviceFormat();
    const isMatch = (ratioKey === detected) || (ratioKey === 'device');

    const badgeEl = document.getElementById('storyStageResBadge');
    if (badgeEl) {
        badgeEl.textContent = `${W} × ${H}`;
    }

    const autoTagEl = document.getElementById('storyStageAutoTag');
    if (autoTagEl) {
        autoTagEl.style.display = isMatch ? 'inline-flex' : 'none';
    }

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const currentThemeId = data.theme || 'dark';
    const currentThemeMeta = THEMES_METADATA.find(t => t.id === currentThemeId) || THEMES_METADATA[0];

    // Theme adaptations
    const isLightTheme = (currentThemeMeta && currentThemeMeta.category === 'light');
    const textColorMain = isLightTheme ? '#0f172a' : '#ffffff';
    const textColorMuted = isLightTheme ? '#475569' : 'rgba(255, 255, 255, 0.65)';
    const cardGlassBg = isLightTheme ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.05)';
    const cardGlassBorder = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.13)';

    // 1. Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, currentThemeMeta.bg);
    bgGrad.addColorStop(1, isLightTheme ? '#f1f5f9' : '#080c14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Decorative mesh orbs
    const maxDim = Math.max(W, H);
    const orb1 = ctx.createRadialGradient(W * 0.2, H * 0.18, 0, W * 0.2, H * 0.18, maxDim * 0.35);
    orb1.addColorStop(0, currentThemeMeta.primary + '35');
    orb1.addColorStop(1, 'transparent');
    ctx.fillStyle = orb1;
    ctx.beginPath();
    ctx.arc(W * 0.2, H * 0.18, maxDim * 0.35, 0, Math.PI * 2);
    ctx.fill();

    const orb2 = ctx.createRadialGradient(W * 0.82, H * 0.82, 0, W * 0.82, H * 0.82, maxDim * 0.3);
    orb2.addColorStop(0, currentThemeMeta.primary + '25');
    orb2.addColorStop(1, 'transparent');
    ctx.fillStyle = orb2;
    ctx.beginPath();
    ctx.arc(W * 0.82, H * 0.82, maxDim * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Days to show
    const daysToShow = [1, 2, 3, 4, 5];
    if (data.classes.some(c => c.day === 6)) daysToShow.push(6);
    if (data.classes.some(c => c.day === 0)) daysToShow.push(0);

    const dayNamesTr = {
        1: 'PAZARTESİ',
        2: 'SALI',
        3: 'ÇARŞAMBA',
        4: 'PERŞEMBE',
        5: 'CUMA',
        6: 'CUMARTESİ',
        0: 'PAZAR'
    };

    // RENDER BASED ON ORIENTATION / RATIO
    if (isLandscape) {
        // ==================== LANDSCAPE (DESKTOP / ULTRAWIDE / TABLET) ====================
        const scaleX = W / 1920;
        const scaleY = H / 1080;

        // Header
        ctx.textAlign = 'center';
        ctx.fillStyle = currentThemeMeta.primary;
        ctx.font = `bold ${Math.round(18 * scaleY)}px Outfit, sans-serif`;
        ctx.fillText('YOKLAMA TAKİP', W / 2, Math.round(40 * scaleY));

        ctx.fillStyle = textColorMain;
        ctx.font = `bold ${Math.round(36 * scaleY)}px Outfit, sans-serif`;
        ctx.fillText('HAFTALIK DERS PROGRAMI', W / 2, Math.round(80 * scaleY));

        ctx.fillStyle = textColorMuted;
        ctx.font = `500 ${Math.round(18 * scaleY)}px Outfit, sans-serif`;
        ctx.fillText('2026 - 2027 Akademik Takvim', W / 2, Math.round(112 * scaleY));

        const numCols = daysToShow.length;
        const marginX = Math.round(46 * scaleX);
        const availableW = W - marginX * 2;
        const colGap = Math.round(16 * scaleX);
        const colW = Math.floor((availableW - (numCols - 1) * colGap) / numCols);
        const startY = Math.round(140 * scaleY);
        const colH = H - startY - Math.round(55 * scaleY);

        daysToShow.forEach((dayIdx, i) => {
            const colX = marginX + i * (colW + colGap);
            const dayClasses = data.classes.filter(c => c.day === dayIdx).sort((a, b) => a.time.localeCompare(b.time));

            // Column container
            ctx.fillStyle = cardGlassBg;
            ctx.strokeStyle = cardGlassBorder;
            ctx.lineWidth = 1.5;
            drawRoundRect(ctx, colX, startY, colW, colH, 18, true, true);

            // Day header bar
            const headerBarH = Math.round(46 * scaleY);
            ctx.fillStyle = currentThemeMeta.primary + '22';
            drawRoundRect(ctx, colX + 10, startY + 10, colW - 20, headerBarH, 12, true, false);

            ctx.textAlign = 'left';
            ctx.fillStyle = textColorMain;
            ctx.font = `bold ${Math.round(18 * scaleY)}px Outfit, sans-serif`;
            ctx.fillText(dayNamesTr[dayIdx], colX + 22, startY + Math.round(38 * scaleY));

            // Class count badge
            ctx.textAlign = 'right';
            ctx.fillStyle = currentThemeMeta.primary;
            ctx.font = `bold ${Math.round(14 * scaleY)}px Outfit, sans-serif`;
            ctx.fillText(dayClasses.length > 0 ? `${dayClasses.length} DERS` : 'BOŞ', colX + colW - 22, startY + Math.round(38 * scaleY));

            // Classes list (Snug, alt alta, zero empty gap!)
            if (dayClasses.length === 0) {
                ctx.textAlign = 'center';
                ctx.fillStyle = textColorMuted;
                ctx.font = `italic ${Math.round(16 * scaleY)}px Outfit, sans-serif`;
                ctx.fillText('Ders planlanmadı', colX + colW / 2, startY + Math.round(100 * scaleY));
            } else {
                const classesTopY = startY + headerBarH + Math.round(18 * scaleY);
                const rowH = Math.round(48 * scaleY);
                const rowGap = Math.round(8 * scaleY);

                dayClasses.forEach((cls, cIdx) => {
                    const rowY = classesTopY + cIdx * (rowH + rowGap);
                    if (rowY + rowH > startY + colH - 10) return;

                    // Row background
                    ctx.fillStyle = isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)';
                    drawRoundRect(ctx, colX + 10, rowY, colW - 20, rowH, 10, true, false);

                    // Time badge
                    const timeBadgeW = Math.round(66 * scaleX);
                    const timeBadgeH = Math.round(32 * scaleY);
                    ctx.fillStyle = currentThemeMeta.primary + '25';
                    drawRoundRect(ctx, colX + 16, rowY + Math.round(8 * scaleY), timeBadgeW, timeBadgeH, 8, true, false);

                    ctx.textAlign = 'center';
                    ctx.fillStyle = currentThemeMeta.primary;
                    ctx.font = `bold ${Math.round(15 * scaleY)}px Outfit, sans-serif`;
                    ctx.fillText(cls.time, colX + 16 + timeBadgeW / 2, rowY + Math.round(29 * scaleY));

                    // Class name
                    ctx.textAlign = 'left';
                    ctx.fillStyle = textColorMain;
                    ctx.font = `600 ${Math.round(17 * scaleY)}px Outfit, sans-serif`;
                    let name = cls.name;
                    const maxChars = colW > 320 ? 22 : 15;
                    if (name.length > maxChars) name = name.substring(0, maxChars - 2) + '...';
                    ctx.fillText(name, colX + timeBadgeW + 26, rowY + Math.round(30 * scaleY));
                });
            }
        });

        // Footer
        ctx.textAlign = 'center';
        ctx.fillStyle = textColorMuted;
        ctx.font = `500 ${Math.round(16 * scaleY)}px Outfit, sans-serif`;
        ctx.fillText('YoklamaTakip • Masaüstü / Monitör Takvimi', W / 2, H - Math.round(22 * scaleY));

    } else if (isSquare) {
        // ==================== SQUARE FORMAT (1:1) ====================
        ctx.textAlign = 'center';
        ctx.fillStyle = currentThemeMeta.primary;
        ctx.font = 'bold 18px Outfit, sans-serif';
        ctx.fillText('YOKLAMA TAKİP', W / 2, 45);

        ctx.fillStyle = textColorMain;
        ctx.font = 'bold 36px Outfit, sans-serif';
        ctx.fillText('HAFTALIK DERS PROGRAMI', W / 2, 85);

        ctx.fillStyle = textColorMuted;
        ctx.font = '500 17px Outfit, sans-serif';
        ctx.fillText('2026 - 2027 Akademik Takvim', W / 2, 115);

        const midPoint = Math.ceil(daysToShow.length / 2);
        const col1Days = daysToShow.slice(0, midPoint);
        const col2Days = daysToShow.slice(midPoint);

        const marginX = 40;
        const colGap = 20;
        const colW = Math.floor((W - marginX * 2 - colGap) / 2);
        const startY = 140;

        const renderSquareColumn = (colDays, colStartX) => {
            let curY = startY;
            colDays.forEach(dayIdx => {
                const dayClasses = data.classes.filter(c => c.day === dayIdx).sort((a, b) => a.time.localeCompare(b.time));
                const dayH = dayClasses.length === 0 ? 68 : (48 + dayClasses.length * 44 + 8);

                // Day card
                ctx.fillStyle = cardGlassBg;
                ctx.strokeStyle = cardGlassBorder;
                ctx.lineWidth = 1.5;
                drawRoundRect(ctx, colStartX, curY, colW, dayH, 16, true, true);

                // Day header indicator
                ctx.fillStyle = currentThemeMeta.primary;
                drawRoundRect(ctx, colStartX + 14, curY + 12, 4, 22, 2, true, false);

                ctx.textAlign = 'left';
                ctx.fillStyle = textColorMain;
                ctx.font = 'bold 18px Outfit, sans-serif';
                ctx.fillText(dayNamesTr[dayIdx], colStartX + 26, curY + 29);

                ctx.textAlign = 'right';
                ctx.fillStyle = currentThemeMeta.primary;
                ctx.font = 'bold 13px Outfit, sans-serif';
                ctx.fillText(dayClasses.length > 0 ? `${dayClasses.length} DERS` : 'BOŞ', colStartX + colW - 16, curY + 29);

                // Classes
                if (dayClasses.length === 0) {
                    ctx.textAlign = 'left';
                    ctx.fillStyle = textColorMuted;
                    ctx.font = 'italic 15px Outfit, sans-serif';
                    ctx.fillText('Ders planlanmadı', colStartX + 26, curY + 54);
                } else {
                    const classStartY = curY + 44;
                    const rowH = 38;
                    const rowGap = 6;

                    dayClasses.forEach((cls, cIdx) => {
                        const rowY = classStartY + cIdx * (rowH + rowGap);

                        // Time badge
                        ctx.fillStyle = currentThemeMeta.primary + '25';
                        drawRoundRect(ctx, colStartX + 14, rowY + 4, 60, 28, 6, true, false);

                        ctx.textAlign = 'center';
                        ctx.fillStyle = currentThemeMeta.primary;
                        ctx.font = 'bold 14px Outfit, sans-serif';
                        ctx.fillText(cls.time, colStartX + 44, rowY + 23);

                        // Class name
                        ctx.textAlign = 'left';
                        ctx.fillStyle = textColorMain;
                        ctx.font = '600 16px Outfit, sans-serif';
                        let name = cls.name;
                        if (name.length > 22) name = name.substring(0, 20) + '...';
                        ctx.fillText(name, colStartX + 82, rowY + 24);
                    });
                }

                curY += dayH + 12;
            });
        };

        renderSquareColumn(col1Days, marginX);
        renderSquareColumn(col2Days, marginX + colW + colGap);

        // Footer
        ctx.textAlign = 'center';
        ctx.fillStyle = textColorMuted;
        ctx.font = '500 16px Outfit, sans-serif';
        ctx.fillText('YoklamaTakip • Kare Takvim', W / 2, 1050);

    } else {
        // ==================== PORTRAIT (9:16, 19.5:9, 20:9, 21:9 PHONE, 3:4) ====================
        const scale = W / 1080;
        const cardW = Math.round(W * 0.90);
        const cardX = (W - cardW) / 2;
        const topBadgeY = Math.round(80 * (H / 1920));

        // Top Badge
        const badgeW = Math.round(280 * scale);
        const badgeH = Math.round(42 * scale);
        ctx.fillStyle = currentThemeMeta.primary + '25';
        ctx.strokeStyle = currentThemeMeta.primary + '66';
        ctx.lineWidth = 1.5;
        drawRoundRect(ctx, (W - badgeW) / 2, topBadgeY, badgeW, badgeH, Math.round(badgeH / 2), true, true);

        ctx.textAlign = 'center';
        ctx.fillStyle = currentThemeMeta.primary;
        ctx.font = `bold ${Math.round(18 * scale)}px Outfit, sans-serif`;
        ctx.fillText('YOKLAMA TAKİP', W / 2, topBadgeY + Math.round(27 * scale));

        // Title & Subtitle
        ctx.fillStyle = textColorMain;
        ctx.font = `bold ${Math.round(48 * scale)}px Outfit, sans-serif`;
        ctx.fillText('HAFTALIK DERS PROGRAMI', W / 2, topBadgeY + Math.round(95 * scale));

        ctx.fillStyle = textColorMuted;
        ctx.font = `500 ${Math.round(22 * scale)}px Outfit, sans-serif`;
        ctx.fillText('2026 - 2027 Akademik Takvim', W / 2, topBadgeY + Math.round(140 * scale));

        // Calculate snug day heights (Alt alta, zero empty gap!)
        const headerH = Math.round(50 * scale);
        const rowH = Math.round(44 * scale);
        const rowGap = Math.round(6 * scale);

        const dayHeights = daysToShow.map(dayIdx => {
            const dayClasses = data.classes.filter(c => c.day === dayIdx);
            if (dayClasses.length === 0) return Math.round(80 * scale);
            return headerH + dayClasses.length * (rowH + rowGap) + Math.round(10 * scale);
        });

        const totalCardsH = dayHeights.reduce((acc, h) => acc + h, 0);
        const topLimit = topBadgeY + Math.round(185 * scale);
        const bottomLimit = H - Math.round(75 * scale);
        const availableSpace = bottomLimit - topLimit;
        const cardGap = Math.min(Math.round(24 * scale), Math.max(Math.round(10 * scale), Math.floor((availableSpace - totalCardsH) / (daysToShow.length - 1))));
        const startY = Math.max(topLimit, topLimit + Math.floor((availableSpace - (totalCardsH + (daysToShow.length - 1) * cardGap)) / 2));

        let currentY = startY;
        daysToShow.forEach((dayIdx, i) => {
            const dayH = dayHeights[i];
            const dayClasses = data.classes.filter(c => c.day === dayIdx).sort((a, b) => a.time.localeCompare(b.time));

            // Day Glass Card
            ctx.fillStyle = cardGlassBg;
            ctx.strokeStyle = cardGlassBorder;
            ctx.lineWidth = 1.5;
            drawRoundRect(ctx, cardX, currentY, cardW, dayH, 18, true, true);

            // Day accent indicator line
            ctx.fillStyle = currentThemeMeta.primary;
            drawRoundRect(ctx, cardX + Math.round(22 * scale), currentY + Math.round(16 * scale), Math.round(5 * scale), Math.round(24 * scale), 3, true, false);

            // Day name
            ctx.textAlign = 'left';
            ctx.fillStyle = textColorMain;
            ctx.font = `bold ${Math.round(24 * scale)}px Outfit, sans-serif`;
            ctx.fillText(dayNamesTr[dayIdx], cardX + Math.round(38 * scale), currentY + Math.round(36 * scale));

            // Class count badge
            ctx.textAlign = 'right';
            ctx.fillStyle = currentThemeMeta.primary;
            ctx.font = `bold ${Math.round(16 * scale)}px Outfit, sans-serif`;
            ctx.fillText(dayClasses.length > 0 ? `${dayClasses.length} DERS` : 'BOŞ GÜN', cardX + cardW - Math.round(24 * scale), currentY + Math.round(36 * scale));

            // Classes list (DIRECTLY alt alta, zero empty gap!)
            if (dayClasses.length === 0) {
                ctx.textAlign = 'left';
                ctx.fillStyle = textColorMuted;
                ctx.font = `italic ${Math.round(20 * scale)}px Outfit, sans-serif`;
                ctx.fillText('Ders planlanmadı', cardX + Math.round(38 * scale), currentY + Math.round(62 * scale));
            } else {
                const classStartY = currentY + headerH;

                dayClasses.forEach((cls, cIdx) => {
                    const rowY = classStartY + cIdx * (rowH + rowGap);

                    // Row background
                    ctx.fillStyle = isLightTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
                    drawRoundRect(ctx, cardX + Math.round(16 * scale), rowY, cardW - Math.round(32 * scale), rowH, 10, true, false);

                    // Time badge
                    const tbW = Math.round(78 * scale);
                    const tbH = Math.round(30 * scale);
                    ctx.fillStyle = currentThemeMeta.primary + '28';
                    drawRoundRect(ctx, cardX + Math.round(24 * scale), rowY + Math.round(7 * scale), tbW, tbH, 8, true, false);

                    ctx.textAlign = 'center';
                    ctx.fillStyle = currentThemeMeta.primary;
                    ctx.font = `bold ${Math.round(17 * scale)}px Outfit, sans-serif`;
                    ctx.fillText(cls.time, cardX + Math.round(24 * scale) + tbW / 2, rowY + Math.round(28 * scale));

                    // Class name
                    ctx.textAlign = 'left';
                    ctx.fillStyle = textColorMain;
                    ctx.font = `600 ${Math.round(21 * scale)}px Outfit, sans-serif`;
                    let name = cls.name;
                    const maxChars = Math.round(38 * scale);
                    if (name.length > maxChars) name = name.substring(0, maxChars - 2) + '...';
                    ctx.fillText(name, cardX + tbW + Math.round(38 * scale), rowY + Math.round(29 * scale));
                });
            }

            currentY += dayH + cardGap;
        });

        // Footer
        ctx.textAlign = 'center';
        ctx.fillStyle = textColorMuted;
        ctx.font = `500 ${Math.round(20 * scale)}px Outfit, sans-serif`;
        ctx.fillText('YoklamaTakip • Kilit Ekranı ve Story Takvimi', W / 2, H - Math.round(32 * scale));
    }

    // Export image & update download button
    const dataUrl = canvas.toDataURL('image/png');
    const previewImg = document.getElementById('storyPreviewImg');
    if (previewImg) previewImg.src = dataUrl;
    const handleDownload = () => {
        const link = document.createElement('a');
        link.download = `haftalik_program_${ratioKey.replace(/[:.]/g, '_')}_${W}x${H}.png`;
        link.href = dataUrl;
        link.click();
        triggerHaptic('success');
        showToast(`Program görseli indirildi!`);
    };

    const dlBtn = document.getElementById('btnDownloadStoryImage');
    if (dlBtn) {
        dlBtn.innerHTML = `<i data-lucide="download"></i> Görseli İndir`;
        dlBtn.onclick = handleDownload;
    }

    lucide.createIcons();
}

function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') stroke = true;
    if (typeof radius === 'undefined') radius = 5;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

