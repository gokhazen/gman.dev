/**
 * Storage.js
 * Handles localStorage operations, data structuring, and Export/Import.
 */

const STORAGE_KEY = 'yoklama_takip_data';

const getEmptyData = () => ({
    classes: [], 
    attendance: {},
    theme: 'dark'
});

// Prebuilt Schedules are now fetched dynamically via API.


const Storage = {
    load: () => {
        try {
            const dataStr = localStorage.getItem(STORAGE_KEY);
            if (!dataStr) return getEmptyData();
            const parsed = JSON.parse(dataStr);
            if (!parsed.theme) parsed.theme = 'dark';
            return parsed;
        } catch (e) {
            console.error("Error loading data:", e);
            return getEmptyData();
        }
    },

    save: (data) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error("Error saving data:", e);
        }
    },

    addClass: (newClass) => {
        const data = Storage.load();
        newClass.id = 'cls_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        data.classes.push(newClass);
        data.classes.sort((a, b) => a.time.localeCompare(b.time));
        Storage.save(data);
        return newClass;
    },

    deleteClass: (classId) => {
        const data = Storage.load();
        data.classes = data.classes.filter(c => c.id !== classId);
        delete data.attendance[classId];
        Storage.save(data);
    },

    editClass: (classId, updatedData) => {
        const data = Storage.load();
        const index = data.classes.findIndex(c => c.id === classId);
        if (index !== -1) {
            data.classes[index] = { ...data.classes[index], ...updatedData };
            data.classes.sort((a, b) => a.time.localeCompare(b.time));
            Storage.save(data);
            return true;
        }
        return false;
    },

    markAttendance: (classId, dateStr, status) => {
        const data = Storage.load();
        if (!data.attendance[classId]) {
            data.attendance[classId] = {};
        }
        
        if (data.attendance[classId][dateStr] === status) {
            delete data.attendance[classId][dateStr];
        } else {
            data.attendance[classId][dateStr] = status;
        }
        Storage.save(data);
    },

    clearAll: () => {
        localStorage.removeItem(STORAGE_KEY);
    },

    // --- EXPORT / IMPORT ALL DATA ---

        generateExportHash: () => {
        const data = Storage.load();
        data.exportedAt = Date.now();
        const jsonStr = JSON.stringify(data);
        if (typeof LZString !== 'undefined') {
            return LZString.compressToEncodedURIComponent(jsonStr);
        }
        return btoa(encodeURIComponent(jsonStr));
    },

    exportToImage: () => {
        const hash = Storage.generateExportHash();
        const dataStr = 'YKLM' + hash + '\0'; 
        
        const nibbles = [];
        for (let i = 0; i < dataStr.length; i++) {
            const code = dataStr.charCodeAt(i);
            nibbles.push(code >> 4);
            nibbles.push(code & 15);
        }
        
        const totalChannels = nibbles.length;
        const totalPixelsRequired = Math.ceil(totalChannels / 3);
        const dim = Math.max(10, Math.ceil(Math.sqrt(totalPixelsRequired)));
        
        const canvas = document.createElement('canvas');
        canvas.width = dim;
        canvas.height = dim;
        const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
        const imgData = ctx.createImageData(dim, dim);
        const data = imgData.data;
        
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
            data[i]   = n < nibbles.length ? nibbles[n++] * 17 : Math.floor(Math.random() * 256);
            data[i+1] = n < nibbles.length ? nibbles[n++] * 17 : Math.floor(Math.random() * 256);
            data[i+2] = n < nibbles.length ? nibbles[n++] * 17 : Math.floor(Math.random() * 256);
            data[i+3] = 255;
        }
        
        ctx.putImageData(imgData, 0, 0);
        return canvas.toDataURL('image/png');
    },

    importFromImage: (dataURL, callback) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true, colorSpace: 'srgb' });
            ctx.drawImage(img, 0, 0);
            
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imgData.data;
            
            // Try robust decode first
            let resultRobust = '';
            let nibbles = [];
            for (let i = 0; i < data.length; i += 4) {
                nibbles.push(Math.round(data[i] / 17));
                nibbles.push(Math.round(data[i+1] / 17));
                nibbles.push(Math.round(data[i+2] / 17));
            }
            
            for (let i = 0; i < nibbles.length - 1; i += 2) {
                const high = nibbles[i] || 0;
                const low = nibbles[i+1] || 0;
                const cHigh = Math.max(0, Math.min(15, high));
                const cLow = Math.max(0, Math.min(15, low));
                const code = (cHigh << 4) | cLow;
                if (code === 0) break;
                resultRobust += String.fromCharCode(code);
            }
            
            if (resultRobust.startsWith('YKLM')) {
                if (callback) callback(resultRobust.substring(4));
                return;
            }
            
            // Fallback to old decode
            let resultOld = '';
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] === 0) break;
                resultOld += String.fromCharCode(data[i]);
                
                if (data[i+1] === 0) break;
                resultOld += String.fromCharCode(data[i+1]);
                
                if (data[i+2] === 0) break;
                resultOld += String.fromCharCode(data[i+2]);
            }
            
            if (callback) callback(resultOld);
        };
        img.onerror = () => {
            if (callback) callback(null);
        };
        img.src = dataURL;
    },

    previewHash: (hash) => {
        try {
            let cleanHash = hash.trim();
            if (cleanHash.includes('#import=')) {
                cleanHash = cleanHash.split('#import=')[1];
            }

            let decoded = null;

            // Önce LZString ile çözmeyi dene (generateExportHash LZString kullanıyor)
            if (typeof LZString !== 'undefined') {
                decoded = LZString.decompressFromEncodedURIComponent(cleanHash);
            }

            // LZString başarısız olduysa veya mevcut değilse btoa ile dene
            if (!decoded) {
                try {
                    decoded = decodeURIComponent(atob(cleanHash));
                } catch(e2) {
                    return false;
                }
            }

            const parsedData = JSON.parse(decoded);
            if (parsedData && Array.isArray(parsedData.classes)) {
                return {
                    isScheduleOnly: !!parsedData.isScheduleOnly,
                    exportedAt: parsedData.exportedAt || null
                };
            }
            return false;
        } catch(e) {
            return false;
        }
    },

        importFromHash: (hash) => {
        try {
            let cleanHash = hash.trim();
            if (cleanHash.includes('#import=')) {
                cleanHash = cleanHash.split('#import=')[1];
            }
            let decoded = null;
            if (typeof LZString !== 'undefined') {
                decoded = LZString.decompressFromEncodedURIComponent(cleanHash);
            }
            if (!decoded) {
                decoded = decodeURIComponent(atob(cleanHash));
            }
            const parsedData = JSON.parse(decoded);
            if (parsedData && Array.isArray(parsedData.classes) && typeof parsedData.attendance === 'object') {
                Storage.save(parsedData);
                return true;
            }
            return false;
        } catch (e) {
            console.error("Import error:", e);
            return false;
        }
    },

    // --- EXPORT / IMPORT SCHEDULE ONLY ---

    generateScheduleHash: () => {
        const data = Storage.load();
        const scheduleOnly = { isScheduleOnly: true, classes: data.classes };
        return btoa(encodeURIComponent(JSON.stringify(scheduleOnly)));
    },

    importScheduleHash: (hash, append = false) => {
        try {
            let cleanHash = hash.trim();
            if (cleanHash.includes('#import=')) {
                cleanHash = cleanHash.split('#import=')[1];
            }
            const decoded = decodeURIComponent(atob(cleanHash));
            const parsedData = JSON.parse(decoded);
            
            if (parsedData && Array.isArray(parsedData.classes)) {
                const currentData = Storage.load();
                
                let newClasses;
                if (append) {
                    newClasses = parsedData.classes.map(c => ({
                        ...c,
                        id: 'cls_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                    }));
                    currentData.classes = [...currentData.classes, ...newClasses];
                } else {
                    newClasses = parsedData.classes; // Keep original IDs
                    currentData.classes = newClasses;
                    currentData.attendance = {}; 
                }
                
                currentData.classes.sort((a, b) => a.time.localeCompare(b.time));
                Storage.save(currentData);
                return true;
            }
            return false;
        } catch (e) {
            console.error("Import schedule error:", e);
            return false;
        }
    },

    importPrebuilt: (classesData, append = false) => {
        try {
            const currentData = Storage.load();
            
            let newClasses;
            if (append) {
                newClasses = classesData.map(c => ({
                    ...c,
                    id: 'cls_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                }));
                currentData.classes = [...currentData.classes, ...newClasses];
            } else {
                newClasses = classesData.map(c => ({
                    ...c,
                    id: 'cls_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
                })); 
                currentData.classes = newClasses;
                currentData.attendance = {}; // Clear attendance to prevent ghost data
            }
            
            Storage.save(currentData);
            return true;
        } catch (e) {
            console.error(e);
            return false;
        }
    },

    // getPrebuiltList has been removed because it is now fetched via API

    // --- STATS ---

    getClassStats: (classId) => {
        const data = Storage.load();
        const records = data.attendance[classId] || {};
        let present = 0, absent = 0, excused = 0, proxy = 0, canceled = 0;
        let absentDates = [];

        Object.entries(records).forEach(([dateStr, status]) => {
            if (status === 'present') present++;
            else if (status === 'absent') {
                absent++;
                absentDates.push(dateStr);
            }
            else if (status === 'excused') excused++;
            else if (status === 'proxy') proxy++;
            else if (status === 'canceled') canceled++;
        });

        const cls = data.classes.find(c => c.id === classId);
        const limit = cls ? parseInt(cls.absenceLimit) || 4 : 4;
        const dangerPercentage = Math.min(100, (absent / limit) * 100);

        // Proxy counts as present for display
        const totalPresentDisplay = present + proxy;

        return { present: totalPresentDisplay, absent, excused, proxy, canceled, limit, dangerPercentage, absentDates };
    }
};

window.Storage = Storage;
