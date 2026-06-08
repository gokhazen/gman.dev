/**
 * EkoGokhan Project Loader
 * Tüm sayfalarda ortak yüklenen başlangıç scripti.
 * Konum işlemleri -> location_engine.js'e taşındı.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ── Proje Bilgisi ────────────────────────────────────────────
    try {
        const res  = await fetch('../ekodata/projectinfo.json');
        const data = await res.json();

        const pageType = document.title.split('|')[1] || '';
        document.title = data.name + (pageType ? ' | ' + pageType : '');

        document.querySelectorAll('.project-name').forEach(el => {
            el.textContent = data.name;
        });

        const verEl = document.getElementById('project-version');
        if (verEl) verEl.textContent = data.version;
    } catch (e) {
        console.warn('Project info load error:', e);
    }

    // ── Mobil Uygulama (Capacitor) Entegrasyonu ─────────────────
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const Plugins = window.Capacitor.Plugins;

        // Android Fiziksel Geri Tuşu
        if (Plugins.App) {
            Plugins.App.addListener('backButton', ({ canGoBack }) => {
                if (canGoBack) window.history.back();
                else Plugins.App.exitApp();
            });
        }

        // StatusBar — capacitor.config.json'da da ayarlı,
        // burada çalışma zamanı renk garantisi için tekrar set ediyoruz.
        if (Plugins.StatusBar) {
            try {
                await Plugins.StatusBar.setOverlaysWebView({ overlay: false });
                await Plugins.StatusBar.setStyle({ style: 'DARK' });
                await Plugins.StatusBar.setBackgroundColor({ color: '#0f172a' });
            } catch (err) {
                console.warn('StatusBar ayarlanamadı:', err);
            }
        }
    }
});
