// Belle Trouvé — "Shop Similar" retailer links
// Direct port of RetailerLinksService.swift so web and iOS behave identically.
//   • Prefers the search URLs already stored on the card.
//   • Falls back to the local query heuristic for older cards.
//   • eBay first, then Amazon (Session 42 ordering). Both carry affiliate tags.

/** False for technique/hack/tutorial content with no specific purchasable product. */
export function isShoppable(title = '') {
  const lower = title.toLowerCase();

  const nonProductPhrases = [
    'how to', 'look book', 'outfit ideas', 'style guide',
    'trend alert', 'get ready with me',
  ];
  if (nonProductPhrases.some((p) => lower.includes(p))) return false;

  // Whole-word match only (e.g. "tip" must not match "matchstick tip")
  const nonProductWords = new Set([
    'hack', 'tutorial', 'howto', 'diy', 'routine',
    'challenge', 'tips', 'inspo', 'inspiration',
    'lookbook', 'grwm', 'transformation',
  ]);
  const words = lower.split(/\s+/);
  return !words.some((w) => nonProductWords.has(w));
}

/** Shop Similar is shown only when the title is shoppable AND the product isn't flagged as a weak match. */
export function shouldShowShopSimilar(product) {
  return isShoppable(product.title) && product.productConfidence !== 'low';
}

function buildQuery(title, brand) {
  let working = title;

  // 1. Strip brand from the start of the title
  if (brand && working.toLowerCase().startsWith(brand.toLowerCase())) {
    working = working.slice(brand.length).trim();
  }

  // 2. Strip trailing descriptor phrases
  for (const cutoff of [' with ', ' in ', ' for ', ' featuring ']) {
    const i = working.toLowerCase().indexOf(cutoff);
    if (i !== -1) working = working.slice(0, i);
  }

  // 3. Cap at 4 words
  working = working.split(' ').filter(Boolean).slice(0, 4).join(' ');

  // 4. Fragrance hint
  const fragranceMarkers = ['eau de parfum', 'eau de toilette', 'eau de cologne', 'parfum', 'fragrance', 'perfume', 'edp', 'edt'];
  const titleLower = title.toLowerCase();
  const wl = working.toLowerCase();
  if (fragranceMarkers.some((m) => titleLower.includes(m)) &&
      !wl.includes('perfume') && !wl.includes('parfum') && !wl.includes('fragrance')) {
    working += ' perfume';
  }

  // 5. Prepend brand
  return brand ? `${brand} ${working}` : working;
}

function buildLink(retailer, query) {
  const q = encodeURIComponent(query);
  switch (retailer) {
    case 'eBay':
      return { name: 'eBay', url: `https://www.ebay.com/sch/i.html?_nkw=${q}&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339205365&toolid=10001&mkevt=1` };
    case 'Amazon':
      return { name: 'Amazon', url: `https://www.amazon.com/s?k=${q}&tag=belletrouve-20` };
    default:
      return { name: retailer, url: `https://www.google.com/search?q=${q}+${encodeURIComponent(retailer)}&tbm=shop` };
  }
}

export function retailerLinks(product) {
  if (product.ebaySearchURL && product.amazonSearchURL) {
    return [
      { name: 'eBay', url: product.ebaySearchURL },
      { name: 'Amazon', url: product.amazonSearchURL },
    ];
  }
  const query = buildQuery(product.title, product.brand);
  return [buildLink('eBay', query), buildLink('Amazon', query)];
}

// ── Smart Alternatives (Session 56) ────────────────────────────────────────
// Port of AlternativeCard.retailerURL in SmartAlternativesView.swift: a search at the suggested
// retailer, using the suggested search query. Order matters (Nordstrom Rack before Nordstrom,
// Banana Republic before Gap). eBay is added for the web with the EPN affiliate link.
// Anything unrecognized falls back to Google Shopping, as on iOS.
const ALTERNATIVE_RETAILERS = [
  { match: ['amazon'],             url: (q) => `https://www.amazon.com/s?k=${q}&tag=belletrouve-20` },
  { match: ['ebay'],               url: (q) => `https://www.ebay.com/sch/i.html?_nkw=${q}&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339205365&toolid=10001&mkevt=1` },
  { match: ['target'],             url: (q) => `https://www.target.com/s?searchTerm=${q}` },
  { match: ['asos'],               url: (q) => `https://www.asos.com/us/search/?q=${q}` },
  { match: ['zara'],               url: (q) => `https://www.zara.com/us/en/search?searchTerm=${q}` },
  { match: ['h&m', 'h and m'],     url: (q) => `https://www2.hm.com/en_us/search-results.html?q=${q}` },
  { match: ['walmart'],            url: (q) => `https://www.walmart.com/search?q=${q}` },
  { match: ['nordstrom rack'],     url: (q) => `https://www.nordstromrack.com/sr?origin=keywordsearch&keyword=${q}` },
  { match: ['nordstrom'],          url: (q) => `https://www.nordstrom.com/sr?origin=keywordsearch&keyword=${q}` },
  { match: ['mango'],              url: (q) => `https://shop.mango.com/us/search?q=${q}` },
  { match: ['free people'],        url: (q) => `https://www.freepeople.com/search/?q=${q}` },
  { match: ['anthropologie'],      url: (q) => `https://www.anthropologie.com/search?q=${q}` },
  { match: ['revolve'],            url: (q) => `https://www.revolve.com/search/?q=${q}` },
  { match: ['urban outfitters'],   url: (q) => `https://www.urbanoutfitters.com/search?q=${q}` },
  { match: ['uniqlo'],             url: (q) => `https://www.uniqlo.com/us/en/search?q=${q}` },
  { match: ['banana republic'],    url: (q) => `https://bananarepublic.gap.com/browse/search.do?searchText=${q}` },
  { match: ['gap'],                url: (q) => `https://www.gap.com/browse/search.do?searchText=${q}` },
  { match: ['coach'],              url: (q) => `https://www.coach.com/search?q=${q}` },
  { match: ['kate spade'],         url: (q) => `https://www.katespade.com/search?q=${q}` },
];

export function alternativeSearchURL(retailer = '', searchQuery = '') {
  const lower = retailer.toLowerCase();
  const q = encodeURIComponent(searchQuery);
  const known = ALTERNATIVE_RETAILERS.find((r) => r.match.some((m) => lower.includes(m)));
  if (known) return known.url(q);
  return `https://www.google.com/search?q=${encodeURIComponent(`${searchQuery} ${retailer}`.trim())}&tbm=shop`;
}
