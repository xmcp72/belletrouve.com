// Belle Trouvé — Product Detail
// Mirrors ProductDetailView.swift: hero image, back + favorite, platform badge,
// Try It On, title / "By brand", and "Shop Similar" retailer search links.
// Web additions: Share button (Web Share sheet, or copy link) and a short
// affiliate note linking to the disclosure.

import { fetchProduct } from '../feed.js';
import { esc, platformBadge, pageHead, toast } from '../components.js';
import { hydrateIcons } from '../icons.js';
import { shouldShowShopSimilar, retailerLinks } from '../retailers.js';
import { startFavorites, isFavorite, onFavoritesChange, toggleFavorite } from '../favorites.js';

let unsubscribeFavs = null;

export async function renderProduct(view, { params, goBack }) {
  unsubscribeFavs?.();
  unsubscribeFavs = null;

  view.innerHTML = skeleton();
  hydrateIcons(view);
  wireBack(view, goBack);

  let product;
  try {
    product = await fetchProduct(params.id);
  } catch (err) {
    console.error('[product] load failed', err);
    return renderMessage(view, 'We couldn’t load this find', 'Please check your connection and try again.', true);
  }
  if (!view.isConnected || view.dataset.routeKey !== `product:${params.id}`) return; // navigated away

  if (!product || !product.isActive || !product.imageURL) {
    return renderMessage(view, 'This find is no longer available', 'Trends move fast — there’s plenty more to discover.');
  }

  document.title = `${product.title} — Belle Trouvé`;
  const showShop = shouldShowShopSimilar(product);
  const links = showShop ? retailerLinks(product) : [];

  view.innerHTML = `
    <article class="pd">
      ${toolbar()}
      <div class="pd-layout">
        <div class="pd-media">
          <div class="pd-image">
            <img src="${esc(product.imageURL)}" alt="${esc(product.title)}" decoding="async">
          </div>
          <div class="pd-media-bar">
            ${platformBadge(product)}
            <a class="try-on-btn" href="/studio/try-on?item=${encodeURIComponent(product.id)}">
              <span data-icon="camera"></span> Try It On
            </a>
          </div>
        </div>

        <div class="pd-info">
          <h1 class="pd-title">${esc(product.title)}</h1>
          ${product.brand ? `<p class="pd-brand">By ${esc(product.brand)}</p>` : ''}

          ${showShop ? `
            <hr class="pd-divider">
            <h2 class="pd-section-title">Shop Similar</h2>
            ${links.length ? `
              <p class="pd-subline">Search these retailers for this item or close matches:</p>
              <div class="retailer-list">
                ${links.map((l) => `
                  <a class="retailer-row" href="${esc(l.url)}" target="_blank" rel="noopener sponsored">
                    <span class="retailer-icon" data-icon="external"></span>
                    <span class="retailer-name">${esc(l.name)}</span>
                    <span class="retailer-chevron" data-icon="chevronRight"></span>
                  </a>`).join('')}
              </div>
              <p class="pd-affiliate-note">Belle Trouvé may earn a commission from these links. <a href="/affiliate-disclosure">Learn more</a></p>
            ` : `<p class="pd-subline">No retailers found for this product.</p>`}
          ` : ''}
        </div>
      </div>
    </article>`;

  hydrateIcons(view);
  wireBack(view, goBack);

  const img = view.querySelector('.pd-image img');
  const reveal = () => img.classList.add('loaded');
  if (img.complete && img.naturalWidth) reveal(); else img.addEventListener('load', reveal, { once: true });
  img.addEventListener('error', () => view.querySelector('.pd-image').classList.add('failed'), { once: true });

  // Share
  view.querySelector('[data-share]').addEventListener('click', () => shareProduct(product));

  // Favorite — reflect state as soon as we know it, stay in sync with other tabs
  const favBtn = view.querySelector('[data-fav]');
  const paintFav = () => {
    const on = isFavorite(product.id);
    favBtn.setAttribute('aria-pressed', String(on));
    favBtn.setAttribute('aria-label', on ? 'Remove from Favorites' : 'Save to Favorites');
    favBtn.querySelector('[data-icon]').innerHTML = '';
    favBtn.querySelector('[data-icon]').dataset.icon = on ? 'heartFill' : 'heart';
    delete favBtn.querySelector('[data-icon]').dataset.hydrated;
    hydrateIcons(favBtn);
  };
  paintFav();
  unsubscribeFavs = onFavoritesChange(paintFav);
  startFavorites().catch((err) => console.warn('[favorites] unavailable', err));
  favBtn.addEventListener('click', async () => {
    const adding = !isFavorite(product.id);
    try {
      await toggleFavorite(product);
      toast(adding ? 'Saved to Favorites' : 'Removed from Favorites');
    } catch (err) {
      console.error('[favorites] toggle failed', err);
      toast('Couldn’t update Favorites — please try again');
    }
  });
}

function toolbar() {
  return `
    <div class="pd-toolbar">
      <button class="icon-btn" type="button" data-back aria-label="Back"><span data-icon="chevronLeft"></span></button>
      <div class="pd-toolbar-actions">
        <button class="icon-btn" type="button" data-share aria-label="Share"><span data-icon="share"></span></button>
        <button class="icon-btn fav-btn" type="button" data-fav aria-pressed="false" aria-label="Save to Favorites"><span data-icon="heart"></span></button>
      </div>
    </div>`;
}

function skeleton() {
  return `
    <article class="pd" aria-busy="true">
      ${toolbar().replace('data-share', 'data-share disabled').replace('data-fav', 'data-fav disabled')}
      <div class="pd-layout">
        <div class="pd-media"><div class="pd-image skeleton-block"></div></div>
        <div class="pd-info">
          <div class="sk-line" style="height:26px;width:80%;margin-top:6px"></div>
          <div class="sk-line" style="height:26px;width:55%"></div>
          <div class="sk-line short" style="margin-top:10px"></div>
        </div>
      </div>
    </article>`;
}

function renderMessage(view, title, body, retry = false) {
  view.innerHTML = `
    ${pageHead('Belle Trouvé')}
    <div class="state">
      <h2>${title}</h2>
      <p>${body}</p>
      ${retry ? '<button class="btn-gold" type="button" onclick="location.reload()">Try again</button>' : '<a class="btn-gold" href="/">Back to Discover</a>'}
    </div>`;
  hydrateIcons(view);
}

function wireBack(view, goBack) {
  view.querySelector('[data-back]')?.addEventListener('click', goBack);
}

async function shareProduct(product) {
  const url = `${location.origin}/product/${encodeURIComponent(product.id)}`;
  const data = {
    title: product.title,
    text: product.brand ? `${product.title} by ${product.brand} — found on Belle Trouvé` : `${product.title} — found on Belle Trouvé`,
    url,
  };
  if (navigator.share) {
    try { await navigator.share(data); } catch (err) { /* user cancelled */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch (err) {
    window.prompt('Copy this link:', url);
  }
}
