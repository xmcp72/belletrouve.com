// Belle Trouvé — Favorites (All Saves / Collections) and Collection detail
// Mirrors FavoritesView.swift, FavoritesCollectionsView.swift and CollectionDetailView.swift,
// plus the Session 47 Favorites web mockups (phone + tablet landscape). Everything renders
// from favorites.js, which reads user_favorites / user_collections directly — no feed needed.

import {
  startFavorites, getFavorites, favoritesReady, onFavoritesChange,
  getCollections, getCollection, collectionsReady, onCollectionsChange,
  collectionItems, collectionCover, deleteCollection,
} from '../favorites.js';
import { productCard, skeletonCards, pageHead, esc, toast, confirmDialog } from '../components.js';
import { hydrateIcons } from '../icons.js';
import { openCollectionSheet, openNewCollection } from '../collectionSheet.js';

const TABS = [
  { key: 'saves',       label: 'All Saves' },
  { key: 'collections', label: 'Collections' },
];

// Remembered for this visit, so coming back from a collection lands on Collections again
let selectedTab = 'saves';
let unsubscribers = [];

const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

const DELETE_MESSAGE = 'This won’t remove the items from your favorites — just this collection.';

function cleanup() {
  unsubscribers.forEach((off) => off());
  unsubscribers = [];
}

/** Re-run paint whenever favorites or collections change, until the view is replaced. */
function liveRepaint(el, paintFn) {
  const repaint = () => {
    if (!el.isConnected) { cleanup(); return; }
    paintFn();
  };
  unsubscribers.push(onFavoritesChange(repaint), onCollectionsChange(repaint));
}

function loadError(el, retry) {
  el.innerHTML = `
    <div class="state">
      <h2>We couldn’t load your favorites</h2>
      <p>Please check your connection and try again.</p>
      <button class="btn-gold" type="button" data-retry>Try again</button>
    </div>`;
  el.querySelector('[data-retry]').addEventListener('click', retry);
}

/** Adds the ••• button (Add to Collection) to each saved card, top-right of the photo. */
function addMoreButtons(root) {
  root.querySelectorAll('.card[data-id] .thumb').forEach((thumb) => {
    const id = thumb.closest('.card').dataset.id;
    const title = thumb.closest('.card').querySelector('.card-title')?.textContent.trim() || 'item';
    thumb.insertAdjacentHTML('beforeend', `
      <button class="more-btn" type="button" data-more="${esc(id)}" aria-label="Add “${esc(title)}” to a collection">
        <span></span><span></span><span></span>
      </button>`);
  });
}

/** One delegated handler per screen for the ••• buttons and the New Collection tile. */
function wireCollectionActions(el) {
  el.addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (more) {
      e.preventDefault();
      const product = getFavorites().find((p) => p.id === more.dataset.more);
      if (product) openCollectionSheet(product);
      return;
    }
    if (e.target.closest('[data-new-collection]')) openNewCollection();
  });
}

/**
 * Fade images in once loaded. Unlike the feed, a saved card whose image fails (e.g. an
 * expired TikTok URL) stays on screen with a plain background — it's still the user's
 * save and they can open it or remove it.
 */
function wireSavedImages(root) {
  root.querySelectorAll('.thumb > img').forEach((img) => {
    const done = () => img.classList.add('loaded');
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => img.closest('.thumb')?.classList.add('img-failed'), { once: true });
    }
  });
}

// ═════════════════════════════════════════════════════════
// Favorites screen
// ═════════════════════════════════════════════════════════
export function renderFavorites(view) {
  cleanup();

  view.innerHTML = `
    ${pageHead('Favorites')}
    <div class="seg" role="tablist" aria-label="Favorites view">
      ${TABS.map((t) => `
        <button class="seg-btn" type="button" role="tab" id="favTab-${t.key}" data-tab="${t.key}"
          aria-controls="favPanel" aria-selected="${t.key === selectedTab}">${t.label}</button>`).join('')}
    </div>
    <div id="favPanel" role="tabpanel" aria-live="polite"></div>`;

  const panel = view.querySelector('#favPanel');
  wireCollectionActions(panel);

  view.querySelector('.seg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn || btn.dataset.tab === selectedTab) return;
    selectedTab = btn.dataset.tab;
    view.querySelectorAll('.seg-btn').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.tab === selectedTab)));
    paint(panel);
  });

  // Keyboard: arrow keys move between the two tabs (standard tablist behavior)
  view.querySelector('.seg').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = view.querySelector(`.seg-btn:not([aria-selected="true"])`);
    next?.focus();
    next?.click();
  });

  liveRepaint(panel, () => paint(panel));
  paint(panel);

  return startFavorites().catch((err) => {
    console.error('[favorites] unavailable', err);
    if (panel.isConnected) loadError(panel, () => renderFavorites(view));
  });
}

function paint(panel) {
  panel.setAttribute('aria-labelledby', `favTab-${selectedTab}`);
  if (selectedTab === 'saves') paintSaves(panel);
  else paintCollections(panel);
  hydrateIcons(panel);
}

// ── All Saves ─────────────────────────────────────────────
function paintSaves(panel) {
  // Favorites load independently of the feed — only show the empty state once the server has answered
  if (!favoritesReady()) {
    panel.setAttribute('aria-busy', 'true');
    panel.innerHTML = `<section class="grid">${skeletonCards(8)}</section>`;
    return;
  }
  panel.setAttribute('aria-busy', 'false');

  const items = getFavorites();
  if (!items.length) {
    panel.innerHTML = `
      <div class="state fav-empty">
        <span class="fav-empty-icon" data-icon="heart"></span>
        <h2>No saved items yet</h2>
        <p>Tap the heart on any item to save it here.</p>
        <a class="btn-gold" href="/">Discover new finds</a>
      </div>`;
    return;
  }

  panel.innerHTML = `<section class="grid" aria-label="Saved items">${items.map(productCard).join('')}</section>`;
  addMoreButtons(panel);
  wireSavedImages(panel);
}

// ── Collections ───────────────────────────────────────────
function paintCollections(panel) {
  // Covers and counts come from saved items, so wait for both listeners
  if (!collectionsReady() || !favoritesReady()) {
    panel.setAttribute('aria-busy', 'true');
    panel.innerHTML = `
      <section class="grid">
        ${Array.from({ length: 4 }, () => '<div class="coll-tile skeleton-block" aria-hidden="true"></div>').join('')}
      </section>`;
    return;
  }
  panel.setAttribute('aria-busy', 'false');

  const newTile = `
    <button class="coll-new" type="button" data-new-collection>
      <span class="coll-new-plus">${PLUS_ICON}</span>
      <span>New Collection</span>
    </button>`;

  const list = getCollections();
  if (!list.length) {
    panel.innerHTML = `
      <div class="state fav-empty">
        <span class="fav-empty-icon" data-icon="browse"></span>
        <h2>No collections yet</h2>
        <p>Create a collection to start organizing your saves.</p>
        <div class="coll-new-solo">${newTile}</div>
      </div>`;
    return;
  }

  panel.innerHTML = `
    <section class="grid" aria-label="Collections">
      ${list.map(collectionTile).join('')}
      ${newTile}
    </section>`;

  panel.querySelectorAll('.coll-tile img').forEach((img) => {
    img.addEventListener('error', () => img.remove(), { once: true });   // navy tile behind the name
  });
}

function collectionTile(c) {
  const count = collectionItems(c).length;
  const cover = collectionCover(c);
  return `
    <a class="coll-tile" href="/favorites/collection/${encodeURIComponent(c.id)}">
      ${cover ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">` : ''}
      <span class="coll-meta">
        <span class="coll-name">${esc(c.name)}</span>
        <span class="coll-count">${count} ${count === 1 ? 'item' : 'items'}</span>
      </span>
    </a>`;
}

// ═════════════════════════════════════════════════════════
// Collection detail  (/favorites/collection/<id>)
// ═════════════════════════════════════════════════════════
export function renderCollection(view, { params, goBack }) {
  cleanup();
  // Back (or the fallback when opened from a link) should land on the Collections tab
  selectedTab = 'collections';
  const back = () => goBack('/favorites');
  let deleting = false;

  view.innerHTML = `
    <div class="page-head has-back has-action">
      <button class="icon-btn back-btn" type="button" data-back aria-label="Back to Favorites">
        <span data-icon="chevronLeft"></span>
      </button>
      <h1 class="page-title" id="collTitle">&nbsp;</h1>
      <button class="icon-btn head-action" type="button" data-delete aria-label="Delete collection" hidden>
        <span data-icon="trash"></span>
      </button>
    </div>
    <p class="page-sub" id="collCount" aria-live="polite"></p>
    <div id="collBody"></div>`;

  const title = view.querySelector('#collTitle');
  const countLine = view.querySelector('#collCount');
  const body = view.querySelector('#collBody');
  const deleteBtn = view.querySelector('[data-delete]');

  view.querySelector('[data-back]').addEventListener('click', back);
  wireCollectionActions(body);

  deleteBtn.addEventListener('click', async () => {
    const c = getCollection(params.id);
    if (!c) return;
    const ok = await confirmDialog({
      title: `Delete “${c.name}”?`,
      message: DELETE_MESSAGE,
      confirmLabel: 'Delete',
    });
    if (!ok || !body.isConnected) return;
    deleting = true;        // don't flash "not found" while we leave
    back();
    try {
      await deleteCollection(c.id);
      toast('Collection deleted');
    } catch (err) {
      console.error('[collections] delete failed', err);
      toast('Couldn’t delete the collection — please try again');
    }
  });

  const paintDetail = () => {
    if (deleting) return;

    if (!collectionsReady() || !favoritesReady()) {
      body.setAttribute('aria-busy', 'true');
      body.innerHTML = `<section class="grid">${skeletonCards(8)}</section>`;
      return;
    }
    body.setAttribute('aria-busy', 'false');

    const c = getCollection(params.id);
    if (!c) {
      title.textContent = 'Collections';
      countLine.textContent = '';
      deleteBtn.hidden = true;
      document.title = 'Collection not found — Belle Trouvé';
      body.innerHTML = `
        <div class="state">
          <h2>Collection not found</h2>
          <p>It may have been deleted, or it was created in another browser.</p>
          <a class="btn-gold" href="/favorites">Back to Favorites</a>
        </div>`;
      return;
    }

    title.textContent = c.name;
    document.title = `${c.name} — Belle Trouvé`;
    deleteBtn.hidden = false;

    const items = collectionItems(c);
    countLine.textContent = items.length ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : '';

    if (!items.length) {
      body.innerHTML = `
        <div class="state fav-empty">
          <span class="fav-empty-icon" data-icon="heart"></span>
          <h2>No items in this collection yet</h2>
          <p>Use the ••• button on any saved item to add it here.</p>
          <a class="btn-gold" href="/favorites" data-to-saves>Go to All Saves</a>
        </div>`;
      body.querySelector('[data-to-saves]').addEventListener('click', () => { selectedTab = 'saves'; });
      hydrateIcons(body);
      return;
    }

    body.innerHTML = `<section class="grid" aria-label="${esc(c.name)}">${items.map(productCard).join('')}</section>`;
    addMoreButtons(body);
    wireSavedImages(body);
  };

  liveRepaint(body, paintDetail);
  paintDetail();

  return startFavorites().catch((err) => {
    console.error('[favorites] unavailable', err);
    if (body.isConnected) loadError(body, () => renderCollection(view, { params, goBack }));
  });
}
