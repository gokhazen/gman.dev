'use strict';
/* BusDex arayüzü — saf JS, derleme yok. Tüm kullanıcı verisi esc() ile kaçışlanır.
   Misafirler arşivi, markaları, modelleri ve 3B kaplamaları görebilir; yazma işlemleri için giriş gerekir. */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');

let me = null, csrf = null, catalog = null;
const isAdmin = () => !!me && me.role === 'admin';

/* Statik sürüm (build-static.js): sunucu yok; veri data.js içinden gelir, yalnızca Arşiv / Markalar / plaka sayfaları açıktır. */
const STATIC = !!window.BUSDEX_STATIC;
const SD = window.BUSDEX_DATA || null;
const TR_MAP = { 'İ': 'I', 'ı': 'I', 'i': 'I', 'Ş': 'S', 'ş': 'S', 'Ğ': 'G', 'ğ': 'G', 'Ü': 'U', 'ü': 'U', 'Ö': 'O', 'ö': 'O', 'Ç': 'C', 'ç': 'C' };
const normPlate = s => [...String(s || '')].map(c => TR_MAP[c] ?? c.toUpperCase()).join('').replace(/[^A-Z0-9]/g, '');
const lc = s => String(s ?? '').toLocaleLowerCase('tr');

/** Statik sürümde API çağrılarını data.js'ten yanıtlar (sunucunun arama/filtre davranışını taklit eder). */
function staticApi(method, url) {
  const u = new URL(url, 'http://static.local');
  const fail404 = (extra) => { const e = new Error('Kayıt yok'); e.status = 404; e.data = extra; throw e; };
  if (method !== 'GET') { const e = new Error('Statik sürümde değişiklik yapılamaz'); e.status = 405; throw e; }
  if (u.pathname === '/api/catalog') return SD.catalog;
  if (u.pathname === '/api/models3d') return [];
  const m = /^\/api\/buses\/by-plate\/(.+)$/.exec(u.pathname);
  if (m) {
    const norm = normPlate(decodeURIComponent(m[1]));
    const b = SD.buses.find(x => x.plate === norm);
    if (!b) fail404({ plate: norm, plateDisplay: norm });
    return b;
  }
  if (u.pathname === '/api/buses') {
    const q = u.searchParams;
    const text = lc(q.get('q')), plate = normPlate(q.get('q'));
    let list = SD.buses.filter(b => {
      if (text && !((plate && b.plate.includes(plate)) || [b.brandName, b.modelName, b.fleetNo, b.operator].some(v => lc(v).includes(text)))) return false;
      if (q.get('brandId') && b.brandId !== Number(q.get('brandId'))) return false;
      if (q.get('modelId') && b.modelId !== Number(q.get('modelId'))) return false;
      if (q.get('bodyTypeId') && b.bodyTypeId !== Number(q.get('bodyTypeId'))) return false;
      if (q.get('hasPhoto') === '0' && b.photoCount) return false;
      return true;
    });
    const limit = Math.min(Math.max(Number(q.get('limit')) || 60, 1), 200), offset = Math.max(Number(q.get('offset')) || 0, 0);
    list = list.sort((a, b) => b.updatedAt - a.updatedAt || b.id - a.id);
    return { total: list.length, items: list.slice(offset, offset + limit).map(({ photos, ...rest }) => rest) };
  }
  return fail404();
}
const pad2 = n => String(n).padStart(2, '0');

/* ---------- Yardımcılar ---------- */
let toastTimer;
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, bad ? 5500 : 2600);
}

async function api(method, url, body, isForm) {
  if (STATIC) return staticApi(method, url);
  const opt = { method, headers: {}, credentials: 'same-origin' };
  if (csrf) opt.headers['X-CSRF-Token'] = csrf;
  if (isForm) opt.body = body;
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(url, opt);
  let data = null;
  try { data = await r.json(); } catch { /* gövde yok */ }
  if (r.status === 401 && me && url !== '/api/login') { // oturum sona erdi
    me = null; csrf = null; renderShell(); toast('Oturum sona erdi, tekrar giriş yapın.', true);
    go('#/login?next=' + encodeURIComponent(location.hash.slice(1)));
  }
  if (!r.ok) { const e = new Error(data?.error || `Hata (${r.status})`); e.status = r.status; e.data = data; throw e; }
  return data;
}
const run = async (fn, btn) => {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { if (btn) btn.disabled = false; }
};

const plateHtml = (display, cls = '') => `<span class="plate ${cls}"><i>TR</i><span>${esc(display)}</span></span>`;
const fmtDate = ts => ts ? new Date(ts * 1000).toLocaleString('tr-TR') : '-';
const fmtDay = ts => ts ? new Date(ts * 1000).toLocaleDateString('tr-TR') : '-';
const lenText = n => (n == null ? '-' : `${String(n).replace('.', ',')} m`);
const fmtMB = b => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };

/** Numaralı bölüm: solda yapışkan başlık, sağda içerik. */
const sec = (n, title, inner, first) => `<section class="sec${first ? ' first' : ''}"><div class="wrap">
  <div class="sec-head"><span class="n mono">${n}</span><h2>${esc(title)}</h2></div><div>${inner}</div></div></section>`;

async function loadCatalog() { catalog = await api('GET', '/api/catalog'); }
const brandOptions = (sel, withEmpty = '— Seçin —') =>
  `<option value="">${esc(withEmpty)}</option>` + catalog.brands.filter(b => !b.isArchived || b.id === sel).map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
const modelOptions = (brandId, sel) => {
  const b = catalog.brands.find(x => x.id === Number(brandId));
  return '<option value="">— Seçin —</option>' + (b ? b.models.filter(m => !m.isArchived || m.id === sel).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('') : '');
};
const bodyOptions = (sel, emptyLabel = '— Seçin —') =>
  `<option value="">${esc(emptyLabel)}</option>` + catalog.bodyTypes.map(t => `<option value="${t.id}" ${t.id === sel ? 'selected' : ''}>${esc(t.name)}</option>`).join('');

/* ---------- Kabuk (üst çubuk, menü, alt bilgi) ---------- */
const ARROW = '<svg class="arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 10 10 2M4 2h6v6"/></svg>';
const THEME_ICON = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="6.5"/><path d="M9 2.5v13a6.5 6.5 0 0 0 0-13z" fill="currentColor"/></svg>';

/** Üst menü: sık kullanılanlar yanyana, yönetim araçları tek açılır menüde ("Yönetim"). */
const MAIN_NAV = [['home', '#/', 'Arşiv'], ['brands', '#/brands', 'Markalar'], ['models', '#/models', '3B modeller']];
const STATIC_NAV = [['home', '#/', 'Arşiv'], ['brands', '#/brands', 'Markalar']];
const ADMIN_NAV = [['import', '#/import', 'İçe aktar'], ['users', '#/users', 'Kullanıcılar'], ['system', '#/system', 'Sistem']];
const navLink = ([r, h, t]) => `<a href="${h}" data-r="${r}">${t}</a>`;

/** Açılır menü (tıklayınca açılır; dışarı tıklayınca ya da Esc ile kapanır). */
const dropdown = (label, inner, { right = false, routes = '', cls = '' } = {}) =>
  `<div class="dd ${right ? 'dd-right' : ''} ${cls}"><button type="button" class="dd-btn" data-routes="${routes}" aria-haspopup="true" aria-expanded="false">${label} <span aria-hidden="true">▾</span></button><div class="dd-menu">${inner}</div></div>`;

function renderShell() {
  const main = STATIC ? STATIC_NAV : MAIN_NAV;
  const links = main.map(navLink).join('')
    + (me && !STATIC ? '<a class="nav-cta" href="#/new" data-r="new">+ Yeni otobüs</a>' : '')
    + (isAdmin() ? dropdown('Yönetim', ADMIN_NAV.map(navLink).join(''), { routes: ADMIN_NAV.map(x => x[0]).join(',') }) : '');
  const sheetItems = [...main, ...(me && !STATIC ? [['new', '#/new', '+ Yeni otobüs']] : []), ...(isAdmin() ? ADMIN_NAV : [])];
  const sheet = sheetItems.map(([, h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')
    + (STATIC ? '' : me ? '<li><a href="#/profile">Şifre değiştir</a></li><li><a href="#" id="logout2">Çıkış</a></li>' : '<li><a href="#/login">Giriş yap</a></li>');
  app.innerHTML = `
    <header class="top" id="top"><div class="wrap">
      <a class="brand" href="#/">Bus<b>Dex</b></a>
      <nav class="nav" id="nav">${links}</nav>
      <div class="who">
        <button class="theme-btn" id="theme" aria-label="Temayı değiştir" title="Açık / koyu">${THEME_ICON}</button>
        ${me ? dropdown(`${esc(me.username)}${isAdmin() ? ' · admin' : ''}`, '<a href="#/profile" data-r="profile">Şifre değiştir</a><button type="button" class="dd-item" id="logout">Çıkış</button>', { right: true, cls: 'hide-sm' })
             : STATIC ? '' : '<a class="btn sm" href="#/login">Giriş</a>'}
        <button class="menu-btn" id="menu" aria-expanded="false">Menü</button>
      </div>
    </div></header>
    <div class="sheet-menu" id="sheet"><div class="bar"><a class="brand" href="#/">Bus<b>Dex</b></a><button class="menu-btn" id="menux">Kapat ✕</button></div><ol>${sheet}</ol></div>
    <main id="view"></main>
    <footer class="foot"><div class="wrap"><p class="mono">© 2026 BusDex</p><p class="mono">${STATIC ? `Statik arşiv · ${esc(new Date(SD.builtAt).toLocaleString('tr-TR'))}` : 'Yerel arşiv'}. Elle yazıldı, framework yok.</p><p class="mono"><a href="#" id="totop">Başa dön ↑</a></p></div></footer>`;
  const sheetEl = $('#sheet');
  const closeSheet = () => { sheetEl.classList.remove('open'); $('#menu').setAttribute('aria-expanded', 'false'); };
  $('#menu').addEventListener('click', () => { sheetEl.classList.add('open'); $('#menu').setAttribute('aria-expanded', 'true'); });
  $('#menux').addEventListener('click', closeSheet);
  sheetEl.addEventListener('click', e => { if (e.target.closest('a')) closeSheet(); });
  $('#theme').addEventListener('click', () => window.busdexToggleTheme?.());
  $('#logout')?.addEventListener('click', logout);
  if (!renderShell._dd) { // açılır menüler: belge düzeyinde tek dinleyici (kabuk yeniden çizilse de tekrar eklenmez)
    renderShell._dd = true;
    document.addEventListener('click', e => {
      const btn = e.target.closest('.dd-btn');
      const keep = btn ? btn.closest('.dd') : null;
      for (const d of $$('.dd.open')) if (d !== keep) { d.classList.remove('open'); $('.dd-btn', d).setAttribute('aria-expanded', 'false'); }
      if (keep) { const open = keep.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') for (const d of $$('.dd.open')) { d.classList.remove('open'); $('.dd-btn', d).setAttribute('aria-expanded', 'false'); } });
  }
  $('#logout2')?.addEventListener('click', e => { e.preventDefault(); closeSheet(); logout(); });
  $('#totop').addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  const onScroll = () => $('#top')?.classList.toggle('scrolled', window.scrollY > 4);
  window.removeEventListener('scroll', renderShell._s); renderShell._s = onScroll; window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

async function logout() {
  try { await api('POST', '/api/logout'); } catch { /* yoksay */ }
  me = null; csrf = null; renderShell(); go('#/');
}

/* ---------- Giriş / şifre ---------- */
function pageLogin(next) {
  if (me) return go(next ? '#' + next : '#/');
  view().innerHTML = sec('01', 'Giriş', `
    <div class="login">
      <h1 class="page-title">Giriş <em>yap</em></h1>
      <p class="muted">Arşivi giriş yapmadan da gezebilirsiniz. Otobüs eklemek, fotoğraf yüklemek ve modelleri indirmek için giriş gerekir. Hesapları yalnızca yöneticiler açar.</p>
      <form id="f" style="margin-top:24px">
        <div class="field"><label for="u">Kullanıcı adı</label><input id="u" autocomplete="username" autofocus required></div>
        <div class="field"><label for="p">Şifre</label><input id="p" type="password" autocomplete="current-password" required></div>
        <button class="primary">Giriş yap ${ARROW}</button>
      </form>
    </div>`, true);
  $('#f').addEventListener('submit', async ev => {
    ev.preventDefault();
    await run(async () => {
      const r = await api('POST', '/api/login', { username: $('#u').value.trim(), password: $('#p').value });
      me = r.user; csrf = r.csrf;
      if (me.mustChangePassword) return renderChangePassword(true);
      renderShell();
      go(next ? '#' + next : '#/');
    }, $('#f button'));
  });
}

function renderChangePassword(forced) {
  const form = `
    <div class="login">
      <h1 class="page-title">${forced ? 'Şifrenizi <em>belirleyin</em>' : 'Şifre <em>değiştir</em>'}</h1>
      ${forced ? '<p class="muted">Devam etmeden önce size verilen geçici şifreyi değiştirmelisiniz.</p>' : ''}
      <form id="f" style="margin-top:24px">
        <div class="field"><label>Mevcut şifre</label><input id="o" type="password" autocomplete="current-password" required></div>
        <div class="field"><label>Yeni şifre (en az 8 karakter)</label><input id="n" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="field"><label>Yeni şifre (tekrar)</label><input id="n2" type="password" autocomplete="new-password" minlength="8" required></div>
        <button class="primary">Kaydet</button> ${forced ? '<button type="button" id="out" class="link">Çıkış</button>' : ''}
      </form>
    </div>`;
  if (forced) {
    app.innerHTML = `<main id="view">${sec('01', 'Şifre', form, true)}</main>`;
    $('#out')?.addEventListener('click', async () => { try { await api('POST', '/api/logout'); } catch { /* yoksay */ } me = null; csrf = null; start(); });
  } else view().innerHTML = sec('01', 'Şifre', form, true);
  $('#f').addEventListener('submit', async ev => {
    ev.preventDefault();
    if ($('#n').value !== $('#n2').value) return toast('Yeni şifreler aynı değil', true);
    await run(async () => {
      await api('POST', '/api/change-password', { oldPassword: $('#o').value, newPassword: $('#n').value });
      me.mustChangePassword = false;
      toast('Şifre değiştirildi');
      if (forced) await start(); else go('#/');
    }, $('#f .primary'));
  });
}

/* ---------- Yönlendirme ---------- */
const view = () => $('#view');
const PUBLIC_ROUTES = new Set(STATIC ? ['home', 'bus', 'brands'] : ['home', 'bus', 'brands', 'models', 'login']);
const ADMIN_ROUTES = new Set(['users', 'system', 'import']);

async function route() {
  if (!$('#view')) return;
  destroyMaps();               // sayfadaki harita (WebGL) serbest bırakılır
  $('.pv')?._close?.();        // açık fotoğraf görüntüleyici (geri tuşuyla sayfa değişirse) kapanır
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').map(decodeURIComponent);
  const params = new URLSearchParams(qs || '');
  const name = parts[0] || 'home';
  if (STATIC && !PUBLIC_ROUTES.has(name)) return go('#/');
  if (!PUBLIC_ROUTES.has(name) && !me) return go('#/login?next=' + encodeURIComponent(location.hash.slice(1)));
  if (ADMIN_ROUTES.has(name) && !isAdmin()) return go('#/');
  $$('#nav a, .dd-menu a').forEach(a => a.classList.toggle('on', a.dataset.r === name));
  $$('.dd-btn[data-routes]').forEach(b => b.classList.toggle('on', b.dataset.routes.split(',').includes(name)));
  window.scrollTo(0, 0);
  try {
    switch (name) {
      case 'home': return await pageHome(params);
      case 'login': return pageLogin(params.get('next'));
      case 'bus': return await pageBus(parts[1]);
      case 'new': return await pageBusForm(null, parts[1] || params.get('plate') || '');
      case 'edit': return await pageEdit(parts[1]);
      case 'brands': return await pageBrands();
      case 'models': return await pageModels();
      case 'profile': return renderChangePassword(false);
      case 'users': return await pageUsers();
      case 'system': return await pageSystem();
      case 'import': return await pageImport();
      case 'catalog': return go('#/brands');
      default: view().innerHTML = sec('!', 'Bulunamadı', '<p class="page-title">Sayfa <em>yok</em></p>', true);
    }
  } catch (e) { if (e.status !== 401) view().innerHTML = sec('!', 'Hata', `<p class="err">${esc(e.message)}</p>`, true); }
}
window.addEventListener('hashchange', route);

/* ---------- Ana sayfa / arşiv ---------- */
const homeState = { q: '', brandId: '', modelId: '', bodyTypeId: '', noPhoto: false, archived: false };

async function pageHome(params) {
  if (params.has('brand')) { homeState.brandId = params.get('brand'); homeState.modelId = ''; }
  if (params.has('model')) homeState.modelId = params.get('model');
  if (params.has('q')) homeState.q = params.get('q');
  const hasFilter = () => homeState.q || homeState.brandId || homeState.modelId || homeState.bodyTypeId || homeState.noPhoto || homeState.archived;
  const modelName = () => { for (const b of catalog.brands) { const m = b.models.find(x => x.id === Number(homeState.modelId)); if (m) return `${b.name} ${m.name}`; } return ''; };

  view().innerHTML = `
    <section class="hero"><div class="wrap">
      <div class="hero-meta"><span>${STATIC ? `statik arşiv · ${esc(new Date(SD.builtAt).toLocaleDateString('tr-TR'))}` : ''}</span><span id="stat">…</span></div>
      <h1 class="name"><span><i>Bus</i></span><span class="second"><i>Dex</i></span></h1>
      <p class="lede"><span class="role">Plaka bazlı otobüs arşivi</span><span class="big">${STATIC ? 'Her plakanın markası, modeli ve <em>fotoğrafları</em> tek yerde.' : 'Her plakanın markası, modeli, fotoğrafları ve <em>3B kaplamaları</em> tek yerde.'}</span></p>
      <div class="cta"><button class="primary" id="goarch">Arşive bak <svg class="arrow" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 1v10M2 7l4 4 4-4"/></svg></button>
        <a class="btn" href="#/brands">Markalar ${ARROW}</a>${me || STATIC ? '' : `<a class="btn" href="#/login">Giriş yap ${ARROW}</a>`}</div>
    </div></section>
    <section class="sec" id="arsiv"><div class="wrap">
      <div class="sec-head"><span class="n mono">01</span><h2>Arşiv</h2></div>
      <div>
        <div class="filters">
          <div class="wide"><label for="q">Plaka, marka, model, filo no</label><input id="q" placeholder="örn. 34 ABC 123" value="${esc(homeState.q)}" autocomplete="off"></div>
          <div><label>Marka</label><select id="fb">${brandOptions(Number(homeState.brandId), 'Tümü')}</select></div>
        </div>
        <div class="row" style="margin-bottom:18px;align-items:center">
          <label class="inline fit"><input type="checkbox" id="fn" ${homeState.noPhoto ? 'checked' : ''}> Fotoğrafsız olanlar</label>
          ${isAdmin() ? `<label class="inline fit"><input type="checkbox" id="fa" ${homeState.archived ? 'checked' : ''}> Arşivdekiler</label>` : ''}
          ${homeState.modelId ? `<span class="tag fit" style="padding:3px 10px">Model: ${esc(modelName())} <button class="link" id="xm" title="Kaldır">✕</button></span>` : ''}
          ${hasFilter() ? '<button class="link fit" id="clr">Filtreleri temizle</button>' : ''}
        </div>
        <div id="results"></div>
      </div>
    </div></section>`;
  $('#goarch').addEventListener('click', () => $('#arsiv').scrollIntoView({ behavior: 'smooth' }));
  let offset = 0;
  const load = async append => {
    if (!append) offset = 0;
    const p = new URLSearchParams({ limit: 48, offset });
    if (homeState.q) p.set('q', homeState.q);
    if (homeState.brandId) p.set('brandId', homeState.brandId);
    if (homeState.modelId) p.set('modelId', homeState.modelId);
    if (homeState.bodyTypeId) p.set('bodyTypeId', homeState.bodyTypeId);
    if (homeState.noPhoto) p.set('hasPhoto', '0');
    if (homeState.archived) p.set('archived', '1');
    const r = await api('GET', '/api/buses?' + p);
    const box = $('#results');
    if (!box) return;
    $('#stat').textContent = `${r.total} kayıt${hasFilter() ? ' (filtreli)' : ''}`;
    if (!append) {
      let hint = '';
      const q = homeState.q.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (homeState.q && q.length >= 4 && !r.items.some(b => b.plate === q)) {
        hint = STATIC ? '<p class="muted">Bu plaka arşivde yok.</p>'
          : me ? `<p><a class="btn primary" href="#/new/${encodeURIComponent(homeState.q)}">“${esc(homeState.q)}” plakasını ekle ${ARROW}</a></p>`
               : `<p class="muted">Bu plaka arşivde yok. Eklemek için <a href="#/login" style="color:var(--accent)">giriş yapın</a>.</p>`;
      }
      box.innerHTML = `<p class="count">${r.total} KAYIT</p>${hint}<div class="figs" id="figs"></div><p id="more"></p>`;
    }
    $('#figs').insertAdjacentHTML('beforeend', r.items.map(figHtml).join(''));
    offset += r.items.length;
    $('#more').innerHTML = offset < r.total ? '<button id="mb">Daha fazla göster</button>' : '';
    $('#mb')?.addEventListener('click', () => load(true));
    if (!r.total && !homeState.q) box.insertAdjacentHTML('beforeend', `<p class="muted">Henüz kayıt yok.${me && !STATIC ? ' “+ Yeni otobüs” ile başlayın.' : ''}</p>`);
  };
  const reload = () => run(() => load(false));
  $('#q').addEventListener('input', debounce(e => { homeState.q = e.target.value.trim(); reload(); }));
  $('#fb').addEventListener('change', e => { homeState.brandId = e.target.value; homeState.modelId = ''; go('#/'); });
  $('#fn').addEventListener('change', e => { homeState.noPhoto = e.target.checked; reload(); });
  $('#fa')?.addEventListener('change', e => { homeState.archived = e.target.checked; reload(); });
  $('#xm')?.addEventListener('click', () => { homeState.modelId = ''; go('#/'); });
  $('#clr')?.addEventListener('click', () => { Object.assign(homeState, { q: '', brandId: '', modelId: '', bodyTypeId: '', noPhoto: false, archived: false }); go('#/'); });
  await load(false);
}

function figHtml(b) {
  const sub = [b.brandName, b.modelName].filter(Boolean).join(' ') || 'Marka / model girilmemiş';
  const meta = [b.bodyTypeName, b.lengthM ? lenText(b.lengthM) : null, b.year].filter(Boolean).join(' · ');
  return `<a class="fig" href="#/bus/${encodeURIComponent(b.plate)}">
    <div class="ph">${b.coverThumb ? `<img src="${esc(b.coverThumb)}" loading="lazy" alt="${esc(b.plateDisplay)}">` : '<span>FOTOĞRAF YOK</span>'}</div>
    <div class="cap">${b.modelCount ? `<span class="tag3d" title="${b.modelCount} adet 3B model / kaplama">3B ${b.modelCount}</span>` : ''}${plateHtml(b.plateDisplay, 'sm')}${b.isArchived ? ' <span class="badge off">arşiv</span>' : ''}
      <span class="t">${esc(sub)}</span><span class="m mono">${esc(meta || ' ')}${b.photoCount ? ` · ${b.photoCount} foto` : ''}</span></div></a>`;
}

/* ---------- Otobüs sayfası ---------- */
async function pageBus(plate) {
  let b;
  try { b = await api('GET', '/api/buses/by-plate/' + encodeURIComponent(plate)); }
  catch (e) {
    if (e.status === 404) {
      view().innerHTML = sec('01', 'Kayıt yok', `<h1 class="page-title">Kayıt <em>yok</em></h1><p style="margin:18px 0">${plateHtml(e.data?.plateDisplay || plate, 'big')}</p>
        <p class="muted">Bu plaka henüz arşivde değil.</p>${STATIC ? '<a class="btn" href="#/">Arşive dön</a>' : me ? `<a class="btn primary" href="#/new/${encodeURIComponent(plate)}">Bu plakayı ekle ${ARROW}</a>` : `<a class="btn" href="#/login?next=${encodeURIComponent('/new/' + plate)}">Eklemek için giriş yap ${ARROW}</a>`}`, true);
      return;
    }
    throw e;
  }
  const models = STATIC || !b.modelId ? [] : await api('GET', '/api/models3d?modelId=' + b.modelId);
  const dd = v => v ? `<dd>${esc(v)}</dd>` : '<dd class="none">—</dd>';
  const title = [b.brandName, b.modelName].filter(Boolean);
  view().innerHTML = `
    <section class="hero" style="padding-bottom:clamp(32px,5vw,64px)"><div class="wrap">
      <div class="hero-meta"><span>kayıt #${b.id}${b.isArchived ? ' · <b style="color:var(--danger)">arşivde</b>' : ''}</span><span>güncellendi ${esc(fmtDate(b.updatedAt))}</span></div>
      <div>${plateHtml(b.plateDisplay, 'big')}</div>
      <p class="lede"><span class="big">${title.length ? `${esc(title[0])}${title[1] ? ` <em>${esc(title[1])}</em>` : ''}` : '<em>Marka / model girilmemiş</em>'}</span></p>
      <div class="cta">
        ${STATIC ? '' : me ? `<a class="btn solid" href="#/edit/${encodeURIComponent(b.plate)}">Düzenle ${ARROW}</a>` : `<a class="btn" href="#/login?next=${encodeURIComponent('/bus/' + b.plate)}">Düzenlemek için giriş yap ${ARROW}</a>`}
        ${isAdmin() ? (b.isArchived ? '<button id="restore">Arşivden çıkar</button>' : '<button class="danger" id="archive">Arşivle</button>') : ''}
        <a class="btn" href="#/">Arşive dön</a>
      </div>
    </div></section>
    ${sec('01', 'Bilgiler', `<dl class="stack">
      <div><dt>Marka</dt>${dd(b.brandName)}</div><div><dt>Model</dt>${dd(b.modelName)}</div>
      <div><dt>Uzunluk</dt>${dd(b.lengthM ? lenText(b.lengthM) : '')}</div><div><dt>İşletmeci</dt>${dd(b.operator)}</div>
      ${/* eski kayıtlarda dolu olabilen alanlar: yalnızca değer varsa gösterilir */ ''}
      ${b.bodyTypeName ? `<div><dt>Gövde tipi</dt>${dd(b.bodyTypeName)}</div>` : ''}${b.year ? `<div><dt>Model yılı</dt>${dd(b.year)}</div>` : ''}${b.fleetNo ? `<div><dt>Filo / kapı no</dt>${dd(b.fleetNo)}</div>` : ''}
      <div class="full"><dt>Notlar</dt>${dd(b.notes)}</div></dl>`)}
    ${sec('02', `Kareler (${b.photos.length})`, `
      ${me ? `<div class="photo-tools"><label class="btn solid" for="up">Fotoğraf ekle</label><input id="up" type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden">
          ${b.photos.length > 1 ? '<button type="button" id="reorder">Sırala</button>' : ''}</div><div id="upstage" class="hidden"></div>` : ''}
      <div id="galbox"></div><div id="photomap" class="photomap hidden"></div>`)}
    ${STATIC || !b.modelId ? '' : sec('03', `3B kaplamalar (${models.length})`, `<div id="mlist"></div>${isAdmin() ? '<p style="margin-top:16px"><a class="btn sm" href="#/models">Kaplama yükle / yönet ↗</a></p>' : ''}`)}`;

  $('#archive')?.addEventListener('click', () => confirm('Bu otobüs arşive alınsın mı?') && run(async () => { await api('DELETE', '/api/buses/' + b.id); toast('Arşive alındı'); route(); }));
  $('#restore')?.addEventListener('click', () => run(async () => { await api('PATCH', '/api/buses/' + b.id, { isArchived: false }); toast('Geri alındı'); route(); }));
  renderGallery(b);
  void renderPhotoMap(b);
  if (me) {
    // Seçilen dosyalar önce önizlenir; sıralanıp (sürükle ya da ‹ ›) onaylanınca o sırayla yüklenir
    createStager($('#upstage'), { input: $('#up'), upload: async files => { toast(await uploadPhotos(b.id, files)); route(); } });
    $('#reorder')?.addEventListener('click', () => startReorder(b));
  }
  if (!STATIC && b.modelId) renderModelList($('#mlist'), models, { showModel: false, onChange: route });
}

async function uploadPhotos(busId, files) {
  const fd = new FormData();
  files.forEach(f => fd.append('photos', f, f.name));
  try {
    const r = await api('POST', `/api/buses/${busId}/photos`, fd, true);
    return summarizeUpload(r.results);
  } catch (e) {
    if (e.data?.results) throw new Error(summarizeUpload(e.data.results) + ' — ' + e.message);
    throw e;
  }
}
function summarizeUpload(results) {
  const ok = results.filter(r => r.ok && !r.duplicate).length, dup = results.filter(r => r.duplicate).length, bad = results.filter(r => !r.ok);
  return [ok && `${ok} fotoğraf eklendi`, dup && `${dup} zaten vardı`, bad.length && `${bad.length} dosya reddedildi (${bad[0].error})`].filter(Boolean).join(', ');
}

/* ---------- Harita (OpenStreetMap / OpenFreeMap vektör karoları; yalnızca gerektiğinde yüklenir) ---------- */
let mapLoading = null;
function loadMapLib() {
  if (window.BusdexMap) return Promise.resolve(window.BusdexMap);
  mapLoading ||= new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'vendor/map.css'; // göreli yol: statik sitede (file://) de çalışır
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'vendor/map.js';
    s.onload = () => res(window.BusdexMap);
    s.onerror = () => { mapLoading = null; rej(new Error('Harita bileşeni yüklenemedi')); };
    document.head.appendChild(s);
  });
  return mapLoading;
}
const isDarkTheme = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
let overviewMap = null; // plaka sayfasındaki toplu konum haritası
function destroyMaps() { overviewMap?.destroy(); overviewMap = null; }
new MutationObserver(() => overviewMap?.setDark(isDarkTheme())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/** Plaka sayfası: fotoğrafların çekim yerleri tek haritada (aynı noktadakiler tek işarette). */
async function renderPhotoMap(b) {
  const host = $('#photomap');
  if (!host) return;
  const groups = new Map();
  let geo = 0;
  b.photos.forEach((p, i) => {
    const g = p.exif?.gps;
    if (!g) return;
    geo++;
    const k = `${g.lat.toFixed(4)},${g.lon.toFixed(4)}`;
    if (!groups.has(k)) groups.set(k, { lat: g.lat, lon: g.lon, items: [] });
    groups.get(k).items.push({ index: i, thumb: p.thumb, label: `Fotoğraf ${i + 1}${p.takenAt ? ' · ' + fmtDateTime(p.takenAt) : ''}` });
  });
  if (!geo) return;
  host.classList.remove('hidden');
  host.innerHTML = `<div class="photomap-head"><b>Çekim konumları</b><span class="muted small">${geo} fotoğraf · ${groups.size} nokta${b.photos.length > geo ? ` · ${b.photos.length - geo} fotoğrafta konum yok` : ''}</span></div><div class="photomap-box" id="pmbox"></div>`;
  const box = $('#pmbox');
  try {
    const lib = await loadMapLib();
    if (!box.isConnected) return; // bu arada başka sayfaya geçildi
    overviewMap = lib.createOverview(box, [...groups.values()], { dark: isDarkTheme(), onOpen: i => openLightbox(b, i) });
  } catch (e) { box.innerHTML = `<div class="map-msg">${esc(e.message)}</div>`; }
}

/* ---------- Fotoğraf galerisi: film şeridi, sıralama, yükleme önizlemesi ---------- */
function renderGallery(b) {
  const box = $('#galbox');
  if (!b.photos.length) { box.innerHTML = '<p class="muted">Henüz fotoğraf yok.</p>'; return; }
  box.innerHTML = `<div class="contact-sheet"><div class="frames" id="gal">${b.photos.map((p, i) => `<button data-i="${i}" title="${esc(p.caption || '')}"><div class="ph"><img src="${esc(p.thumb)}" loading="lazy" alt="${esc(b.plateDisplay)}">${p.id === b.coverPhotoId ? '<span class="cov">KAPAK</span>' : ''}</div><div class="edge"><span>${esc(b.plate)}</span><span>${pad2(i + 1)} / ${pad2(b.photos.length)}</span></div></button>`).join('')}</div></div><p class="mono swipe-hint">← kaydır →</p>`;
  $$('#gal button', box).forEach(btn => btn.addEventListener('click', () => openLightbox(b, Number(btn.dataset.i))));
}

/** Sürükle-bırak ile sıralama: kutu içindeki `[data-i]` öğeleri taşınır; onMove(kaynak, hedef) çağrılır. */
function makeSortable(box, onMove) {
  let from = -1;
  const clear = () => $$('.dragging, .drop-before, .drop-after', box).forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after'));
  box.addEventListener('dragstart', e => {
    const t = e.target.closest?.('[data-i]');
    if (!t) return;
    from = Number(t.dataset.i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(from));
    t.classList.add('dragging');
  });
  box.addEventListener('dragend', () => { from = -1; clear(); });
  box.addEventListener('dragover', e => {
    const t = e.target.closest?.('[data-i]');
    if (from < 0 || !t) return;
    e.preventDefault();
    const idx = Number(t.dataset.i);
    $$('.drop-before, .drop-after', box).forEach(x => x.classList.remove('drop-before', 'drop-after'));
    if (idx !== from) t.classList.add(idx > from ? 'drop-after' : 'drop-before');
  });
  box.addEventListener('drop', e => {
    const t = e.target.closest?.('[data-i]');
    if (from < 0 || !t) return;
    e.preventDefault();
    const to = Number(t.dataset.i), src = from;
    from = -1; clear();
    if (to !== src) onMove(src, to);
  });
}
const moveItem = (arr, from, to) => { arr.splice(to, 0, arr.splice(from, 1)[0]); };

/** Sıralanabilir küçük resim karoları (yükleme önizlemesi ve sıralama modu ortak kullanır). */
const tileHtml = (src, i, n, { cover = false, removable = false, title = '' } = {}) =>
  `<div class="stg-tile" draggable="true" data-i="${i}" title="${esc(title)}"><img src="${esc(src)}" alt="" draggable="false"><span class="no">${pad2(i + 1)}</span>${cover ? '<span class="cov">KAPAK</span>' : ''}
    <div class="ctl"><button type="button" data-a="l" ${i === 0 ? 'disabled' : ''} aria-label="Öne al">‹</button>${removable ? '<button type="button" data-a="x" aria-label="Kaldır">✕</button>' : '<span></span>'}<button type="button" data-a="r" ${i === n - 1 ? 'disabled' : ''} aria-label="Geriye al">›</button></div></div>`;

/**
 * Yüklenecek dosyaların önizleme/sıralama alanı. `input` seçilen dosyaları verir; dosyalar eklenip sıralanır, çıkarılır.
 * `upload` verilirse "Yükle" düğmesi çıkar (otobüs sayfası); verilmezse dosyalar `files()` ile alınır (yeni otobüs formu).
 */
function createStager(host, { input, upload = null }) {
  let items = []; // {file, url}
  let busy = false;
  host.innerHTML = '<div class="stg"><div class="stg-head"></div><div class="stg-grid"></div><div class="stg-act"></div></div>';
  const head = $('.stg-head', host), grid = $('.stg-grid', host), act = $('.stg-act', host);
  const key = f => `${f.name}|${f.size}|${f.lastModified}`;

  function render() {
    host.classList.toggle('hidden', items.length === 0);
    if (!items.length) return;
    head.innerHTML = `<b>${items.length} fotoğraf seçildi</b><span class="muted small">Sürükleyerek ya da ‹ › ile sıralayın; ${upload ? 'yükleme' : 'kayıt'} bu sırayla yapılır${upload ? '' : ', ilk fotoğraf kapak olur'}.</span>`;
    grid.innerHTML = items.map((it, i) => tileHtml(it.url, i, items.length, { removable: true, title: it.file.name })).join('');
    act.innerHTML = `${upload ? `<button type="button" class="primary" data-a="up" ${busy ? 'disabled' : ''}>${busy ? 'Yükleniyor…' : `Yükle (${items.length})`}</button>` : ''}
      <label class="btn sm" for="${input.id}">+ Daha ekle</label><button type="button" class="sm" data-a="date">Dosya tarihine göre sırala</button><button type="button" class="link" data-a="clear">Temizle</button>`;
  }
  function add(fileList) {
    const seen = new Set(items.map(it => key(it.file)));
    for (const f of fileList) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type) || seen.has(key(f))) continue;
      items.push({ file: f, url: URL.createObjectURL(f) });
      seen.add(key(f));
    }
    render();
  }
  function clear() { items.forEach(it => URL.revokeObjectURL(it.url)); items = []; render(); }

  input.addEventListener('change', () => { add([...input.files]); input.value = ''; });
  makeSortable(grid, (from, to) => { moveItem(items, from, to); render(); });
  grid.addEventListener('click', e => {
    const btn = e.target.closest('button[data-a]');
    if (!btn) return;
    const i = Number(btn.closest('[data-i]').dataset.i);
    if (btn.dataset.a === 'l' && i > 0) moveItem(items, i, i - 1);
    else if (btn.dataset.a === 'r' && i < items.length - 1) moveItem(items, i, i + 1);
    else if (btn.dataset.a === 'x') { URL.revokeObjectURL(items[i].url); items.splice(i, 1); }
    render();
  });
  act.addEventListener('click', async e => {
    const btn = e.target.closest('button[data-a]');
    if (!btn) return;
    if (btn.dataset.a === 'clear') clear();
    else if (btn.dataset.a === 'date') { items.sort((a, b) => a.file.lastModified - b.file.lastModified); render(); }
    else if (btn.dataset.a === 'up' && upload && !busy) {
      busy = true; render();
      try { await upload(items.map(it => it.file)); clear(); }
      catch (err) { toast(err.message, true); }
      finally { busy = false; render(); }
    }
  });
  return { files: () => items.map(it => it.file), count: () => items.length, clear };
}

/** Yüklenmiş fotoğrafların sırasını değiştirme modu. */
function startReorder(b) {
  const order = b.photos.slice();
  const box = $('#galbox');
  $('#reorder').disabled = true;
  box.innerHTML = '<div class="stg"><div class="stg-head"><b>Sırayı değiştir</b><span class="muted small">Sürükleyin ya da ‹ › kullanın. Kapak seçimi sıradan bağımsızdır.</span></div><div class="stg-grid"></div><div class="stg-act"></div></div>';
  const grid = $('.stg-grid', box), act = $('.stg-act', box);
  let dir = 1; // "çekim tarihine göre" düğmesi: eskiden yeniye, tekrar basınca yeniden eskiye
  const render = () => {
    grid.innerHTML = order.map((p, i) => tileHtml(p.thumb, i, order.length, { cover: p.id === b.coverPhotoId, title: p.caption || '' })).join('');
  };
  act.innerHTML = '<button type="button" class="primary" data-a="save">Sırayı kaydet</button><button type="button" class="sm" data-a="date">Çekim tarihine göre</button><button type="button" class="link" data-a="cancel">Vazgeç</button>';
  makeSortable(grid, (from, to) => { moveItem(order, from, to); render(); });
  grid.addEventListener('click', e => {
    const btn = e.target.closest('button[data-a]');
    if (!btn) return;
    const i = Number(btn.closest('[data-i]').dataset.i);
    if (btn.dataset.a === 'l' && i > 0) moveItem(order, i, i - 1);
    else if (btn.dataset.a === 'r' && i < order.length - 1) moveItem(order, i, i + 1);
    render();
  });
  act.addEventListener('click', e => {
    const btn = e.target.closest('button[data-a]');
    if (!btn) return;
    if (btn.dataset.a === 'cancel') { $('#reorder').disabled = false; renderGallery(b); }
    else if (btn.dataset.a === 'date') {
      // çekim tarihi (EXIF) yoksa yüklenme tarihi kullanılır
      order.sort((x, y) => dir * (((x.takenAt || x.createdAt) - (y.takenAt || y.createdAt)) || (x.id - y.id)));
      dir = -dir; render();
    } else if (btn.dataset.a === 'save') {
      run(async () => { await api('PUT', `/api/buses/${b.id}/photos/order`, { order: order.map(p => p.id) }); toast('Sıra kaydedildi'); route(); }, btn);
    }
  });
  render();
}

/* ---------- Fotoğraf görüntüleyici ---------- */
const fmtDateTime = ts => (ts ? new Date(ts * 1000).toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' }) : null);
const fmtDMS = (v, pos, neg) => { const a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60), s = ((a - d) * 60 - m) * 60; return `${d}° ${m}′ ${s.toFixed(1)}″ ${v >= 0 ? pos : neg}`; };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Sağ paneldeki fotoğraf bilgisi: tarih, dosya, kamera ve (varsa, giriş yapanlara) konum. */
function photoInfoHtml(p, nat) {
  const row = (k, v) => (v == null || v === '' ? '' : `<div><dt>${k}</dt><dd>${v}</dd></div>`);
  const x = p.exif || {};
  const cam = x.camera ? [x.camera.make, x.camera.model].filter(Boolean).filter((v, i, a) => !(i === 1 && a[0] && v.toLowerCase().startsWith(a[0].toLowerCase()))).join(' ') : null;
  const sections = [];
  sections.push(['Tarih', row('Çekim tarihi', fmtDateTime(p.takenAt) ? esc(fmtDateTime(p.takenAt)) : '<span class="muted">bilinmiyor</span>')
    + row('Yüklenme', esc(fmtDateTime(p.createdAt))) + row('Yükleyen', p.uploader ? esc(p.uploader) : null)]);
  sections.push(['Dosya', row('Boyut', p.bytes ? esc(fmtMB(p.bytes)) : null)
    + row('Çözünürlük', `${nat.w} × ${nat.h}${nat.w * nat.h >= 1e6 ? ` <span class="muted">(${(nat.w * nat.h / 1e6).toFixed(1)} MP)</span>` : ''}`)]);
  if (cam || x.lens || x.aperture || x.exposure || x.iso || x.focalLength) {
    sections.push(['Kamera', row('Kamera', cam ? esc(cam) : null) + row('Objektif', x.lens ? esc(x.lens) : null)
      + row('Odak uzaklığı', x.focalLength ? `${+x.focalLength.toFixed(1)} mm${x.focalLength35 ? ` <span class="muted">(35 mm eşdeğeri ${x.focalLength35})</span>` : ''}` : null)
      + row('Diyafram', x.aperture ? `f/${x.aperture}` : null) + row('Enstantane', x.exposure ? esc(x.exposure) : null)
      + row('ISO', x.iso) + row('Flaş', x.flash ? esc(x.flash) : null) + row('Yazılım', x.software ? esc(x.software) : null)]);
  }
  if (x.gps) {
    const { lat, lon, alt, direction } = x.gps;
    sections.push(['Konum', row('Koordinat', `<span class="mono">${lat.toFixed(6)}, ${lon.toFixed(6)}</span>`)
      + row('Derece', `<span class="small">${fmtDMS(lat, 'K', 'G')}<br>${fmtDMS(lon, 'D', 'B')}</span>`)
      + row('Yükseklik', alt != null ? `${Math.round(alt)} m` : null) + row('Bakış yönü', direction != null ? `${Math.round(direction)}°` : null)
      + `<div class="pv-actions"><a class="pv-btn" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}" target="_blank" rel="noopener noreferrer">Haritada aç ↗</a><button type="button" class="pv-btn" data-copy="${lat.toFixed(6)}, ${lon.toFixed(6)}">Kopyala</button></div>`
      + '<div id="pvmap-slot"></div>']);
  }
  const note = !me && !STATIC ? '<p class="muted small">Kamera ve konum bilgisi için giriş yapın.</p>'
    : me && !p.exif?.camera && !x.gps && !x.exposure && !x.iso ? '<p class="muted small">Bu fotoğrafta kamera/konum (EXIF) bilgisi yok.</p>' : '';
  return sections.map(([h, rows]) => `<h3>${h}</h3><dl>${rows}</dl>`).join('') + note;
}

function openLightbox(b, start) {
  const photos = b.photos;
  const INFO_KEY = 'busdex-pv-info';
  let i = start, fit = 1, scale = 1, tx = 0, ty = 0, nat = { w: 1, h: 1 }, token = 0;
  let infoOpen = window.innerWidth >= 900;
  try { const v = localStorage.getItem(INFO_KEY); if (v !== null) infoOpen = v === '1'; } catch { /* depolama kapalı */ }

  const el = document.createElement('div');
  el.className = 'pv' + (infoOpen ? ' info-open' : '');
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="pv-main">
      <div class="pv-top"><span class="mono" id="pvc"></span><span class="grow" id="pvt"></span>
        <button type="button" id="pvi" title="Fotoğraf bilgisi (i)">ⓘ Bilgi</button><button type="button" id="pvx" title="Kapat (Esc)">Kapat ✕</button></div>
      <div class="pv-stage" id="pvs">
        <img class="pv-img" id="pvm" alt="" draggable="false">
        ${photos.length > 1 ? '<button type="button" class="pv-nav prev" id="pvp" aria-label="Önceki">‹</button><button type="button" class="pv-nav next" id="pvn" aria-label="Sonraki">›</button>' : ''}
        <div class="pv-hint" id="pvh">Tıkla: yakınlaştır · Fare hareketi: kaydır · Tekerlek: yakınlaştır/uzaklaştır · ← →: gezin</div>
      </div>
      ${photos.length > 1 ? `<div class="pv-strip" id="pvst">${photos.map((p, n) => `<button type="button" data-n="${n}" aria-label="Fotoğraf ${n + 1}"><img src="${esc(p.thumb)}" alt="" draggable="false"></button>`).join('')}</div>` : ''}
      <div class="pv-bar" id="pvb"></div>
    </div>
    <aside class="pv-info" id="pvf" aria-label="Fotoğraf bilgisi"><div class="pv-info-in" id="pvfi"></div></aside>`;
  document.body.appendChild(el);
  document.body.classList.add('pv-lock');
  const stage = $('#pvs', el), img = $('#pvm', el);

  /* -- yakınlaştırma / kaydırma -- */
  const sz = () => ({ w: stage.clientWidth, h: stage.clientHeight });
  const maxScale = () => Math.max(fit * 6, 2);
  const calcFit = () => { const s = sz(); fit = Math.min(s.w / nat.w, s.h / nat.h, 1); if (!(fit > 0) || !isFinite(fit)) fit = 1; };
  const clampPan = () => {
    const s = sz(), w = nat.w * scale, h = nat.h * scale;
    const mx = Math.max(0, (w - s.w) / 2), my = Math.max(0, (h - s.h) / 2);
    tx = clamp(tx, -mx, mx); ty = clamp(ty, -my, my);
  };
  const paint = animate => {
    img.style.transition = animate ? 'transform .22s ease' : 'none';
    img.style.transform = `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`;
    stage.classList.toggle('zoomed', scale > fit * 1.001);
  };
  const resetView = animate => { scale = fit; tx = ty = 0; paint(animate); };
  /** px, py: imlecin sahne merkezine göre konumu; imlecin altındaki nokta yerinde kalır. */
  const zoomAt = (next, px, py, animate) => {
    next = clamp(next, fit, maxScale());
    const k = next / scale;
    tx = px - (px - tx) * k; ty = py - (py - ty) * k; scale = next;
    if (scale <= fit * 1.001) { scale = fit; tx = ty = 0; }
    clampPan(); paint(animate);
  };
  const rel = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2]; };

  let last = null, drag = null, moved = false;
  stage.addEventListener('pointerdown', e => {
    last = [e.clientX, e.clientY]; moved = false;
    if (e.pointerType !== 'mouse') { drag = [e.clientX, e.clientY]; stage.setPointerCapture?.(e.pointerId); }
  });
  stage.addEventListener('pointerenter', e => { last = [e.clientX, e.clientY]; });
  stage.addEventListener('pointermove', e => {
    const dx = last ? e.clientX - last[0] : 0, dy = last ? e.clientY - last[1] : 0;
    last = [e.clientX, e.clientY];
    if (scale <= fit * 1.001) return;
    if (e.pointerType === 'mouse') {
      // Fare hareketi görüntüyü TERS yönde kaydırır: sahne boyunca gezen imleç tüm görüntüyü gezdirir
      const s = sz(), w = nat.w * scale, h = nat.h * scale;
      tx -= dx * (w > s.w ? (w - s.w) / s.w : 0);
      ty -= dy * (h > s.h ? (h - s.h) / s.h : 0);
    } else if (drag) {
      // Dokunmatik: parmakla sürükleme
      tx += e.clientX - drag[0]; ty += e.clientY - drag[1]; drag = [e.clientX, e.clientY];
      if (Math.hypot(dx, dy) > 0) moved = true;
    }
    clampPan(); paint(false);
  });
  stage.addEventListener('pointerup', () => { drag = null; });
  stage.addEventListener('click', e => {
    if (e.target.closest('.pv-nav') || moved) return;
    const [px, py] = rel(e);
    if (scale > fit * 1.001) resetView(true);
    else zoomAt(Math.min(maxScale(), Math.max(1, fit * 2.5)), px, py, true);
  });
  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const [px, py] = rel(e);
    zoomAt(scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), px, py, false);
  }, { passive: false });

  /* -- fotoğraf gösterimi -- */
  /* -- çekim yeri haritası: tek örnek, fotoğraf değişince yeni konuma taşınır -- */
  let photoMap = null;
  const mapEl = document.createElement('div');
  mapEl.className = 'pv-map';
  function syncMap() {
    const slot = $('#pvmap-slot', el), gps = photos[i].exif?.gps;
    if (!slot || !gps) return;
    slot.appendChild(mapEl);
    loadMapLib().then(lib => {
      if (!el.isConnected) return;
      if (!photoMap) photoMap = lib.createPhotoMap(mapEl, { lat: gps.lat, lon: gps.lon, dark: true }); // panel koyu olduğundan koyu harita
      else photoMap.setLocation(gps.lat, gps.lon);
      photoMap.resize();
    }).catch(err => { mapEl.innerHTML = `<div class="map-msg">${esc(err.message)}</div>`; });
  }
  function renderInfo() { $('#pvfi', el).innerHTML = photoInfoHtml(photos[i], nat); syncMap(); }
  function renderBar() {
    const p = photos[i];
    const canDel = me && (p.mine || isAdmin());
    $('#pvb', el).innerHTML = `${me && p.id !== b.coverPhotoId ? '<button type="button" id="lc">Kapak yap</button>' : ''}${me ? '<button type="button" id="lcap">Açıklama</button>' : ''}${canDel ? '<button type="button" id="ld">Sil</button>' : ''}
      <a class="btn" href="${esc(p.url)}" target="_blank" rel="noopener">${STATIC ? 'Görseli aç' : 'Orijinali aç'} ↗</a><span class="grow"></span>`;
    $('#lc', el)?.addEventListener('click', () => run(async () => { await api('PATCH', '/api/photos/' + p.id, { makeCover: true }); toast('Kapak güncellendi'); close(); route(); }));
    $('#lcap', el)?.addEventListener('click', () => { const c = prompt('Fotoğraf açıklaması', p.caption || ''); if (c !== null) run(async () => { await api('PATCH', '/api/photos/' + p.id, { caption: c }); close(); route(); }); });
    $('#ld', el)?.addEventListener('click', () => confirm('Fotoğraf silinsin mi?') && run(async () => { await api('DELETE', '/api/photos/' + p.id); toast('Silindi'); close(); route(); }));
  }
  function setNat(w, h) { nat = { w, h }; img.style.width = w + 'px'; img.style.height = h + 'px'; calcFit(); }
  function show(n) {
    i = (n + photos.length) % photos.length;
    const p = photos[i], t = ++token;
    setNat(p.width || 1600, p.height || 1200);
    img.classList.add('loading'); img.src = p.thumb; // önce hazır küçük resim, sonra tam boyut
    resetView(false);
    const full = new Image();
    full.onload = () => {
      if (t !== token) return;
      img.src = p.url; img.classList.remove('loading');
      if (full.naturalWidth && (full.naturalWidth !== nat.w || full.naturalHeight !== nat.h)) { setNat(full.naturalWidth, full.naturalHeight); resetView(false); renderInfo(); }
    };
    full.onerror = () => { if (t === token) img.classList.remove('loading'); };
    full.src = p.url;
    $('#pvc', el).textContent = `${i + 1} / ${photos.length}`;
    $('#pvt', el).innerHTML = `${esc(p.caption || b.plateDisplay)}${p.caption ? ` <span class="muted">· ${esc(b.plateDisplay)}</span>` : ''}`;
    $$('#pvst button', el).forEach(btn => btn.classList.toggle('on', Number(btn.dataset.n) === i));
    $(`#pvst button[data-n="${i}"]`, el)?.scrollIntoView({ block: 'nearest', inline: 'center' });
    renderInfo(); renderBar();
    for (const d of [1, -1]) { const q = photos[(i + d + photos.length) % photos.length]; if (q) new Image().src = q.url; } // komşuları önceden yükle
  }
  const toggleInfo = () => {
    infoOpen = !infoOpen;
    el.classList.toggle('info-open', infoOpen);
    $('#pvi', el).classList.toggle('on', infoOpen);
    try { localStorage.setItem(INFO_KEY, infoOpen ? '1' : '0'); } catch { /* yoksay */ }
    setTimeout(() => { const keepFit = scale <= fit * 1.001; calcFit(); if (keepFit) resetView(false); else { clampPan(); paint(false); } photoMap?.resize(); }, 280);
  };
  const close = () => {
    document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
    token++; photoMap?.destroy(); photoMap = null; el.remove(); document.body.classList.remove('pv-lock');
  };
  el._close = close;
  const onResize = () => { const keepFit = scale <= fit * 1.001; calcFit(); if (keepFit) resetView(false); else { scale = clamp(scale, fit, maxScale()); clampPan(); paint(false); } };
  const onKey = e => {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key;
    if (k === 'Escape') close();
    else if (k === 'ArrowRight') show(i + 1);
    else if (k === 'ArrowLeft') show(i - 1);
    else if (k === 'Home') show(0);
    else if (k === 'End') show(photos.length - 1);
    else if (k === 'i' || k === 'I') toggleInfo();
    else if (k === '+' || k === '=') zoomAt(scale * 1.4, 0, 0, true);
    else if (k === '-' || k === '_') zoomAt(scale / 1.4, 0, 0, true);
    else if (k === '0') resetView(true);
  };
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  $('#pvx', el).addEventListener('click', close);
  $('#pvi', el).addEventListener('click', toggleInfo);
  $('#pvi', el).classList.toggle('on', infoOpen);
  $('#pvp', el)?.addEventListener('click', () => show(i - 1));
  $('#pvn', el)?.addEventListener('click', () => show(i + 1));
  $('#pvst', el)?.addEventListener('click', e => { const btn = e.target.closest('button[data-n]'); if (btn) show(Number(btn.dataset.n)); });
  $('#pvf', el).addEventListener('click', e => {
    const c = e.target.closest('[data-copy]');
    if (c) navigator.clipboard?.writeText(c.dataset.copy).then(() => toast('Koordinat kopyalandı'), () => toast('Kopyalanamadı', true));
  });
  setTimeout(() => { $('#pvh', el)?.classList.add('fade'); }, 3500);
  show(start);
}

/* ---------- 3B kaplamalar: marka + model + kaplama (liste, yükleme, görüntüleyici) ---------- */
const lenFmt = n => String(n).replace('.', ',') + ' m';

/** Admin: bir markanın modeline GLB kaplama yükler. Uzunluk modelde kayıtlıdır (yoksa girilir ve modele yazılır). */
function liveryUploadForm() {
  return `<div class="upload"><h3>Kaplama yükle</h3>
    <p class="muted small">Bir markanın modeline yüklenen kaplama, <b>o modeldeki her araç için</b> geçerlidir. Biçim: <b>GLB</b> (glTF 2.0), araç burnu <b>+Z</b>, yukarı <b>+Y</b>; ölçek uzunluğa göre otomatik ayarlanır. Doku GLB’nin içinde olmalı, Draco/Meshopt sıkıştırması olmamalı.</p>
    <form id="mf">
      <div class="grid2 two">
        <div class="field"><label>Marka</label><div class="row"><select id="mfb">${brandOptions()}</select><button type="button" class="fit sm" id="mfab">+ Marka</button></div></div>
        <div class="field"><label>Model</label><div class="row"><select id="mfm">${modelOptions()}</select><button type="button" class="fit sm" id="mfam">+ Model</button></div></div>
        <div class="field"><label>Kaplama adı</label><input name="livery" maxlength="60" placeholder="Standart, Kocaeli, Osmaniye…" required></div>
        <div class="field"><label>Uzunluk (m)</label><input name="lengthM" id="mfl" inputmode="decimal" maxlength="6" placeholder="örn. 12 veya 13,5" required></div>
      </div>
      <div class="field"><label>GLB dosyası (en fazla 40 MB)</label><input type="file" name="model" accept=".glb,model/gltf-binary" required></div>
      <button class="primary">Yükle</button> <span id="mmsg" class="mono muted"></span>
    </form></div>`;
}

function wireLiveryUpload() {
  const form = $('#mf');
  if (!form) return;
  const bSel = $('#mfb'), mSel = $('#mfm'), lenInp = $('#mfl');
  const catModel = () => catalog.brands.flatMap(x => x.models).find(x => x.id === Number(mSel.value));
  bSel.addEventListener('change', () => { mSel.innerHTML = modelOptions(bSel.value); lenInp.value = ''; });
  mSel.addEventListener('change', () => { const m = catModel(); lenInp.value = m?.lengthM ? String(m.lengthM).replace('.', ',') : ''; }); // uzunluk modelden gelir
  $('#mfab').addEventListener('click', () => {
    const name = prompt('Yeni marka adı');
    if (name) run(async () => { const r = await api('POST', '/api/brands', { name }); await loadCatalog(); bSel.innerHTML = brandOptions(r.id); mSel.innerHTML = modelOptions(r.id); lenInp.value = ''; });
  });
  $('#mfam').addEventListener('click', () => {
    if (!bSel.value) return toast('Önce marka seçin', true);
    const name = prompt('Yeni model adı');
    if (name) run(async () => { const r = await api('POST', '/api/models', { brandId: Number(bSel.value), name }); await loadCatalog(); mSel.innerHTML = modelOptions(bSel.value, r.id); lenInp.value = ''; lenInp.focus(); });
  });
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!mSel.value) return toast('Marka ve model seçin', true);
    const fd = new FormData();
    fd.append('livery', form.livery.value);
    fd.append('lengthM', lenInp.value.trim().replace(/\s*m$/i, ''));
    fd.append('model', form.model.files[0]); // alanlar dosyadan önce
    $('#mmsg').textContent = 'Yükleniyor ve doğrulanıyor…';
    await run(async () => {
      const m = await api('POST', `/api/models/${mSel.value}/models3d`, fd, true);
      toast(m.warnings.length ? 'Yüklendi, uyarılar var: ' + m.warnings[0] : 'Kaplama yüklendi');
      await loadCatalog();
      route();
    }, form.querySelector('button.primary'));
    $('#mmsg').textContent = '';
  });
}

function modelRowHtml(m, i, { showModel }) {
  const tags = [m.lengthM ? lenFmt(m.lengthM) : null, `${m.triangles.toLocaleString('tr-TR')} üçgen`, fmtMB(m.bytes), m.textures ? `${m.textures} doku` : null,
    m.dim ? `${m.dim.z.toFixed(1)} × ${m.dim.x.toFixed(1)} × ${m.dim.y.toFixed(1)}` : null].filter(Boolean);
  const dl = me
    ? `<a class="btn sm" href="/api/models3d/${m.id}/download">.glb indir</a><a class="btn sm" href="/api/models3d/${m.id}/manifest.json">manifest</a>`
    : `<a class="btn sm" href="#/login?next=${encodeURIComponent(location.hash.slice(1))}">İndirmek için giriş yap</a>`;
  return `<li data-id="${m.id}"><span class="no mono">${pad2(i + 1)}</span>
    <div><h3>${esc(m.livery)} <em>kaplaması</em></h3>
      <p>${showModel ? `<a href="#/?model=${m.modelId}">${esc(m.brandName)} ${esc(m.modelName)}</a> · ` : ''}bu modeldeki tüm araçlarda geçerli</p>
      <div class="tags plain">${tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      ${m.warnings.map(w => `<p class="warn">⚠ ${esc(w)}</p>`).join('')}
    </div>
    <div class="side"><div class="acts"><button class="primary sm" data-a="view">3B önizle</button>${dl}</div>
      ${isAdmin() ? '<div class="acts"><button class="link" data-a="edit">Yeniden adlandır</button><button class="link danger" data-a="del">Sil</button></div>' : ''}</div></li>`;
}

function renderModelList(box, models, { showModel, onChange }) {
  if (!models.length) { box.innerHTML = '<p class="muted">Bu modelin henüz 3B kaplaması yok.</p>'; return; }
  box.innerHTML = `<ul class="work">${models.map((m, i) => modelRowHtml(m, i, { showModel })).join('')}</ul>`;
  $$('li[data-id]', box).forEach(li => {
    const m = models.find(x => x.id === Number(li.dataset.id));
    $('[data-a=view]', li).addEventListener('click', () => openViewer(m));
    $('[data-a=del]', li)?.addEventListener('click', () => confirm(`“${m.livery}” kaplaması silinsin mi?`) && run(async () => { await api('DELETE', '/api/models3d/' + m.id); toast('Silindi'); onChange(); }));
    $('[data-a=edit]', li)?.addEventListener('click', () => {
      const name = prompt('Kaplama adı', m.livery);
      if (name && name.trim() !== m.livery) run(async () => { await api('PATCH', '/api/models3d/' + m.id, { livery: name }); toast('Güncellendi'); onChange(); });
    });
  });
}

let viewerLoading = null;
function loadViewerScript() {
  if (window.BusdexViewer) return Promise.resolve();
  viewerLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/vendor/viewer.js'; s.onload = res; s.onerror = () => { viewerLoading = null; rej(new Error('3B görüntüleyici yüklenemedi')); };
    document.head.appendChild(s);
  });
  return viewerLoading;
}

async function openViewer(m) {
  const el = document.createElement('div');
  el.className = 'lightbox';
  el.innerHTML = `<div class="lb-bar"><span class="grow"><b>${esc(m.livery)} kaplaması</b> <span class="stats">· ${esc(m.brandName)} ${esc(m.modelName)}${m.lengthM ? ' · ' + esc(lenFmt(m.lengthM)) : ''}</span></span><button id="vx">Kapat ✕</button></div>
    <div class="viewer-stage" id="vs"><div class="viewer-msg" id="vm">Model yükleniyor…</div></div>
    <div class="lb-bar"><span class="stats grow" id="vstat">Sürükle: döndür · Kaydır: yakınlaştır · Sağ tık: kaydır. Turuncu ok aracın burnu (+Z).</span></div>`;
  document.body.appendChild(el);
  let viewer = null;
  const close = () => { viewer?.dispose(); el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  $('#vx', el).onclick = close;
  try {
    await loadViewerScript();
    if (!el.isConnected) return;
    viewer = window.BusdexViewer.mount($('#vs', el), m.url, { dark: document.documentElement.dataset.theme === 'dark' });
    const { size } = await viewer.ready;
    $('#vm', el)?.remove();
    $('#vstat', el).innerHTML = `${esc(m.triangles.toLocaleString('tr-TR'))} üçgen · ${esc(fmtMB(m.bytes))} · ölçü ${size.z.toFixed(2)} (uzunluk) × ${size.x.toFixed(2)} (genişlik) × ${size.y.toFixed(2)} (yükseklik) model birimi`
      + m.warnings.map(w => `<br><span class="warn">⚠ ${esc(w)}</span>`).join('');
  } catch (e) { const vm = $('#vm', el); if (vm) vm.textContent = 'Model gösterilemedi: ' + e.message; }
}

async function pageModels() {
  const [models] = await Promise.all([api('GET', '/api/models3d'), loadCatalog()]);
  const groups = new Map();
  for (const m of models) { if (!groups.has(m.modelId)) groups.set(m.modelId, []); groups.get(m.modelId).push(m); }
  view().innerHTML = `
    <section class="hero" style="padding-bottom:clamp(24px,4vw,48px)"><div class="wrap">
      <div class="hero-meta"><span>EkoGökhan uyumlu GLB kaplamalar</span><span>${models.length} kaplama · ${groups.size} model</span></div>
      <h1 class="page-title">3B <em>kaplamalar</em></h1>
      <p class="lede"><span class="big">Bir markanın modeline yüklenen kaplama, o modeldeki her araç için geçerlidir. EkoGökhan build editöründe plaka (ya da plaka başı) için marka, model ve kaplama seçin.</span></p>
    </div></section>
    ${sec('01', 'Kaplamalar', models.length ? [...groups.values()].map(g => `<div class="mgroup"><h3 class="mg-title">${esc(g[0].brandName)} <em>${esc(g[0].modelName)}</em> <span class="mono muted">${g[0].lengthM ? esc(lenFmt(g[0].lengthM)) : ''}</span></h3><div id="mg-${g[0].modelId}"></div></div>`).join('') : '<p class="muted">Henüz 3B kaplama yok.</p>')}
    ${isAdmin() ? sec('02', 'Yükle', liveryUploadForm()) : ''}`;
  for (const [id, list] of groups) renderModelList($('#mg-' + id), list, { showModel: false, onChange: route });
  wireLiveryUpload();
}

/* ---------- Markalar ve modeller (herkese açık; yönetim için giriş) ---------- */
async function pageBrands() {
  await loadCatalog();
  const admin = isAdmin();
  const brands = catalog.brands.filter(b => admin || !b.isArchived);
  const chip = m => `<span class="${m.isArchived ? 'off' : ''}"><a href="#/?model=${m.id}">${esc(m.name)}</a>${m.lengthM ? `<span class="len">${esc(lenFmt(m.lengthM))}</span>` : ''}<em>${m.busCount}</em>${admin ? `
      <button class="mini" data-a="rm" data-id="${m.id}" data-n="${esc(m.name)}" title="Yeniden adlandır">✎</button>
      <button class="mini" data-a="lm" data-id="${m.id}" data-v="${m.lengthM ?? ''}" title="Uzunluğu değiştir">↔</button>
      <button class="mini" data-a="am" data-id="${m.id}" data-v="${m.isArchived ? 0 : 1}" title="${m.isArchived ? 'Geri al' : 'Arşivle'}">${m.isArchived ? '↺' : '⊘'}</button>
      <button class="mini danger" data-a="dm" data-id="${m.id}" data-n="${esc(m.name)}" title="Sil">✕</button>` : ''}</span>`;
  const row = (b, i) => `<li><span class="no mono">${pad2(i + 1)}</span>
    <div><h3><a href="#/?brand=${b.id}">${esc(b.name)}</a> ${b.isArchived ? '<span class="badge off">arşiv</span>' : ''}</h3>
      <p class="mono">${b.busCount} otobüs · ${b.models.filter(m => admin || !m.isArchived).length} model</p>
      <div class="tags">${b.models.filter(m => admin || !m.isArchived).map(chip).join('') || '<span style="padding:3px 10px">model yok</span>'}</div>
      ${me ? `<form class="addrow" data-b="${b.id}"><input placeholder="Yeni model ekle" maxlength="60" required><input class="len-in" placeholder="Uzunluk (m)" inputmode="decimal" maxlength="6"><button class="sm">Ekle</button></form>` : ''}</div>
    ${admin ? `<div class="side"><div class="acts"><button class="link" data-a="rb" data-id="${b.id}" data-n="${esc(b.name)}">Yeniden adlandır</button>
      <button class="link" data-a="ab" data-id="${b.id}" data-v="${b.isArchived ? 0 : 1}">${b.isArchived ? 'Geri al' : 'Arşivle'}</button>
      <button class="link danger" data-a="db" data-id="${b.id}" data-n="${esc(b.name)}" data-m="${b.models.length}">Sil</button></div></div>` : ''}</li>`;

  view().innerHTML = `
    <section class="hero" style="padding-bottom:clamp(24px,4vw,48px)"><div class="wrap">
      <div class="hero-meta"><span>marka · model · gövde tipi</span><span>${brands.length} marka</span></div>
      <h1 class="page-title">Markalar <em>&amp; modeller</em></h1>
      ${me ? '' : `<p class="muted">Bir markaya ya da modele tıklayarak o araçları arşivde görün.${STATIC ? '' : ' Marka/model eklemek için giriş yapın.'}</p>`}
    </div></section>
    ${sec('01', 'Markalar', `${me ? `<form id="bf" class="row" style="margin-bottom:24px"><div><label>Yeni marka</label><input id="bn" required maxlength="60" placeholder="örn. Mercedes-Benz"></div><div class="fit"><button class="primary">Marka ekle</button></div></form>` : ''}
      <ul class="work">${brands.map(row).join('') || '<li style="grid-template-columns:1fr"><span class="muted">Henüz marka yok.</span></li>'}</ul>`)}
    ${!admin ? '' : sec('02', 'Gövde tipleri', `<div class="tags plain work" style="display:flex;flex-wrap:wrap;gap:6px;border:0"><span class="tag" style="padding:3px 10px">${catalog.bodyTypes.map(t => `${esc(t.name)}${t.defaultLengthM ? ` · ${t.defaultLengthM} m` : ''}`).join('</span><span class="tag" style="padding:3px 10px">')}</span></div>
      ${admin ? `<form id="tf" class="row" style="margin-top:20px"><div><label>Yeni tip</label><input id="tn" placeholder="Tip adı" required maxlength="60"></div><div><label>Varsayılan uzunluk (m, ops.)</label><input id="tl" inputmode="decimal"></div><div class="fit"><button>Ekle</button></div></form>` : ''}`)}`;

  const again = () => pageBrands();
  $('#bf')?.addEventListener('submit', ev => { ev.preventDefault(); run(async () => { const r = await api('POST', '/api/brands', { name: $('#bn').value }); toast(r.existing ? 'Bu marka zaten var' : 'Marka eklendi'); again(); }); });
  $$('.addrow').forEach(f => f.addEventListener('submit', ev => { ev.preventDefault(); run(async () => { const r = await api('POST', '/api/models', { brandId: Number(f.dataset.b), name: $('input', f).value, lengthM: $('.len-in', f).value.trim().replace(/\s*m$/i, '') || undefined }); toast(r.existing ? 'Bu model zaten var' : 'Model eklendi'); again(); }); }));
  $('#tf')?.addEventListener('submit', ev => { ev.preventDefault(); run(async () => { await api('POST', '/api/body-types', { name: $('#tn').value, defaultLengthM: $('#tl').value.replace(',', '.') || null }); again(); }); });
  $$('button[data-a]').forEach(b => b.addEventListener('click', () => run(async () => {
    const id = b.dataset.id, a = b.dataset.a, n = b.dataset.n;
    if (a === 'rb') { const v = prompt('Yeni marka adı', n); if (!v) return; await api('PATCH', '/api/brands/' + id, { name: v }); }
    else if (a === 'rm') { const v = prompt('Yeni model adı', n); if (!v) return; await api('PATCH', '/api/models/' + id, { name: v }); }
    else if (a === 'lm') { const v = prompt('Modelin uzunluğu (m); silmek için boş bırakın', String(b.dataset.v).replace('.', ',')); if (v === null) return; await api('PATCH', '/api/models/' + id, { lengthM: v.trim().replace(/\s*m$/i, '') || null }); }
    else if (a === 'ab') await api('PATCH', '/api/brands/' + id, { isArchived: b.dataset.v === '1' });
    else if (a === 'am') await api('PATCH', '/api/models/' + id, { isArchived: b.dataset.v === '1' });
    else if (a === 'db') {
      if (!confirm(`“${n}” markası ve ${b.dataset.m} modeli kalıcı olarak silinsin mi? Geri alınamaz.\n(Kullanımdaysa silinemez; o zaman arşivleyin.)`)) return;
      await api('DELETE', '/api/brands/' + id); toast('Marka silindi');
    } else if (a === 'dm') {
      if (!confirm(`“${n}” modeli kalıcı olarak silinsin mi? Geri alınamaz.`)) return;
      await api('DELETE', '/api/models/' + id); toast('Model silindi');
    }
    again();
  })));
}

/* ---------- Otobüs formu (yeni / düzenle) ---------- */
async function pageEdit(plate) {
  const b = await api('GET', '/api/buses/by-plate/' + encodeURIComponent(plate));
  return pageBusForm(b, plate);
}

async function pageBusForm(bus, plateInit) {
  const edit = !!bus;
  view().innerHTML = sec('01', edit ? 'Düzenle' : 'Yeni otobüs', `
    <h1 class="page-title" style="margin-bottom:28px">${edit ? 'Otobüsü <em>düzenle</em>' : 'Yeni <em>otobüs</em>'}</h1>
    <form id="f">
      <div class="grid2 two">
        <div class="field"><label>Plaka</label><input id="plate" value="${esc(bus ? bus.plateDisplay : plateInit)}" ${edit ? 'disabled' : 'required autofocus'} placeholder="34 ABC 123" autocomplete="off">
          ${isAdmin() && !edit ? '<label class="inline"><input type="checkbox" id="skip"> Özel/farklı plaka (format kontrolünü atla)</label>' : ''}</div>
        <div class="field"><label>Uzunluk (m)</label><input id="ln" inputmode="decimal" maxlength="6" placeholder="örn. 12 veya 13,5" value="${esc(bus?.lengthM != null ? String(bus.lengthM).replace('.', ',') : '')}" autocomplete="off"></div>
        <div class="field"><label>Marka</label><div class="row"><select id="br">${brandOptions(bus?.brandId)}</select><button type="button" class="fit sm" id="addbr" title="Listede yoksa yeni marka ekle">+ Marka</button></div></div>
        <div class="field"><label>Model</label><div class="row"><select id="md">${modelOptions(bus?.brandId, bus?.modelId)}</select><button type="button" class="fit sm" id="addmd" title="Seçili markaya yeni model ekle">+ Model</button></div></div>
      </div>
      <div class="field"><label>İşletmeci</label><input id="op" maxlength="100" value="${esc(bus?.operator ?? '')}"></div>
      <div class="field"><label>Notlar</label><textarea id="nt" rows="3" maxlength="2000">${esc(bus?.notes ?? '')}</textarea></div>
      ${edit ? '' : '<div class="field"><label>Fotoğraflar (isteğe bağlı)</label><label class="btn sm" for="ph">Fotoğraf seç</label><input id="ph" type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden"><div id="phstage" class="hidden" style="margin-top:12px"></div></div>'}
      <button class="primary" id="save">${edit ? 'Kaydet' : 'Oluştur'}</button>
      <a class="btn" href="${edit ? '#/bus/' + encodeURIComponent(bus.plate) : '#/'}">Vazgeç</a>
    </form>`, true);

  const brSel = $('#br'), mdSel = $('#md');
  const stager = edit ? null : createStager($('#phstage'), { input: $('#ph') }); // seçilen fotoğraflar önizlenir ve sıralanır
  const lenInp = $('#ln');
  const modelLength = () => catalog.brands.flatMap(x => x.models).find(x => x.id === Number(mdSel.value))?.lengthM;
  const fillLength = () => { const L = modelLength(); if (L && !lenInp.value.trim()) lenInp.value = String(L).replace('.', ','); }; // modelin uzunluğu belliyse otomatik gelir
  brSel.addEventListener('change', () => { mdSel.innerHTML = modelOptions(brSel.value); });
  mdSel.addEventListener('change', fillLength);
  $('#addbr').addEventListener('click', () => {
    const name = prompt('Yeni marka adı');
    if (name) run(async () => { const r = await api('POST', '/api/brands', { name }); await loadCatalog(); brSel.innerHTML = brandOptions(r.id); mdSel.innerHTML = modelOptions(r.id); });
  });
  $('#addmd').addEventListener('click', () => {
    if (!brSel.value) return toast('Önce marka seçin', true);
    const name = prompt('Yeni model adı');
    if (!name) return;
    const len = prompt('Modelin uzunluğu (m) — bilmiyorsanız boş bırakın', lenInp.value.trim());
    run(async () => {
      const r = await api('POST', '/api/models', { brandId: Number(brSel.value), name, lengthM: len ? len.replace(/\s*m$/i, '') : undefined });
      await loadCatalog(); mdSel.innerHTML = modelOptions(brSel.value, r.id); fillLength();
    });
  });
  $('#f').addEventListener('submit', async ev => {
    ev.preventDefault();
    // Gövde tipi, model yılı ve filo no formdan kaldırıldı: gönderilmediği için mevcut kayıtlardaki değerler korunur.
    const payload = {
      modelId: mdSel.value ? Number(mdSel.value) : null,
      lengthM: $('#ln').value.trim().replace(/\s*m$/i, '') || null, // serbest yazılır: 12, 13,5, "12 m"
      operator: $('#op').value, notes: $('#nt').value,
    };
    await run(async () => {
      let plate;
      if (edit) { await api('PATCH', '/api/buses/' + bus.id, payload); plate = bus.plate; }
      else {
        const r = await api('POST', '/api/buses', { ...payload, plate: $('#plate').value, skipFormat: !!$('#skip')?.checked });
        plate = r.plate;
        const files = stager ? stager.files() : [];
        if (files.length) { try { toast(await uploadPhotos(r.id, files)); } catch (e) { toast('Otobüs oluşturuldu ama: ' + e.message, true); } }
      }
      toast('Kaydedildi');
      go('#/bus/' + encodeURIComponent(plate));
    }, $('#save'));
  });
}

/* ---------- Admin: kullanıcılar ---------- */
async function pageUsers() {
  const users = await api('GET', '/api/users');
  view().innerHTML = sec('01', 'Kullanıcılar', `
    <h1 class="page-title" style="margin-bottom:24px">Kullanıcılar</h1>
    <div class="tablewrap"><table><thead><tr><th>Kullanıcı</th><th>Rol</th><th>Durum</th><th>Son giriş</th><th></th></tr></thead><tbody>
    ${users.map(u => `<tr><td>${esc(u.username)}</td><td><span class="badge ${u.role === 'admin' ? 'admin' : ''}">${u.role === 'admin' ? 'admin' : 'kullanıcı'}</span></td>
      <td>${u.isActive ? 'aktif' : '<span class="badge off">pasif</span>'}${u.mustChangePassword ? ' <span class="badge">şifre bekliyor</span>' : ''}</td>
      <td class="mono">${fmtDate(u.lastLoginAt)}</td>
      <td style="white-space:nowrap"><button class="link" data-a="active" data-id="${u.id}" data-v="${u.isActive ? 0 : 1}">${u.isActive ? 'Pasifleştir' : 'Aktifleştir'}</button>
        <button class="link" data-a="role" data-id="${u.id}" data-v="${u.role === 'admin' ? 'user' : 'admin'}">${u.role === 'admin' ? 'Admin’liği al' : 'Admin yap'}</button>
        <button class="link" data-a="pw" data-id="${u.id}">Şifre sıfırla</button></td></tr>`).join('')}
    </tbody></table></div>`, true) + sec('02', 'Yeni kullanıcı', `
    <form id="nf" class="row">
      <div><label>Kullanıcı adı</label><input id="nu" required minlength="3" maxlength="32" autocomplete="off"></div>
      <div><label>Geçici şifre (en az 8)</label><input id="np" required minlength="8" autocomplete="off"></div>
      <div><label>Rol</label><select id="nr"><option value="user">Kullanıcı</option><option value="admin">Admin</option></select></div>
      <div class="fit"><button class="primary">Oluştur</button></div>
    </form><p class="muted small">Kullanıcı ilk girişte bu şifreyi değiştirmek zorunda kalır.</p>`);
  $$('button[data-a]').forEach(b => b.addEventListener('click', () => run(async () => {
    const id = b.dataset.id, a = b.dataset.a;
    if (a === 'active') await api('PATCH', '/api/users/' + id, { isActive: b.dataset.v === '1' });
    else if (a === 'role') await api('PATCH', '/api/users/' + id, { role: b.dataset.v });
    else if (a === 'pw') { const pw = prompt('Yeni geçici şifre (en az 8 karakter)'); if (!pw) return; await api('PATCH', '/api/users/' + id, { password: pw }); }
    toast('Güncellendi'); pageUsers();
  })));
  $('#nf').addEventListener('submit', ev => { ev.preventDefault(); run(async () => {
    await api('POST', '/api/users', { username: $('#nu').value.trim(), password: $('#np').value, role: $('#nr').value });
    toast('Kullanıcı oluşturuldu'); pageUsers();
  }); });
}

/* ---------- Admin: sistem ---------- */
async function pageSystem() {
  const [backups, integ, audit] = await Promise.all([api('GET', '/api/admin/backups'), api('GET', '/api/admin/integrity'), api('GET', '/api/admin/audit?limit=100')]);
  const okAll = integ.dbCheck === 'ok' && !integ.foreignKeyViolations && !integ.missingFiles.length;
  view().innerHTML = sec('01', 'Bütünlük', `
    <h1 class="page-title" style="margin-bottom:20px">Sistem</h1>
    <p>${okAll ? '<span style="color:var(--ok)">✓ Veritabanı sağlam, tüm dosyalar yerinde.</span>' : '<span class="err">Sorun var, aşağıya bakın.</span>'}</p>
    <ul class="small">
      <li>Veritabanı kontrolü: <b>${esc(integ.dbCheck)}</b>, yabancı anahtar ihlali: ${integ.foreignKeyViolations}</li>
      <li>Kayıtlı fotoğraf: ${integ.photosTotal}, diskte eksik dosya: <b class="${integ.missingFiles.length ? 'err' : ''}">${integ.missingFiles.length}</b>, kaydı olmayan dosya: ${integ.orphanFiles.length}</li>
    </ul>
    ${integ.missingFiles.length ? `<pre class="json">${esc(integ.missingFiles.map(m => `#${m.photoId}: ${m.path}`).join('\n'))}</pre>` : ''}`, true)
  + sec('02', 'Yedekler', `
    <div class="cta"><button class="primary" id="bk">Şimdi yedek al</button> <a class="btn" href="/api/admin/export.json" download>JSON dışa aktar</a></div>
    <p class="muted small">Otomatik yedek her açılışta ve 6 saatte bir kontrol edilir (son 14 tutulur). Fotoğraflar ve 3B modeller yedek klasörüne de kopyalanır.</p>
    <div class="tablewrap"><table><tbody>${backups.map(b => `<tr><td class="mono">${esc(b.name)}</td><td class="mono">${(b.bytes / 1024).toFixed(0)} KB</td><td class="mono">${fmtDate(b.createdAt)}</td></tr>`).join('') || '<tr><td class="muted">Henüz yedek yok</td></tr>'}</tbody></table></div>`)
  + sec('03', 'Son işlemler', `<div class="tablewrap"><table><thead><tr><th>Zaman</th><th>Kullanıcı</th><th>İşlem</th><th>Ayrıntı</th></tr></thead><tbody>
    ${audit.map(a => `<tr><td class="mono">${fmtDate(a.created_at)}</td><td>${esc(a.username || '-')}</td><td>${esc(a.action)} ${esc(a.entity)}${a.entity_id ? ' #' + a.entity_id : ''}</td><td class="mono muted">${esc((a.new_json || '').slice(0, 140))}</td></tr>`).join('')}
    </tbody></table></div>`);
  $('#bk').addEventListener('click', e => run(async () => { const r = await api('POST', '/api/admin/backups'); toast(`Yedek alındı: ${r.name}`); pageSystem(); }, e.target));
}

/* ---------- Admin: toplu içe aktarma ---------- */
async function pageImport() {
  await loadCatalog();
  const { dir, files } = await api('GET', '/api/admin/import/list');
  if (!files.length) { view().innerHTML = sec('01', 'İçe aktar', `<h1 class="page-title">İçe <em>aktar</em></h1><p style="margin-top:18px">Aktarılacak fotoğraf kalmadı.</p><p class="muted mono">Kaynak klasör: ${esc(dir)}</p>`, true); return; }
  view().innerHTML = sec('01', 'İçe aktar', `
    <h1 class="page-title" style="margin-bottom:12px">İçe <em>aktar</em></h1>
    <p class="muted small">${files.length} fotoğraf kaldı. Aynı plakaya ait fotoğrafları seçin, plakayı ve bilgileri girip aktarın. Kaynak: <span class="mono">${esc(dir)}</span></p>
    <div class="import">
      <div><div class="thumbs" id="th">${files.map(f => `<label title="${esc(f)}"><input type="checkbox" value="${esc(f)}"><img loading="lazy" alt="" src="/api/admin/import/preview?w=240&file=${encodeURIComponent(f)}"></label>`).join('')}</div></div>
      <div class="side">
        <img id="big" alt="" style="width:100%;margin-bottom:10px" class="hidden">
        <p id="sel" class="mono muted">Fotoğraf seçin…</p>
        <form id="f">
          <div class="field"><label>Plaka</label><input id="pl" required placeholder="34 ABC 123" autocomplete="off"><label class="inline"><input type="checkbox" id="sk"> Format kontrolünü atla</label></div>
          <div class="field"><label>Marka</label><select id="br">${brandOptions()}</select></div>
          <div class="field"><label>Model</label><select id="md">${modelOptions()}</select></div>
          <div class="field"><label>Gövde tipi</label><select id="bt">${bodyOptions()}</select></div>
          <div class="field"><label>Uzunluk (m)</label><input id="ln" inputmode="decimal" placeholder="18, 12, 10, 8 veya özel"></div>
          <button class="primary" style="width:100%;justify-content:center">Seçilenleri aktar</button>
        </form>
      </div>
    </div>`, true);
  const checked = () => $$('#th input:checked').map(i => i.value);
  $('#th').addEventListener('change', ev => {
    const n = checked().length;
    $('#sel').textContent = n ? `${n} fotoğraf seçili` : 'Fotoğraf seçin…';
    if (ev.target.checked) { const big = $('#big'); big.src = `/api/admin/import/preview?w=700&file=${encodeURIComponent(ev.target.value)}`; big.classList.remove('hidden'); }
  });
  $('#br').addEventListener('change', e => { $('#md').innerHTML = modelOptions(e.target.value); });
  $('#f').addEventListener('submit', ev => { ev.preventDefault(); run(async () => {
    const sel = checked();
    if (!sel.length) return toast('Önce fotoğraf seçin', true);
    const r = await api('POST', '/api/admin/import', {
      files: sel, plate: $('#pl').value, skipFormat: $('#sk').checked,
      modelId: $('#md').value ? Number($('#md').value) : undefined, bodyTypeId: $('#bt').value ? Number($('#bt').value) : undefined,
      lengthM: $('#ln').value.trim() || undefined,
    });
    toast(`${r.imported} fotoğraf ${r.created ? 'yeni kayda' : 'mevcut kayda'} eklendi`);
    pageImport();
  }, $('#f .primary')); });
}

/* ---------- Başlangıç ---------- */
async function start() {
  if (me?.mustChangePassword) return renderChangePassword(true);
  await loadCatalog();
  renderShell();
  if (!location.hash) { location.hash = '#/'; return; } // hashchange route()'u tetikler
  route();
}

(async function boot() {
  if (!STATIC) { try { const r = await api('GET', '/api/me'); me = r.user; csrf = r.csrf; } catch { me = null; } } // user: null = misafir
  try { await start(); }
  catch (e) { app.innerHTML = `<main><section class="sec first"><div class="wrap"><p class="err">Sunucuya ulaşılamadı: ${esc(e.message)}</p></div></section></main>`; }
})();
