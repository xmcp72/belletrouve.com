// Belle Trouvé — Home / Discover

import { fetchHomeFeed, fetchPlatformFeed, PLATFORMS } from '../feed.js';
import { productCard, skeletonCards, wireImages, pageHead, PLATFORM_LABELS } from '../components.js';
import { debugLog } from '../debug.js';

// Remembered across navigation within the visit (so Back from a product keeps the pill)
let selectedPlatform = null; // null = all platforms
let renderToken = 0;

/** Renders Discover. Resolves once the grid has content, so the router can restore scroll. */
export function renderHome(view) {
  view.innerHTML = `
    ${pageHead('Discover')}
    <a class="search-bar" href="/search" role="search" aria-label="Search brands, styles, categories">
      <span data-icon="search"></span>
      <span>Search brands, styles, categories…</span>
    </a>
    <div class="filters" role="group" aria-label="Filter by platform">
      ${PLATFORMS.map((p) => `
        <button class="pill" type="button" data-platform="${p}" aria-pressed="${selectedPlatform === p}">${PLATFORM_LABELS[p]}</button>`).join('')}
    </div>
    <section class="grid" id="feedGrid" aria-live="polite" aria-busy="true"></section>
  `;

  view.querySelector('.filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    // Tapping the selected pill returns to All (matches iOS)
    selectedPlatform = selectedPlatform === btn.dataset.platform ? null : btn.dataset.platform;
    view.querySelectorAll('.pill').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.platform === selectedPlatform)));
    window.scrollTo({ top: 0 });
    loadFeed(view);
  });

  return loadFeed(view);
}

async function loadFeed(view, { force = false } = {}) {
  const grid = view.querySelector('#feedGrid');
  const token = ++renderToken;
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = skeletonCards(10);

  try {
    const items = selectedPlatform
      ? await fetchPlatformFeed(selectedPlatform, { force })
      : await fetchHomeFeed({ force });
    if (token !== renderToken || !grid.isConnected) return; // a newer load superseded this one
    debugLog(`feed loaded: ${items.length} items; first image: ${(items[0]?.imageURL || 'none').slice(0, 90)}`);

    if (!items.length) {
      grid.outerHTML = `
        <div class="state" id="feedGrid">
          <h2>Nothing here yet</h2>
          <p>New finds arrive every morning. Check back soon.</p>
        </div>`;
      return;
    }
    grid.innerHTML = items.map(productCard).join('');
    grid.setAttribute('aria-busy', 'false');
    wireImages(grid);
  } catch (err) {
    console.error('[home] feed load failed', err);
    if (token !== renderToken || !grid.isConnected) return;
    grid.outerHTML = `
      <div class="state" id="feedGrid">
        <h2>We couldn’t load the feed</h2>
        <p>Please check your connection and try again.</p>
        <button class="btn-gold" type="button" data-retry>Try again</button>
      </div>`;
    view.querySelector('[data-retry]').addEventListener('click', () => {
      view.querySelector('#feedGrid').outerHTML = '<section class="grid" id="feedGrid" aria-live="polite"></section>';
      loadFeed(view, { force: true });
    });
  }
}
