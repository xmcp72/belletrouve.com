// Belle Trouvé — shared UI building blocks

export const PLATFORM_LABELS = { instagram: 'Instagram', tiktok: 'TikTok', pinterest: 'Pinterest', curated: 'Curated' };

// Same artwork as the iOS asset catalog (InstagramIcon / TikTokIcon / PinterestIcon)
const PLATFORM_ICONS = {
  instagram: '/img/platforms/instagram.png',
  tiktok:    '/img/platforms/tiktok.svg',
  pinterest: '/img/platforms/pinterest.svg',
};

export function esc(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function productPath(p) {
  return `/product/${encodeURIComponent(p.id)}`;
}

/** Platform badge — opens the original post when we have its URL (matches iOS). */
export function platformBadge(p, extraClass = '') {
  const icon = PLATFORM_ICONS[p.platform];
  if (!icon) return '';
  const label = PLATFORM_LABELS[p.platform];
  const img = `<img src="${icon}" alt="" width="26" height="26">`;
  return p.sourceURL
    ? `<a class="platform-badge ${extraClass}" href="${esc(p.sourceURL)}" target="_blank" rel="noopener" title="View on ${label}" aria-label="View on ${label}">${img}</a>`
    : `<span class="platform-badge ${extraClass}" title="${label}">${img}</span>`;
}

export function productCard(p) {
  // The whole card is clickable via the title link's stretched ::after;
  // the platform badge sits above it so it still opens the original post.
  return `
    <article class="card" data-id="${esc(p.id)}">
      <div class="thumb">
        <img src="${esc(p.imageURL)}" alt="" loading="lazy" decoding="async">
        ${platformBadge(p)}
      </div>
      <div class="card-body">
        <h3 class="card-title"><a class="card-link" href="${productPath(p)}">${esc(p.title)}</a></h3>
        ${p.brand ? `<p class="card-brand">${esc(p.brand)}</p>` : ''}
      </div>
    </article>`;
}

export function skeletonCards(n = 10) {
  return Array.from({ length: n }, () => `
    <div class="card skeleton" aria-hidden="true">
      <div class="thumb"></div>
      <div class="card-body"><div class="sk-line"></div><div class="sk-line short"></div></div>
    </div>`).join('');
}

/** Fade images in once loaded; drop cards whose image fails (expired/blocked URL). */
export function wireImages(root) {
  root.querySelectorAll('.thumb > img:not([data-wired])').forEach((img) => {
    img.dataset.wired = '1';
    const done = () => img.classList.add('loaded');
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => img.closest('.card')?.remove(), { once: true });
    }
  });
}

export function pageHead(title) {
  return `
    <div class="page-head">
      <span class="page-head-spacer"></span>
      <h1 class="page-title">${esc(title)}</h1>
      <button class="menu-btn" type="button" data-action="open-menu" aria-label="Open menu"><span data-icon="menu"></span></button>
    </div>`;
}

/** Small transient message at the bottom of the screen. */
let toastTimer = null;
export function toast(message) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
}

/**
 * Centered confirmation dialog (the web version of an iOS alert). Uses <dialog>, so focus
 * stays inside it, Esc cancels, and clicking outside cancels. Resolves true on confirm.
 */
export function confirmDialog({ title, message = '', confirmLabel = 'Delete', destructive = true } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'bt-dialog';
    dlg.setAttribute('aria-labelledby', 'btDialogTitle');
    dlg.innerHTML = `
      <div class="bt-dialog-body">
        <h2 class="bt-dialog-title" id="btDialogTitle">${esc(title)}</h2>
        ${message ? `<p class="bt-dialog-msg">${esc(message)}</p>` : ''}
        <div class="bt-dialog-actions">
          <button type="button" class="bt-dialog-btn" data-cancel>Cancel</button>
          <button type="button" class="bt-dialog-btn ${destructive ? 'danger' : 'primary'}" data-confirm>${esc(confirmLabel)}</button>
        </div>
      </div>`;

    let confirmed = false;
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-confirm]')) { confirmed = true; dlg.close(); }
      else if (e.target.closest('[data-cancel]') || e.target === dlg) dlg.close();   // e.target === dlg: the backdrop
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(confirmed); }, { once: true });

    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector('[data-cancel]').focus();   // safe default, like iOS
  });
}
