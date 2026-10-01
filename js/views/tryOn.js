// Belle Trouvé — Virtual Try-On screen (web)
// Mirrors VirtualTryOnView.swift and the Session 47 mockup: a large photo box (click it to
// choose a photo; it shows the photo, then the result), a Generate Try-On button, and a
// tray of saved items to pick from. Arriving from a product page's "Try It On"
// (/studio/try-on?item=<id>) preselects that item, like iOS's initialProduct.
//
// Web additions: a Save Image link under a finished result, and a Browse link when there
// are no saves yet. On phones the tray scrolls sideways (as on iOS); on tablet and desktop
// it wraps into rows, which is easier with a mouse.

import { esc } from '../components.js';
import { hydrateIcons } from '../icons.js';
import { startFavorites, getFavorites, favoritesReady, onFavoritesChange } from '../favorites.js';
import { fetchProduct } from '../feed.js';
import {
  getTryOnState, onTryOnChange, toggleProduct, selectProduct, choosePhoto, generate, canGenerate,
  resetTryOn,
} from '../tryOn.js';

const TOUCH = window.matchMedia('(hover: none)').matches;

let cleanups = [];
function cleanup() { cleanups.forEach((off) => off()); cleanups = []; }

function trayThumb(p, selected) {
  return `
    <button class="tryon-thumb" type="button" data-item="${esc(p.id)}" aria-pressed="${selected}"
      aria-label="${esc(p.title)}${p.brand ? ` by ${esc(p.brand)}` : ''}" title="${esc(p.title)}">
      <img src="${esc(p.imageURL)}" alt="" loading="lazy" decoding="async">
    </button>`;
}

const emptyTiles = (n, cls) => Array.from({ length: n }, () => `<span class="tryon-thumb ${cls}" aria-hidden="true"></span>`).join('');

export function renderTryOn(view, { goBack }) {
  cleanup();
  resetTryOn();   // every visit starts fresh, as on iOS (a product-page item is reselected below)

  view.innerHTML = `
    <div class="page-head has-back">
      <button class="icon-btn back-btn" type="button" data-back aria-label="Back to Studio">
        <span data-icon="chevronLeft"></span>
      </button>
      <h1 class="page-title">Virtual Try-On</h1>
      <span class="page-head-spacer"></span>
    </div>
    <div class="tryon">
      <button class="tryon-photo" type="button" data-pick></button>
      <a class="tryon-save" download="belle-trouve-try-on.jpg" hidden>Save Image</a>
      <p class="tryon-error" role="alert" hidden></p>
      <button class="tryon-generate" type="button" disabled>Generate Try-On</button>
      <section class="tryon-tray-wrap" aria-label="Your saved items">
        <p class="tryon-tray-label"></p>
        <div class="tryon-tray"></div>
      </section>
    </div>
    <input class="tryon-file" type="file" accept="image/*" hidden>`;

  const photoBox = view.querySelector('.tryon-photo');
  const saveLink = view.querySelector('.tryon-save');
  const errorLine = view.querySelector('.tryon-error');
  const genBtn = view.querySelector('.tryon-generate');
  const trayLabel = view.querySelector('.tryon-tray-label');
  const tray = view.querySelector('.tryon-tray');
  const fileInput = view.querySelector('.tryon-file');

  view.querySelector('[data-back]').addEventListener('click', () => goBack('/studio'));

  // ── Photo box, button, error ──────────────────────────
  const paintStage = () => {
    const { photoURL, resultURL, generating, errorMessage } = getTryOnState();

    let inner;
    if (resultURL) inner = `<img src="${esc(resultURL)}" alt="Your try-on result">`;
    else if (photoURL) inner = `<img src="${esc(photoURL)}" alt="Your chosen photo">`;
    else {
      inner = `
        <span class="tryon-placeholder">
          <span class="tryon-placeholder-icon" data-icon="studioTryOn"></span>
          <span>${TOUCH ? 'Tap' : 'Click'} to select a photo</span>
        </span>`;
    }
    if (generating) {
      inner += `
        <span class="tryon-overlay" role="status">
          <span class="alt-spinner" aria-hidden="true"></span>
          <span>Generating your try-on…</span>
        </span>`;
    }
    photoBox.innerHTML = inner;
    photoBox.disabled = generating;
    photoBox.setAttribute('aria-label', photoURL ? 'Choose a different photo' : 'Select a photo');
    hydrateIcons(photoBox);

    saveLink.hidden = !resultURL || generating;
    if (resultURL) saveLink.href = resultURL; else saveLink.removeAttribute('href');

    errorLine.textContent = errorMessage;
    errorLine.hidden = !errorMessage;

    genBtn.textContent = generating ? 'Generating…' : 'Generate Try-On';
    genBtn.disabled = !canGenerate();
  };

  // ── Tray ──────────────────────────────────────────────
  const paintTray = () => {
    const { product } = getTryOnState();
    const saves = getFavorites();
    // An item opened from a product page may not be saved — show it first so it's visible
    const items = product && !saves.some((p) => p.id === product.id) ? [product, ...saves] : saves;

    tray.classList.toggle('is-empty', !items.length);
    if (!favoritesReady() && !items.length) {
      trayLabel.textContent = 'Select an item';
      tray.innerHTML = emptyTiles(5, 'skeleton');
      return;
    }
    if (!items.length) {
      trayLabel.innerHTML = 'Save items to try them on · <a href="/browse">Browse finds</a>';
      tray.innerHTML = emptyTiles(5, 'empty');
      return;
    }
    trayLabel.textContent = product ? `Selected: ${product.title}` : 'Select an item';
    tray.innerHTML = items.map((p) => trayThumb(p, p.id === product?.id)).join('');
    tray.querySelectorAll('img').forEach((img) => {
      img.addEventListener('error', () => img.closest('.tryon-thumb')?.classList.add('img-failed'), { once: true });
    });
  };

  const updateSelection = () => {
    const { product } = getTryOnState();
    const inTray = !product || tray.querySelector(`[data-item="${CSS.escape(product.id)}"]`);
    if (!inTray) { paintTray(); return; }
    tray.querySelectorAll('[data-item]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.item === product?.id));
    });
    trayLabel.textContent = product ? `Selected: ${product.title}` : (getFavorites().length ? 'Select an item' : trayLabel.textContent);
  };

  // ── Events ────────────────────────────────────────────
  photoBox.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';                   // so choosing the same photo again still fires
    if (file) choosePhoto(file);
  });
  genBtn.addEventListener('click', () => generate());
  tray.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-item]');
    if (!btn) return;
    const id = btn.dataset.item;
    const { product } = getTryOnState();
    const p = getFavorites().find((f) => f.id === id) || (product?.id === id ? product : null);
    if (p) toggleProduct(p);
  });

  // ── Live updates ──────────────────────────────────────
  const live = (fn) => () => { if (!view.contains(photoBox)) { cleanup(); return; } fn(); };
  cleanups.push(
    onTryOnChange(live(() => { paintStage(); updateSelection(); })),
    onFavoritesChange(live(paintTray)),
  );

  paintStage();
  paintTray();

  // ── Arriving from a product page: /studio/try-on?item=<id> ──
  const itemId = new URLSearchParams(location.search).get('item');

  return startFavorites()
    .then(async () => {
      if (!itemId || !view.contains(photoBox)) return;
      const p = getFavorites().find((f) => f.id === itemId) || await fetchProduct(itemId);
      if (p?.imageURL && view.contains(photoBox)) selectProduct(p);
    })
    .catch((err) => console.warn('[try-on] setup failed', err));
}
