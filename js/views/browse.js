// Belle Trouvé — Browse (category grid) and Category drill-down
// Mirrors BrowseView.swift + CategoryDrillDownView.swift.
// The drill-down queries Firestore for the category directly (see fetchCategoryFeed), so a
// category shows everything we have for it — not just what happens to be in the Home pool.

import { fetchCategoryFeed, PLATFORMS } from '../feed.js';
import { productCard, skeletonCards, wireImages, pageHead, esc, PLATFORM_LABELS } from '../components.js';
import { renderNotFound } from './pages.js';

// Same six categories, order and artwork as iOS (Assets.xcassets → /img/categories)
export const BROWSE_CATEGORIES = [
  { slug: 'accessories',      name: 'Accessories',       image: '/img/categories/accessories.jpg' },
  { slug: 'apparel',          name: 'Apparel',           image: '/img/categories/apparel.jpg' },
  { slug: 'beauty-wellness',  name: 'Beauty & Wellness', image: '/img/categories/beauty.jpg' },
  { slug: 'handbags',         name: 'Handbags',          image: '/img/categories/handbags.jpg' },
  { slug: 'jewelry',          name: 'Jewelry',           image: '/img/categories/jewelry.jpg' },
  { slug: 'shoes',            name: 'Shoes',             image: '/img/categories/shoes.jpg' },
];

const SEARCH_BAR = `
  <a class="search-bar" href="/search" role="search" aria-label="Search brands, styles, categories">
    <span data-icon="search"></span>
    <span>Search brands, styles, categories…</span>
  </a>`;

// ── Browse: category grid ─────────────────────────────────
export function renderBrowse(view) {
  view.innerHTML = `
    ${pageHead('Browse')}
    ${SEARCH_BAR}
    <section class="cat-grid" aria-label="Categories">
      ${BROWSE_CATEGORIES.map((c) => `
        <a class="cat-tile" href="/browse/${c.slug}">
          <img src="${c.image}" alt="" loading="lazy" decoding="async">
          <span class="cat-label">${esc(c.name)}</span>
        </a>`).join('')}
    </section>`;

  // A missing artwork file falls back to the tile's navy background (label stays readable)
  view.querySelectorAll('.cat-tile img').forEach((img) => {
    img.addEventListener('error', () => img.remove(), { once: true });
  });
}

// ── Category drill-down ───────────────────────────────────
let selectedPlatform = null;   // null = all platforms; reset every time a category opens
let renderToken = 0;

export function renderCategory(view, { params, goBack }) {
  const category = BROWSE_CATEGORIES.find((c) => c.slug === params.slug);
  if (!category) { renderNotFound(view); return; }

  selectedPlatform = null;

  view.innerHTML = `
    <div class="page-head has-back">
      <button class="icon-btn back-btn" type="button" data-back aria-label="Back to Browse">
        <span data-icon="chevronLeft"></span>
      </button>
      <h1 class="page-title">${esc(category.name)}</h1>
      <span class="page-head-spacer"></span>
    </div>
    ${SEARCH_BAR}
    <div class="filters" role="group" aria-label="Filter by platform">
      ${PLATFORMS.map((p) => `
        <button class="pill" type="button" data-platform="${p}" aria-pressed="false">${PLATFORM_LABELS[p]}</button>`).join('')}
    </div>
    <section class="grid" id="feedGrid" aria-live="polite" aria-busy="true"></section>`;

  view.querySelector('[data-back]').addEventListener('click', () => goBack('/browse'));

  view.querySelector('.filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    // Tapping the selected pill returns to All (matches iOS)
    selectedPlatform = selectedPlatform === btn.dataset.platform ? null : btn.dataset.platform;
    view.querySelectorAll('.pill').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.platform === selectedPlatform)));
    window.scrollTo({ top: 0 });
    loadCategory(view, category);
  });

  return loadCategory(view, category);
}

async function loadCategory(view, category, { force = false } = {}) {
  const grid = view.querySelector('#feedGrid');
  const token = ++renderToken;
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = skeletonCards(8);

  try {
    const items = await fetchCategoryFeed(category.name, selectedPlatform, { force });
    if (token !== renderToken || !grid.isConnected) return;   // superseded by a newer load

    if (!items.length) {
      grid.outerHTML = `
        <div class="state" id="feedGrid">
          <h2>No items found</h2>
          <p>${selectedPlatform
            ? `Nothing in ${esc(category.name)} from ${PLATFORM_LABELS[selectedPlatform]} yet. Try another platform.`
            : 'New finds arrive every morning. Check back soon.'}</p>
        </div>`;
      return;
    }
    grid.innerHTML = items.map(productCard).join('');
    grid.setAttribute('aria-busy', 'false');
    wireImages(grid);
  } catch (err) {
    console.error('[browse] category load failed', err);
    if (token !== renderToken || !grid.isConnected) return;
    grid.outerHTML = `
      <div class="state" id="feedGrid">
        <h2>We couldn’t load this category</h2>
        <p>Please check your connection and try again.</p>
        <button class="btn-gold" type="button" data-retry>Try again</button>
      </div>`;
    view.querySelector('[data-retry]').addEventListener('click', () => {
      view.querySelector('#feedGrid').outerHTML = '<section class="grid" id="feedGrid" aria-live="polite"></section>';
      loadCategory(view, category, { force: true });
    });
  }
}
