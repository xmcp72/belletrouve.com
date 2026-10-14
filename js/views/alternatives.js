// Belle Trouvé — Smart Alternatives screen (web)
// Mirrors SmartAlternativesView.swift and the Session 47 mockup:
//   idle     → photo-search icon, "Find Budget-Friendly Alternatives", Choose a Photo,
//              Choose from Favorites (Session 72)
//   loading  → the chosen photo, "Choose Different Photo", spinner
//   done     → Identified Item, then one card per alternative, each opening a search at
//              that retailer in a new tab
//   error    → a short message, plus Try Again when there's a photo to retry
// Web difference: "Choose Different Photo" opens the picker straight away (iOS clears the
// screen first), so cancelling the picker keeps the current results.
// Choose from Favorites opens a bottom sheet (centered dialog on tablet and desktop) with the
// saved items as a photo grid; tapping one searches for alternatives to it, like Android and iOS.

import { esc } from '../components.js';
import { hydrateIcons } from '../icons.js';
import { alternativeSearchURL } from '../retailers.js';
import { startFavorites, getFavorites, favoritesReady, onFavoritesChange } from '../favorites.js';
import {
  getAlternativesState, onAlternativesChange, analyzePhoto, analyzeFavorite, retry, hasRetry,
  resetAlternatives,
} from '../alternatives.js';

const HEART_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>`;

const IDLE = `
  <div class="alt-idle">
    <span class="alt-idle-icon" data-icon="photoSearch"></span>
    <h2>Find Budget-Friendly Alternatives</h2>
    <p>Pick a photo of any fashion item and Gemini will find similar styles for less.</p>
    <button class="alt-choose" type="button" data-choose>
      <span data-icon="studioAlternatives"></span> Choose a Photo
    </button>
    <button class="alt-choose-fav" type="button" data-choose-fav>
      ${HEART_ICON} Choose from Favorites
    </button>
    <p class="alt-gemini">Uses Google Gemini</p>
  </div>`;

const LOADING = `
  <div class="alt-loading" role="status">
    <span class="alt-spinner" aria-hidden="true"></span>
    <p>Gemini is searching for alternatives…</p>
  </div>`;

function photoSection(url) {
  return `
    <div class="alt-photo-wrap">
      <div class="alt-photo"><img src="${esc(url)}" alt="Your chosen photo"></div>
      <button class="alt-link" type="button" data-choose>Choose Different Photo</button>
    </div>`;
}

function alternativeCard(a) {
  const url = alternativeSearchURL(a.retailer, a.searchQuery);
  return `
    <a class="alt-card" href="${esc(url)}" target="_blank" rel="noopener sponsored"
       aria-label="${esc(`${a.name}${a.brand ? ` by ${a.brand}` : ''}, search at ${a.retailer} (opens in a new tab)`)}">
      <div class="alt-card-text">
        <p class="alt-card-name">${esc(a.name)}</p>
        ${a.brand ? `<p class="alt-card-brand">${esc(a.brand)}</p>` : ''}
        <p class="alt-card-meta">
          ${a.priceRange ? `<span class="alt-price"><span data-icon="tag"></span>${esc(a.priceRange)}</span><span aria-hidden="true">·</span>` : ''}
          <span>${esc(a.retailer)}</span>
        </p>
      </div>
      <span class="alt-card-arrow" data-icon="arrowUpRight"></span>
    </a>`;
}

function resultSection(result) {
  return `
    <section class="alt-result">
      ${result.itemIdentified ? `
        <p class="alt-eyebrow">Identified Item</p>
        <p class="alt-identified">${esc(result.itemIdentified)}</p>
        <hr class="alt-divider">` : ''}
      <h2 class="alt-heading">Budget-Friendly Alternatives</h2>
      ${result.alternatives.length
        ? `<div class="alt-list">${result.alternatives.map(alternativeCard).join('')}</div>
           <p class="alt-note">Each link opens a search at that retailer. Belle Trouvé may earn a commission from qualifying purchases. <a href="/affiliate-disclosure">Affiliate Disclosure</a></p>`
        : `<p class="alt-empty">Gemini couldn’t find close alternatives for this item. Try a clearer photo, or a different item.</p>`}
    </section>`;
}

function errorSection(message) {
  return `
    <div class="alt-error" role="alert">
      <p>${esc(message)}</p>
      ${hasRetry()
        ? '<button class="btn-gold" type="button" data-retry>Try Again</button>'
        : '<button class="btn-gold" type="button" data-choose>Choose a Photo</button>'}
    </div>`;
}

// ── Favorites picker ──────────────────────────────────────
// Built on <dialog> like the collection sheet, so focus stays inside it, Esc closes it, and the
// page behind is inert. Reuses the .bt-sheet look; only the photo grid is new (.alt-fav-grid).
function openFavoritesPicker(onPick) {
  document.querySelector('dialog.bt-sheet')?.close();   // only one at a time

  const dlg = document.createElement('dialog');
  dlg.className = 'bt-sheet';
  dlg.setAttribute('aria-labelledby', 'altFavTitle');
  document.body.appendChild(dlg);

  const paint = () => {
    // The same item can't appear twice (Android drops duplicates too)
    const seen = new Set();
    const items = getFavorites().filter((p) => p.imageURL && !seen.has(p.id) && seen.add(p.id));

    let body;
    if (!favoritesReady() && !items.length) {
      body = `<div class="alt-fav-grid" aria-hidden="true">
        ${Array.from({ length: 6 }, () => '<span class="alt-fav-thumb skeleton"></span>').join('')}
      </div>`;
    } else if (!items.length) {
      body = '<p class="bt-sheet-hint alt-fav-empty">You haven’t saved anything yet. Tap the heart on any item to save it here.</p>';
    } else {
      body = `<div class="alt-fav-grid" role="group" aria-label="Your saved items">
        ${items.map((p) => `
          <button class="alt-fav-thumb" type="button" data-fav="${esc(p.id)}"
            aria-label="${esc(p.title)}${p.brand ? ` by ${esc(p.brand)}` : ''}" title="${esc(p.title)}">
            <img src="${esc(p.imageURL)}" alt="" loading="lazy" decoding="async">
          </button>`).join('')}
      </div>`;
    }

    dlg.innerHTML = `
      <div class="bt-sheet-grabber" aria-hidden="true"></div>
      <h2 class="bt-sheet-title" id="altFavTitle" tabindex="-1">Choose from Favorites</h2>
      ${body}
      <button class="bt-sheet-done" type="button" data-done>Cancel</button>`;
    dlg.querySelectorAll('.alt-fav-thumb img').forEach((img) => {
      img.addEventListener('error', () => img.closest('.alt-fav-thumb')?.classList.add('img-failed'), { once: true });
    });
  };

  const off = onFavoritesChange(paint);
  startFavorites().catch((err) => console.warn('[alternatives] favorites unavailable', err));

  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) {
      // Taps on the sheet's own padding also target the dialog — only close for taps outside it
      const r = dlg.getBoundingClientRect();
      const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (outside) dlg.close();
      return;
    }
    if (e.target.closest('[data-done]')) { dlg.close(); return; }

    const thumb = e.target.closest('[data-fav]');
    if (thumb) {
      const product = getFavorites().find((p) => p.id === thumb.dataset.fav);
      dlg.close();
      if (product) onPick(product);
    }
  });

  dlg.addEventListener('close', () => { off(); dlg.remove(); }, { once: true });

  paint();
  dlg.showModal();
  dlg.querySelector('.bt-sheet-title').focus();   // Tab then reaches the photos
}

let unsubscribe = null;

export function renderAlternatives(view, { goBack }) {
  unsubscribe?.();
  resetAlternatives();   // every visit starts fresh, as on iOS

  view.innerHTML = `
    <div class="page-head has-back">
      <button class="icon-btn back-btn" type="button" data-back aria-label="Back to Studio">
        <span data-icon="chevronLeft"></span>
      </button>
      <h1 class="page-title">Smart Alternatives</h1>
      <span class="page-head-spacer"></span>
    </div>
    <div class="alt" aria-live="polite"></div>
    <input class="alt-file" type="file" accept="image/*" hidden>`;

  const body = view.querySelector('.alt');
  const fileInput = view.querySelector('.alt-file');

  view.querySelector('[data-back]').addEventListener('click', () => goBack('/studio'));

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';                 // so picking the same photo again still fires
    if (file) {
      analyzePhoto(file);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  body.addEventListener('click', (e) => {
    if (e.target.closest('[data-choose]')) fileInput.click();
    else if (e.target.closest('[data-choose-fav]')) {
      openFavoritesPicker((product) => {
        analyzeFavorite(product);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else if (e.target.closest('[data-retry]')) retry();
  });

  const paint = () => {
    if (!body.isConnected) { unsubscribe?.(); unsubscribe = null; return; }
    const { status, photoURL, result, errorMessage } = getAlternativesState();

    let html = photoURL ? photoSection(photoURL) : '';
    if (status === 'loading') html += LOADING;
    else if (status === 'done' && result) html += resultSection(result);
    else if (status === 'error') html += errorSection(errorMessage);
    else html += IDLE;

    body.setAttribute('aria-busy', String(status === 'loading'));
    body.innerHTML = html;
    hydrateIcons(body);
  };

  unsubscribe = onAlternativesChange(paint);
  paint();
}
