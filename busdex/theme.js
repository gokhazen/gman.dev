// Açık/koyu tema: kayıtlı tercih yoksa sistem temasını izler. Sayfa çizilmeden önce çalışır (titremeyi önler).
(function () {
  var KEY = 'busdex-theme';
  var root = document.documentElement;
  try { var t = localStorage.getItem(KEY); if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); } catch (e) { /* depolama kapalı */ }
  window.busdexToggleTheme = function () {
    var dark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* yoksay */ }
  };
})();
