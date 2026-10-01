// Belle Trouvé — Smart Alternatives screen (web)
// Mirrors SmartAlternativesView.swift and the Session 47 mockup:
//   idle     → photo-search icon, "Find Budget-Friendly Alternatives", Choose a Photo
//   loading  → the chosen photo, "Choose Different Photo", spinner
//   done     → Identified Item, then one card per alternative, each opening a search at
//              that retailer in a new tab
//   error    → a short message, plus Try Again when there's a photo to retry
// Web difference: "Choose Different Photo" opens the picker straight away (iOS clears the
// screen first), so cancelling the picker keeps the current results.

import { esc } from '../components.js';
import { hydrateIcons } from '../icons.js';
import { alternativeSearchURL } from '../retailers.js';
import {
  getAlternativesState, onAlternativesChange, analyzePhoto, retry, hasRetry, resetAlternatives,
} from '../alternatives.js';

const IDLE = `
  <div class="alt-idle">
    <span class="alt-idle-icon" data-icon="photoSearch"></span>
    <h2>Find Budget-Friendly Alternatives</h2>
    <p>Pick a photo of any fashion item and Gemini will find similar styles for less.</p>
    <button class="alt-choose" type="button" data-choose>
      <span data-icon="studioAlternatives"></span> Choose a Photo
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
    else if (e.target.closest('[data-retry]')) retry();
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
