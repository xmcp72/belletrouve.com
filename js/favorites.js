// Belle Trouvé — favorites & collections (web)
// Same data model as iOS FirestoreService, keyed to a Firebase Anonymous Auth user:
//   • Favorites:   user_favorites/{uid}/items/{productID}
//                  { title, brand, imageURL, affiliateURL, platform, category, savedAt }
//   • Collections: user_collections/{uid}/collections/{autoID}
//                  { name, productIDs: [String], createdAt }
// On the web the anonymous user lives in this browser, so web favorites are per-browser
// (no login — matches the app's no-account decision).
//
// Session 55: keeps the full saved items (not just their IDs) and adds collections,
// so the Favorites screen can render straight from this module without the feed.

import { getFirestoreKit, getAuthKit } from './firebase.js';
import { PLATFORM_LABELS } from './components.js';
import { toProduct } from './feed.js';

let started = null;
let uid = null;

// ── State ─────────────────────────────────────────────────
let favIds = new Set();
let favItems = [];            // saved products, newest first
let favoritesLoaded = false;  // true once the server has answered at least once

let collections = [];         // { id, name, productIDs, createdAt(ms) }, oldest first (same as iOS)
let collectionsLoaded = false;

const favListeners = new Set();
const collListeners = new Set();

function notifyFavorites() {
  favListeners.forEach((fn) => { try { fn(favIds); } catch (e) { console.error(e); } });
}
function notifyCollections() {
  collListeners.forEach((fn) => { try { fn(collections); } catch (e) { console.error(e); } });
}

const tsMillis = (ts) => (typeof ts?.toMillis === 'function' ? ts.toMillis() : 0);

function toSavedProduct(doc) {
  // toProduct normalizes platform ("Instagram" → "instagram") and category the same way
  // the feed does. Saved docs don't store sourceURL, so the badge shows without a link (as on iOS).
  const p = toProduct(doc);
  p.savedAt = tsMillis(doc.get('savedAt', { serverTimestamps: 'estimate' }));
  return p;
}

function toCollection(doc) {
  const d = doc.data({ serverTimestamps: 'estimate' }) || {};
  return {
    id: doc.id,
    name: d.name || 'Untitled',
    productIDs: Array.isArray(d.productIDs) ? d.productIDs : [],
    createdAt: tsMillis(d.createdAt),
  };
}

// ── Bootstrap ─────────────────────────────────────────────
/** Signs in anonymously (once) and keeps favorites and collections live. Safe to call repeatedly. */
export function startFavorites() {
  if (!started) {
    started = (async () => {
      const [{ db, fs }, { auth, authMod }] = await Promise.all([getFirestoreKit(), getAuthKit()]);
      await auth.authStateReady();
      const user = auth.currentUser || (await authMod.signInAnonymously(auth)).user;
      uid = user.uid;

      fs.onSnapshot(fs.collection(db, 'user_favorites', uid, 'items'), (snap) => {
        // Skip cache-only snapshots (same ghost-card guard as iOS)
        if (snap.metadata.fromCache) return;
        favItems = snap.docs.map(toSavedProduct)
          .filter((p) => p.imageURL)                       // iOS drops saves with no image too
          .sort((a, b) => b.savedAt - a.savedAt);
        favIds = new Set(snap.docs.map((d) => d.id));
        favoritesLoaded = true;
        notifyFavorites();
      }, (err) => console.warn('[favorites] listener error', err));

      // Sorted in memory rather than with orderBy('createdAt'): a query ordered on a
      // pending server timestamp can drop or misplace a collection that was just created.
      fs.onSnapshot(fs.collection(db, 'user_collections', uid, 'collections'), (snap) => {
        if (snap.metadata.fromCache) return;
        collections = snap.docs.map(toCollection).sort((a, b) => a.createdAt - b.createdAt);
        collectionsLoaded = true;
        notifyCollections();
      }, (err) => console.warn('[collections] listener error', err));
    })().catch((err) => { started = null; throw err; });
  }
  return started;
}

async function userKit() {
  await startFavorites();
  const kit = await getFirestoreKit();
  return { ...kit, uid };
}

// ── Favorites ─────────────────────────────────────────────
export function isFavorite(id) { return favIds.has(id); }

/** Saved products, newest first. */
export function getFavorites() { return favItems; }

/** True once the first server snapshot of favorites has arrived (for loading states). */
export function favoritesReady() { return favoritesLoaded; }

export function onFavoritesChange(fn) {
  favListeners.add(fn);
  return () => favListeners.delete(fn);
}

/** Optimistic toggle — UI updates immediately, Firestore follows. */
export async function toggleFavorite(product) {
  const wasFav = favIds.has(product.id);
  const prevItems = favItems;

  if (wasFav) {
    favIds.delete(product.id);
    favItems = favItems.filter((p) => p.id !== product.id);
  } else {
    favIds.add(product.id);
    favItems = [{ ...product, savedAt: Date.now() }, ...favItems];
  }
  notifyFavorites();

  try {
    const { db, fs, uid: u } = await userKit();
    const ref = fs.doc(db, 'user_favorites', u, 'items', product.id);
    if (wasFav) {
      await fs.deleteDoc(ref);
    } else {
      await fs.setDoc(ref, {
        title: product.title,
        brand: product.brand,
        imageURL: product.imageURL,
        affiliateURL: product.affiliateURL,
        platform: PLATFORM_LABELS[product.platform] || 'Curated',
        category: product.category,
        savedAt: fs.serverTimestamp(),
      });
    }
  } catch (err) {
    // Roll back the optimistic change
    if (wasFav) favIds.add(product.id); else favIds.delete(product.id);
    favItems = prevItems;
    notifyFavorites();
    throw err;
  }
}

// ── Collections ───────────────────────────────────────────
/** User collections, oldest first (same order as iOS). */
export function getCollections() { return collections; }

export function getCollection(id) { return collections.find((c) => c.id === id) || null; }

/** True once the first server snapshot of collections has arrived. */
export function collectionsReady() { return collectionsLoaded; }

export function onCollectionsChange(fn) {
  collListeners.add(fn);
  return () => collListeners.delete(fn);
}

/**
 * The collection's items that are still saved, in the order they were added.
 * Unsaving an item doesn't remove it from collections (same as iOS), so a collection
 * can reference IDs that are no longer favorites — those are skipped here, and views
 * should use this list's length as the item count.
 */
export function collectionItems(collection) {
  if (!collection) return [];
  const byId = new Map(favItems.map((p) => [p.id, p]));
  return collection.productIDs.map((id) => byId.get(id)).filter(Boolean);
}

/** Cover image: the first item in the collection that is still saved (as on iOS). */
export function collectionCover(collection) {
  return collectionItems(collection)[0]?.imageURL || '';
}

export function isInCollection(productId, collectionId) {
  return !!getCollection(collectionId)?.productIDs.includes(productId);
}

/** Replace one collection in local state and notify (used for optimistic updates). */
function patchCollection(id, change) {
  collections = collections.map((c) => (c.id === id ? { ...c, ...change(c) } : c));
  notifyCollections();
}

/** Creates an empty collection. Resolves with its new ID so callers can add to it right away. */
export async function createCollection(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Please enter a collection name.');
  const { db, fs, uid: u } = await userKit();
  const ref = fs.doc(fs.collection(db, 'user_collections', u, 'collections')); // pre-generated ID
  await fs.setDoc(ref, { name: trimmed, productIDs: [], createdAt: fs.serverTimestamp() });
  return ref.id;
}

export async function addToCollection(productId, collectionId) {
  const prev = collections;
  patchCollection(collectionId, (c) => ({
    productIDs: c.productIDs.includes(productId) ? c.productIDs : [...c.productIDs, productId],
  }));
  try {
    const { db, fs, uid: u } = await userKit();
    await fs.updateDoc(fs.doc(db, 'user_collections', u, 'collections', collectionId), {
      productIDs: fs.arrayUnion(productId),
    });
  } catch (err) {
    collections = prev;
    notifyCollections();
    throw err;
  }
}

export async function removeFromCollection(productId, collectionId) {
  const prev = collections;
  patchCollection(collectionId, (c) => ({ productIDs: c.productIDs.filter((id) => id !== productId) }));
  try {
    const { db, fs, uid: u } = await userKit();
    await fs.updateDoc(fs.doc(db, 'user_collections', u, 'collections', collectionId), {
      productIDs: fs.arrayRemove(productId),
    });
  } catch (err) {
    collections = prev;
    notifyCollections();
    throw err;
  }
}

/** Deletes the collection only — its items stay in Favorites. */
export async function deleteCollection(collectionId) {
  const prev = collections;
  collections = collections.filter((c) => c.id !== collectionId);
  notifyCollections();
  try {
    const { db, fs, uid: u } = await userKit();
    await fs.deleteDoc(fs.doc(db, 'user_collections', u, 'collections', collectionId));
  } catch (err) {
    collections = prev;
    notifyCollections();
    throw err;
  }
}
