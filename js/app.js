// Belle Trouvé — Web app shell
// Plain ES modules, no build step. Clean URLs (/, /browse, /product/<id>, …) via the
// History API. On GitHub Pages, unknown paths are served 404.html, which hands the
// path back to index.html (see both files) — so shared product links work, and the
// paths are ready for iOS Universal Links when the Share button ships in the app.

import { hydrateIcons, icons } from './icons.js';
import { APP_STORE_URL } from './config.js';
import { renderHome } from './views/home.js';
import { renderProduct } from './views/product.js';
import { renderBrowse, renderCategory } from './views/browse.js';
import { renderFavorites, renderCollection } from './views/favorites.js';
import { renderStudio } from './views/studio.js';
import { renderTryOn } from './views/tryOn.js';
import { renderConsultant } from './views/consultant.js';
import { renderAlternatives } from './views/alternatives.js';
import { renderSearch } from './views/search.js';
import { renderAffiliateDisclosure, renderNotFound } from './views/pages.js';

const NAV = [
  { path: '/',          label: 'Home',      icon: 'home' },
  { path: '/browse',    label: 'Browse',    icon: 'browse' },
  { path: '/favorites', label: 'Favorites', icon: 'heart' },
  { path: '/studio',    label: 'Studio',    icon: 'studio' },
];

// nav: which primary tab stays highlighted (null = none)
const ROUTES = [
  { pattern: /^\/$/,                      key: () => 'home',      render: renderHome,                title: null,                   nav: '/' },
  { pattern: /^\/product\/([^/]+)\/?$/,  key: (m) => `product:${decodeURIComponent(m[1])}`, params: (m) => ({ id: decodeURIComponent(m[1]) }),
                                                                   render: renderProduct,             title: 'Belle Trouvé',         nav: '/' },
  { pattern: /^\/browse\/?$/,             key: () => 'browse',    render: renderBrowse,              title: 'Browse',               nav: '/browse' },
  { pattern: /^\/browse\/([^/]+)\/?$/,   key: (m) => `browse:${decodeURIComponent(m[1])}`, params: (m) => ({ slug: decodeURIComponent(m[1]) }),
                                                                   render: renderCategory,            title: 'Browse',               nav: '/browse' },
  { pattern: /^\/favorites\/?$/,          key: () => 'favorites', render: renderFavorites,           title: 'Favorites',            nav: '/favorites' },
  { pattern: /^\/favorites\/collection\/([^/]+)\/?$/, key: (m) => `collection:${decodeURIComponent(m[1])}`, params: (m) => ({ id: decodeURIComponent(m[1]) }),
                                                                   render: renderCollection,          title: 'Favorites',            nav: '/favorites' },
  { pattern: /^\/studio\/?$/,             key: () => 'studio',    render: renderStudio,              title: 'Studio',               nav: '/studio' },
  { pattern: /^\/studio\/try-on\/?$/,     key: () => 'studio:try-on', render: renderTryOn,         title: 'Virtual Try-On',       nav: '/studio' },
  { pattern: /^\/studio\/style-consultant\/?$/, key: () => 'studio:consultant', render: renderConsultant, title: 'Style Consultant', nav: '/studio' },
  { pattern: /^\/studio\/smart-alternatives\/?$/, key: () => 'studio:alternatives', render: renderAlternatives, title: 'Smart Alternatives', nav: '/studio' },
  { pattern: /^\/search\/?$/,             key: () => 'search',    render: renderSearch,              title: 'Search',               nav: '/' },
  { pattern: /^\/affiliate-disclosure\/?$/, key: () => 'affiliate', render: renderAffiliateDisclosure, title: 'Affiliate Disclosure', nav: null },
];

function matchRoute(pathname) {
  for (const r of ROUTES) {
    const m = pathname.match(r.pattern);
    if (m) return { route: r, match: m };
  }
  return null;
}

const view = document.getElementById('view');

// ── Navigation chrome ─────────────────────────────────────
function buildNav() {
  document.querySelector('[data-nav="side"]').innerHTML = NAV.map((n) =>
    `<a class="sidelink" href="${n.path}" data-nav-path="${n.path}"><span data-icon="${n.icon}"></span><span>${n.label}</span></a>`).join('');
  document.querySelector('[data-nav="top"]').innerHTML = NAV.map((n) =>
    `<a class="navtab" href="${n.path}" data-nav-path="${n.path}">${n.label}</a>`).join('');
  document.querySelector('[data-nav="tab"]').innerHTML = NAV.map((n) =>
    `<a class="tab" href="${n.path}" data-nav-path="${n.path}"><span data-icon="${n.icon}"></span><span>${n.label}</span></a>`).join('');
  document.querySelectorAll('[data-appstore-link]').forEach((a) => { a.href = APP_STORE_URL; });
}

function setActiveNav(navPath) {
  document.querySelectorAll('[data-nav-path]').forEach((a) => {
    const on = navPath !== null && a.dataset.navPath === navPath;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

// ── Router ────────────────────────────────────────────────
const scrollPositions = new Map();   // history entry id → scrollY
let entryId = history.state?.btEntry ?? Date.now();
let inAppDepth = 0;                  // how many in-app navigations deep we are (for Back)
if (!history.state?.btEntry) history.replaceState({ btEntry: entryId, depth: 0 }, '');
else inAppDepth = history.state.depth || 0;

async function render({ restoreScroll = false } = {}) {
  closeMenu();
  // Close any open sheet or confirm dialog (e.g. Back pressed while one was open)
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  const found = matchRoute(location.pathname);
  const isProduct = found?.route.render === renderProduct;
  document.body.classList.toggle('route-product', !!isProduct);

  let result;
  if (found) {
    const { route, match } = found;
    view.dataset.routeKey = route.key(match);
    document.title = route.title ? `${route.title} — Belle Trouvé` : 'Belle Trouvé — Fashion Discovered';
    setActiveNav(route.nav);
    result = route.render(view, { params: route.params ? route.params(match) : {}, goBack });
  } else {
    view.dataset.routeKey = 'notfound';
    document.title = 'Not found — Belle Trouvé';
    setActiveNav(null);
    renderNotFound(view);
  }
  hydrateIcons(view);

  if (!restoreScroll) { window.scrollTo(0, 0); return; }
  const y = scrollPositions.get(entryId) || 0;
  window.scrollTo(0, y);               // cached content renders synchronously enough for this
  try { await result; } catch (e) { /* view handles its own errors */ }
  hydrateIcons(view);
  if (y) window.scrollTo(0, y);        // and again once async content has filled in
}

export function navigate(path, { replace = false } = {}) {
  if (path === location.pathname + location.search) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  scrollPositions.set(entryId, window.scrollY);
  entryId = Date.now();
  if (replace) {
    history.replaceState({ btEntry: entryId, depth: inAppDepth }, '', path);
  } else {
    inAppDepth += 1;
    history.pushState({ btEntry: entryId, depth: inAppDepth }, '', path);
  }
  render();
}

/** Back button on detail pages: real Back if we came from inside the app, else the fallback (Home by default). */
function goBack(fallback) {
  // Click handlers pass the event as the first argument — only a path string counts as a fallback
  const path = typeof fallback === 'string' ? fallback : '/';
  if (inAppDepth > 0) history.back();
  else navigate(path, { replace: true });
}

window.addEventListener('popstate', (e) => {
  scrollPositions.set(entryId, window.scrollY);
  entryId = e.state?.btEntry ?? Date.now();
  inAppDepth = e.state?.depth ?? 0;
  render({ restoreScroll: true });
});
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// Intercept same-origin links that belong to the app (e.g. /privacy/ is a real page and is left alone)
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || !matchRoute(url.pathname)) return;
  e.preventDefault();
  navigate(url.pathname + url.search);
});

// ── Theme (dark default, persisted like BTThemeManager) ──
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#0A1128' : '#F5EDD6';
  document.querySelectorAll('.switch').forEach((s) => s.setAttribute('aria-checked', String(theme === 'dark')));
  // Moon + "Dark Mode" in dark, sun + "Light Mode" in light (matches the iOS menu)
  document.querySelectorAll('[data-theme-icon]').forEach((el) => {
    el.innerHTML = theme === 'dark' ? icons.moon : icons.sun;
    el.dataset.hydrated = '1';
  });
  document.querySelectorAll('[data-theme-label]').forEach((el) => {
    el.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
  });
  try { localStorage.setItem('bt-theme', theme); } catch (e) { /* private mode */ }
}
function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

// ── Menu sheet ────────────────────────────────────────────
const sheet = document.querySelector('.sheet');
const backdrop = document.querySelector('.sheet-backdrop');
let lastFocus = null;

function openMenu() {
  lastFocus = document.activeElement;
  sheet.hidden = false;
  backdrop.hidden = false;
  document.body.classList.add('menu-open');
  sheet.querySelector('.done-btn').focus();
}
function closeMenu() {
  if (sheet.hidden) return;
  sheet.hidden = true;
  backdrop.hidden = true;
  document.body.classList.remove('menu-open');
  lastFocus?.focus?.();
}

// ── Back to top ───────────────────────────────────────────
const toTop = document.querySelector('.to-top');
function onScroll() { toTop.classList.toggle('visible', window.scrollY > 700); }

// ── Global actions ────────────────────────────────────────
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  switch (el.dataset.action) {
    case 'toggle-theme': toggleTheme(); break;
    case 'open-menu':    openMenu(); break;
    case 'close-menu':   closeMenu(); break;
    case 'to-top':       window.scrollTo({ top: 0, behavior: 'smooth' }); break;
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
window.addEventListener('scroll', onScroll, { passive: true });

// ── Boot ──────────────────────────────────────────────────
buildNav();
applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');
hydrateIcons(document);
render();
