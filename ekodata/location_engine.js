/**
 * EkoGokhan Location Engine v2.0
 * ==============================
 * Tüm uygulamada TEK bir GPS bağlantısı açar.
 * Diğer modüller (EkoRota, EkoStop, EkoHarita) GPS'e hiç dokunmaz,
 * sadece bu motorun yayınladığı 'ekoLocationUpdate' eventini dinler.
 *
 * Platform Desteği:
 *  - Android/iOS (Capacitor Native): @capacitor/geolocation
 *  - Web Tarayıcı: navigator.geolocation
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'ekoUserLocation';
  const EVENT_UPDATE = 'ekoLocationUpdate';
  const EVENT_ERROR  = 'ekoLocationError';

  const EkoLocation = {
    _watchId: null,
    _isNative: false,

    // ─────────────────────────────────────
    // Platform tespiti
    // ─────────────────────────────────────
    _detectPlatform() {
      this._isNative = !!(
        window.Capacitor &&
        window.Capacitor.isNativePlatform() &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.Geolocation
      );
    },

    // ─────────────────────────────────────
    // İzin durumunu kontrol et
    // ─────────────────────────────────────
    async checkPermission() {
      this._detectPlatform();
      try {
        if (this._isNative) {
          const p = await window.Capacitor.Plugins.Geolocation.checkPermissions();
          return p.location; // 'granted' | 'denied' | 'prompt'
        }
        if (navigator.permissions) {
          const r = await navigator.permissions.query({ name: 'geolocation' });
          return r.state; // 'granted' | 'denied' | 'prompt'
        }
      } catch (e) { /* ignore */ }
      return 'prompt';
    },

    // ─────────────────────────────────────
    // İzin iste
    // ─────────────────────────────────────
    async requestPermission() {
      this._detectPlatform();
      try {
        if (this._isNative) {
          // Capacitor'ın requestPermissions metodu bazı Android sürümlerinde askıda kalabiliyor.
          // watchPosition zaten izin isteyeceği için burada çok beklemeden devam edebiliriz.
          const p = await Promise.race([
            window.Capacitor.Plugins.Geolocation.requestPermissions(),
            new Promise(r => setTimeout(() => r({ location: 'granted' }), 2000))
          ]);
          return p.location || 'granted';
        }
        // Web: doğrudan watchPosition tetiklemek izin penceresini açar
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve('granted'),
            (err) => resolve(err.code === 1 ? 'denied' : 'prompt'),
            { timeout: 15000, enableHighAccuracy: false }
          );
        });
      } catch (e) {
        return 'denied';
      }
    },

    // ─────────────────────────────────────
    // Motoru Başlat (idempotent — tekrar çağrılsa bile 2. bağlantı açılmaz)
    // ─────────────────────────────────────
    start() {
      if (this._watchId !== null) return; // Zaten çalışıyor
      this._detectPlatform();

      const onSuccess = (pos) => {
        // Capacitor ile gelen koordinat yapısı biraz farklı
        const lat = pos.coords ? pos.coords.latitude  : pos.latitude;
        const lng = pos.coords ? pos.coords.longitude : pos.longitude;
        const acc = pos.coords ? pos.coords.accuracy  : pos.accuracy;

        const data = { lat, lng, accuracy: acc, timestamp: Date.now() };

        // 1. SessionStorage (hız): Aynı oturumda en güncel
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        // 2. LocalStorage (kalıcılık): Uygulama kapatılıp açılsa bile hatırla
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // 3. Tüm sayfalara sinyal gönder
        window.dispatchEvent(new CustomEvent(EVENT_UPDATE, { detail: data }));
      };

      const onError = (err) => {
        console.warn('[EkoLocation] GPS Hatası:', err.message || err);
        window.dispatchEvent(new CustomEvent(EVENT_ERROR, { detail: err }));
      };

      if (this._isNative) {
        // Android/iOS: Capacitor Native GPS (çok daha stabil)
        window.Capacitor.Plugins.Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 20000 },
          (pos, err) => {
            if (err) onError(err);
            else if (pos) onSuccess(pos);
          }
        ).then((id) => { this._watchId = id; });
      } else {
        // Web Tarayıcı: Standart API
        this._watchId = navigator.geolocation.watchPosition(
          onSuccess,
          onError,
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
        );
      }
    },

    // ─────────────────────────────────────
    // Motoru Durdur
    // ─────────────────────────────────────
    stop() {
      if (this._watchId === null) return;
      if (this._isNative) {
        window.Capacitor.Plugins.Geolocation.clearWatch({ id: this._watchId });
      } else {
        navigator.geolocation.clearWatch(this._watchId);
      }
      this._watchId = null;
    },

    // ─────────────────────────────────────
    // Son Bilinen Konumu Anında Getir (0ms bekleme)
    // ─────────────────────────────────────
    getLast() {
      try {
        const s = sessionStorage.getItem(STORAGE_KEY);
        if (s) return JSON.parse(s); // Öncelik: aynı oturum (en güncel)
        const l = localStorage.getItem(STORAGE_KEY);
        if (l) return JSON.parse(l); // Yedek: önceki oturum
      } catch (e) { /* ignore */ }
      return null;
    },

    // ─────────────────────────────────────
    // Güncelleme Dinleyicisi (+ anında mevcut konum)
    //   callback({ lat, lng, accuracy, timestamp })
    // ─────────────────────────────────────
    onUpdate(callback) {
      window.addEventListener(EVENT_UPDATE, (e) => callback(e.detail));

      // Anında son konumu ver — sayfa açılır açılmaz beklemeden çalış
      const last = this.getLast();
      if (last) {
        // Micro-task olarak çalıştır, listener'ların kayıt bitmesini bekle
        Promise.resolve().then(() => callback(last));
      }
    },

    // ─────────────────────────────────────
    // Hata Dinleyicisi
    // ─────────────────────────────────────
    onError(callback) {
      window.addEventListener(EVENT_ERROR, (e) => callback(e.detail));
    }
  };

  // Global olarak eriş
  window.EkoLocation = EkoLocation;

  // ─────────────────────────────────────
  // Otomatik Başlatma (Sayfa Yüklenmesinde)
  // Eğer localStorage'da eski bir konum varsa ve izin 'granted' ise
  // motor kendiliğinden başlar. Geri butonu ile dönülen sayfalarda
  // konumun kaybolmaması için kritik.
  // ─────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    const last = EkoLocation.getLast();
    if (!last) return; // Daha önce hiç konum alınmamış, EkoArama izin akışı yönetecek

    // localStorage'da konum var → İzin daha önce verilmiş demek
    // Motoru sessizce yeniden başlat
    const status = await EkoLocation.checkPermission();
    if (status === 'granted') {
      EkoLocation.start();
    }
  });

})();
