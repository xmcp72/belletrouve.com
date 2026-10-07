// Belle Trouvé — feed data layer
// Mirrors FirestoreService.swift so web and iOS show the same feed:
//   • Home: per-platform queries (isActive == true, platform == x,
//     engagementScore DESC, limit 100) → branded-first → round-robin interleave.
//     Uses the existing composite index (isActive ASC, platform ASC, engagementScore DESC).
//   • Platform pill: single query (isActive == true, platform == x, limit 300).
//   • Product Detail: instant from anything already loaded, else a single getDoc.

import { getFirestoreKit } from './firebase.js';

export const PLATFORMS = ['instagram', 'tiktok', 'pinterest'];

const CATEGORIES = ['Accessories', 'Apparel', 'Beauty & Wellness', 'Handbags', 'Jewelry', 'Shoes'];

function normalizeCategory(raw = '') {
  const n = String(raw).toLowerCase().replace(' and ', ' & ');
  return CATEGORIES.find((c) => c.toLowerCase() === n) || 'Apparel';
}

function normalizePlatform(raw = '') {
  const p = String(raw).toLowerCase();
  return PLATFORMS.includes(p) ? p : 'curated';
}

export function toProduct(doc) {
  const d = doc.data() || {};
  return {
    id: doc.id,
    title: d.title || 'Untitled',
    brand: d.brand || '',
    imageURL: d.imageURL || '',
    affiliateURL: d.affiliateURL || '',
    platform: normalizePlatform(d.platform),
    category: normalizeCategory(d.category),
    subcategory: d.subcategory || '',
    trendingTags: Array.isArray(d.trendingTags) ? d.trendingTags : [],
    sourceURL: d.sourceURL || '',
    productConfidence: d.productConfidence || 'high',
    brandConfidence: d.brandConfidence || 'high',
    ebaySearchURL: d.ebaySearchURL || '',
    amazonSearchURL: d.amazonSearchURL || '',
    isActive: d.isActive !== false,
    engagementScore: Number(d.engagementScore) || 0,
    // Session 54: when this item was first added (ms). 0 for items written before the field existed.
    firstSeenAt: typeof d.firstSeenAt?.toMillis === 'function' ? d.firstSeenAt.toMillis() : 0,
  };
}

/** Branded products float to the top; order within each group is preserved. */
function brandedFirst(list) {
  return [...list.filter((p) => p.brand), ...list.filter((p) => !p.brand)];
}

/**
 * Home only: items first seen in the last 24h come first, so daily users see new content
 * before yesterday's. Order within each group is preserved. Items without firstSeenAt
 * (written before the field existed) count as older.
 */
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;
function freshFirst(list) {
  const cutoff = Date.now() - FRESH_WINDOW_MS;
  return [...list.filter((p) => p.firstSeenAt >= cutoff), ...list.filter((p) => p.firstSeenAt < cutoff)];
}

/** Round-robin: [A1,B1,C1,A2,B2,C2,…] */
function interleave(lists) {
  const out = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

const cache = new Map();          // feed lists by key
const productIndex = new Map();   // every product we've seen, by id

function remember(items) {
  items.forEach((p) => productIndex.set(p.id, p));
  return items;
}

export async function fetchHomeFeed({ perPlatform = 100, force = false } = {}) {
  if (!force && cache.has('home')) return cache.get('home');
  const { db, fs } = await getFirestoreKit();
  const { collection, query, where, orderBy, limit, getDocs } = fs;

  const settled = await Promise.allSettled(
    PLATFORMS.map((p) =>
      getDocs(query(
        collection(db, 'feed_items'),
        where('isActive', '==', true),
        where('platform', '==', p),
        orderBy('engagementScore', 'desc'),
        limit(perPlatform),
      )),
    ),
  );

  const ok = settled.filter((r) => r.status === 'fulfilled');
  if (!ok.length) throw settled[0].reason;
  settled.filter((r) => r.status === 'rejected').forEach((r) => console.warn('[feed] platform query failed', r.reason));

  const lists = ok.map((r) => freshFirst(brandedFirst(r.value.docs.map(toProduct).filter((p) => p.imageURL))));
  const items = remember(interleave(lists));
  cache.set('home', items);
  return items;
}

export async function fetchPlatformFeed(platform, { force = false } = {}) {
  const key = `platform:${platform}`;
  if (!force && cache.has(key)) return cache.get(key);
  const { db, fs } = await getFirestoreKit();
  const { collection, query, where, limit, getDocs } = fs;

  const snap = await getDocs(query(
    collection(db, 'feed_items'),
    where('isActive', '==', true),
    where('platform', '==', platform),
    limit(300),
  ));
  const items = remember(snap.docs.map(toProduct).filter((p) => p.imageURL));
  cache.set(key, items);
  return items;
}

/**
 * Category drill-down. Queries Firestore for the category directly (equality filters only,
 * so no composite index is needed) instead of filtering the Home pool, which only holds the
 * top 100 per platform across ALL categories.
 *   • All platforms: per-platform queries (limit 100 each) → engagement sort → branded first → round-robin
 *   • One platform: single query (limit 300) → engagement sort → branded first
 */
export async function fetchCategoryFeed(category, platform = null, { force = false } = {}) {
  const key = `category:${category}:${platform || 'all'}`;
  if (!force && cache.has(key)) return cache.get(key);
  const { db, fs } = await getFirestoreKit();
  const { collection, query, where, limit, getDocs } = fs;

  // Beauty has been stored both as "Beauty & Wellness" and "Beauty and Wellness"
  const values = category === 'Beauty & Wellness' ? ['Beauty & Wellness', 'Beauty and Wellness'] : [category];
  const byEngagement = (a, b) => b.engagementScore - a.engagementScore;
  const run = async (p, n) => {
    const snap = await getDocs(query(
      collection(db, 'feed_items'),
      where('isActive', '==', true),
      where('category', 'in', values),
      where('platform', '==', p),
      limit(n),
    ));
    return brandedFirst(snap.docs.map(toProduct).filter((x) => x.imageURL).sort(byEngagement));
  };

  let items;
  if (platform) {
    items = await run(platform, 300);
  } else {
    const settled = await Promise.allSettled(PLATFORMS.map((p) => run(p, 100)));
    const ok = settled.filter((r) => r.status === 'fulfilled');
    if (!ok.length) throw settled[0].reason;
    settled.filter((r) => r.status === 'rejected').forEach((r) => console.warn('[feed] category query failed', r.reason));
    items = interleave(ok.map((r) => r.value));
  }
  remember(items);
  cache.set(key, items);
  return items;
}

/** Product already loaded by a feed on this visit (instant), or null. */
export function getCachedProduct(id) {
  return productIndex.get(id) || null;
}

/** Single product by Firestore id — used for shared links / page reloads. Null if missing. */
export async function fetchProduct(id) {
  const cached = getCachedProduct(id);
  if (cached) return cached;
  const { db, fs } = await getFirestoreKit();
  const snap = await fs.getDoc(fs.doc(db, 'feed_items', id));
  if (!snap.exists()) return null;
  const p = toProduct(snap);
  productIndex.set(p.id, p);
  return p;
}

export function clearFeedCache() { cache.clear(); }
