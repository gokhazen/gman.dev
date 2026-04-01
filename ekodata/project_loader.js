document.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('../ekodata/projectinfo.json');
        const data = await res.json();
        
        // Update Title - sayfa başlığını koru ama proje adını ekle
        const pageType = document.title.split('|')[1] || '';
        document.title = data.name + (pageType ? ' | ' + pageType : '');
        
        // Update any elements with class 'project-name'
        document.querySelectorAll('.project-name').forEach(el => {
            el.textContent = data.name;
        });
        
        // Update version if element exists
        const verEl = document.getElementById('project-version');
        if (verEl) verEl.textContent = data.version;
        
    } catch (e) {
        console.warn('Project info load error:', e);
    }
});
