// Belle Trouvé — secondary pages

import { pageHead } from '../components.js';

// Session 55: Favorites is now a real screen — see views/favorites.js
// Session 56: Studio is now a real screen — see views/studio.js
// Session 57: Search is now a real screen — see views/search.js

export function renderAffiliateDisclosure(view) {
  view.innerHTML = `
    ${pageHead('Affiliate Disclosure')}
    <div class="prose">
      <p>Belle Trouvé participates in affiliate advertising programs. This means we may earn a commission when you tap a product link and make a qualifying purchase, at no additional cost to you. Affiliate relationships never influence which products are curated or how they are ranked.</p>
      <p>As an Amazon Associate, Belle Trouvé earns from qualifying purchases.</p>
      <h3>Retailer partnerships</h3>
      <p>Product links take you to the retailer’s own website to complete any purchase. Belle Trouvé does not process payments, handle shipping, or have access to your payment information. Each retailer’s own privacy policy and terms govern that transaction.</p>
    </div>`;
}

export function renderNotFound(view) {
  view.innerHTML = `
    ${pageHead('Belle Trouvé')}
    <div class="state">
      <h2>Page not found</h2>
      <p>That page doesn’t exist — but there’s plenty to discover.</p>
      <a class="btn-gold" href="/">Back to Discover</a>
    </div>`;
}
