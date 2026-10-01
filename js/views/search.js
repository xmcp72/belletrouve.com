// Belle Trouvé — Search (Session 57)
// Direct port of SearchView.swift:
//   • Filters in the browser over the per-platform feeds (title, brand, category,
//     subcategory and trending tags). Every word typed must match.
//   • Waits for 2 characters, pauses 300 ms after typing, shows at most 50 results.
// Web addition: the committed query lives in the URL (/search?q=…). The query is written
// with history.replaceState (typing never adds history entries), and the router re-runs
// this view on Back, so returning from a product lands on the same results, same scroll.

import { fetchPlatformFeed, PLATFORMS } from '../feed.js';
import { productCard, skeletonCards, wireImages, esc } from '../components.js';
import { hydrateIcons } from '../icons.js';

const MIN_CHARS = 2;      // single letters match too broadly
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 50;   // rendering hundreds of cards is slow, so cap it (same as iOS)

// xmark.circle.fill — the X is cut out of the disc so it works on any field colour
const CLEAR_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <defs>
      <mask id="btClearMask">
        <rect width="24" height="24" fill="#fff"/>
        <path d="M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8" stroke="#000" stroke-width="2" stroke-linecap="round"/>
      </mask>
    </defs>
    <circle cx="12" cy="12" r="10" fill="currentColor" mask="url(#btClearMask)"/>
  </svg>`;

const IDLE_HTML = `
  <div class="state search-idle">
    <span class="search-idle-icon" data-icon="search"></span>
    <h2>Search Belle Trouvé</h2>
    <p>Find products by name, brand, or category</p>
  </div>`;

// ── Search pool ───────────────────────────────────────────
// The per-platform feeds Home's platform pills already use (fetchPlatformFeed) — cached for the
// visit, and every product lands in the shared product index, so tapping a result opens instantly.
// The three feeds are merged round-robin (so results mix platforms, like Home) and each product's
// searchable text is built once, not on every keystroke.
let indexPromise = null;
let readyEntries = null;   // set once every platform loaded, so Back from a product paints results synchronously

function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

function searchableText(p) {
  return [p.title, p.brand, p.category, p.subcategory, p.trendingTags.join(' ')].join(' ').toLowerCase();
}

function loadIndex({ force = false } = {}) {
  if (!force && indexPromise) return indexPromise;

  const promise = (async () => {
    const settled = await Promise.allSettled(PLATFORMS.map((p) => fetchPlatformFeed(p, { force })));
    const ok = settled.filter((r) => r.status === 'fulfilled');
    if (!ok.length) throw settled[0].reason;

    const complete = ok.length === settled.length;
    if (!complete) {
      settled.filter((r) => r.status === 'rejected').forEach((r) => console.warn('[search] platform feed failed', r.reason));
      if (indexPromise === promise) indexPromise = null;   // use what loaded now, retry the rest next visit
    }

    const seen = new Set();
    const entries = [];
    for (const product of interleave(ok.map((r) => r.value))) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      entries.push({ product, text: searchableText(product) });
    }
    if (complete) readyEntries = entries;
    return entries;
  })();

  indexPromise = promise;
  promise.catch(() => { if (indexPromise === promise) indexPromise = null; });
  return promise;
}

/** Every word must appear somewhere in the product's searchable text. Under 2 characters → no results. */
function runSearch(entries, rawQuery) {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < MIN_CHARS) return [];
  const words = query.split(/\s+/);

  const out = [];
  for (const entry of entries) {
    if (words.every((w) => entry.text.includes(w))) {
      out.push(entry.product);
      if (out.length === MAX_RESULTS) break;
    }
  }
  return out;
}

// ── Query in the URL ──────────────────────────────────────
function readQuery() {
  return new URLSearchParams(location.search).get('q') || '';
}

function writeQuery(raw) {
  const q = raw.trim();
  const url = location.pathname + (q ? `?q=${encodeURIComponent(q)}` : '');
  if (url === location.pathname + location.search) return;
  history.replaceState(history.state, '', url);   // keep the router's entry id and depth
}

const isIdle = (q) => q.trim().length < MIN_CHARS;
const plural = (n) => `${n} result${n === 1 ? '' : 's'}`;

// ── View ──────────────────────────────────────────────────
/** Resolves once results (or the idle state) are on screen, so the router can restore scroll. */
export function renderSearch(view, { goBack }) {
  const initial = readQuery();

  view.innerHTML = `
    <h1 class="visually-hidden">Search</h1>
    <div class="search-head">
      <button class="icon-btn back-btn" type="button" data-back aria-label="Back">
        <span data-icon="chevronLeft"></span>
      </button>
      <div class="search-field" role="search">
        <span data-icon="search"></span>
        <input class="search-input" type="text" inputmode="search" enterkeyhint="search"
               autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
               placeholder="Search brands, styles, categories…" aria-label="Search Belle Trouvé"
               value="${esc(initial)}">
        <button class="search-clear" type="button" aria-label="Clear search" hidden>${CLEAR_ICON}</button>
      </div>
    </div>
    <p class="visually-hidden" id="searchStatus" role="status" aria-live="polite"></p>
    <div id="searchBody"></div>`;

  const input = view.querySelector('.search-input');
  const clearBtn = view.querySelector('.search-clear');
  const body = view.querySelector('#searchBody');
  const status = view.querySelector('#searchStatus');

  let committed = initial;      // the query the results on screen are for
  let entries = readyEntries;   // the search pool, once loaded
  let loadFailed = false;
  let timer = null;

  function paint() {
    if (!body.isConnected) return;   // the router has moved on

    if (isIdle(committed)) {
      body.innerHTML = IDLE_HTML;
      status.textContent = '';
      hydrateIcons(body);
      return;
    }

    if (loadFailed) {
      body.innerHTML = `
        <div class="state">
          <h2>We couldn’t load search</h2>
          <p>Please check your connection and try again.</p>
          <button class="btn-gold" type="button" data-retry>Try again</button>
        </div>`;
      status.textContent = '';
      return;
    }

    if (!entries) {
      body.innerHTML = `
        <section class="search-results">
          <h2 class="search-heading">In Belle Trouvé</h2>
          <div class="grid" aria-busy="true">${skeletonCards(8)}</div>
        </section>`;
      return;
    }

    const results = runSearch(entries, committed);
    if (!results.length) {
      body.innerHTML = `
        <section class="search-results">
          <h2 class="search-heading">In Belle Trouvé</h2>
          <p class="search-count">Nothing found for “${esc(committed.trim())}”</p>
        </section>`;
      status.textContent = 'No results';
      return;
    }

    body.innerHTML = `
      <section class="search-results">
        <h2 class="search-heading">In Belle Trouvé</h2>
        <p class="search-count">${plural(results.length)}</p>
        <div class="grid" id="searchGrid">${results.map(productCard).join('')}</div>
      </section>`;
    status.textContent = plural(results.length);
    wireImages(body.querySelector('#searchGrid'));
  }

  /** Make `q` the query: update the URL and the results. */
  function commit(q) {
    clearTimeout(timer);
    committed = q;
    writeQuery(q);
    paint();
  }

  function load(force = false) {
    return loadIndex({ force })
      .then((loaded) => { entries = loaded; loadFailed = false; })
      .catch((err) => { console.error('[search] load failed', err); loadFailed = true; })
      .then(paint);
  }

  // Back (real Back if we came from inside the app, else Home)
  view.querySelector('[data-back]').addEventListener('click', () => goBack('/'));

  // Typing: under 2 characters shows the idle state straight away; otherwise wait for a 300 ms pause
  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    clearTimeout(timer);
    if (isIdle(input.value)) { commit(input.value); return; }
    timer = setTimeout(() => { if (input.isConnected) commit(input.value); }, DEBOUNCE_MS);
  });

  // Return/Search: skip the wait, and put the keyboard away on touch devices (like iOS)
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    commit(input.value);
    if (window.matchMedia('(hover: none)').matches) input.blur();
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    commit('');
    input.focus();
  });

  body.addEventListener('click', (e) => {
    if (!e.target.closest('[data-retry]')) return;
    loadFailed = false;
    entries = null;
    paint();
    load(true);
  });

  clearBtn.hidden = !input.value;
  paint();
  if (!initial) input.focus({ preventScroll: true });   // fresh visit: ready to type (not when returning to results)

  // Load even when idle, so the pool is warm by the time the first query is typed (iOS does this onAppear)
  return entries ? Promise.resolve() : load();
}
