// Belle Trouvé — Smart Alternatives (web)
// Mirrors SmartAlternativesService.swift: shrinks the chosen photo to 1024px on its longest
// edge, re-encodes it as JPEG (quality 0.7), and POSTs { imageBase64 } to the
// smartAlternatives Cloud Function with the anonymous user's ID token as a Bearer header.
// The function returns { itemIdentified, alternatives: [{ name, brand, priceRange, retailer, searchQuery }] }.
//
// Choose from Favorites (Session 72): a saved item's photo can't be read by the browser (its
// image host sends no CORS headers, so a canvas would be blocked), so a favorite is sent as
// { imageURL } and the function downloads the photo itself, as Virtual Try-On does.
//
// The photo and result live in memory only while you're on the screen: renderAlternatives
// calls resetAlternatives when the screen opens, so leaving and coming back starts fresh,
// as on iOS (Session 56). Nothing is stored.

import { startFavorites } from './favorites.js';
import { getAuthKit } from './firebase.js';

const FUNCTION_URL = 'https://us-central1-chic-vivo.cloudfunctions.net/smartAlternatives';
const MAX_EDGE = 1024;       // same as iOS
const JPEG_QUALITY = 0.7;    // same as iOS

const DEFAULT_ERROR = 'Gemini couldn’t find alternatives for this photo. Please try again, or choose a different photo.';

// ── State ─────────────────────────────────────────────────
// status: 'idle' | 'loading' | 'done' | 'error'
let state = { status: 'idle', photoURL: '', result: null, errorMessage: '' };
let lastSource = null;       // { file } or { product } — what "Try Again" runs again
let runId = 0;               // ignores a stale answer if a new photo was picked meanwhile
let photoIsBlob = false;     // a chosen photo is a blob: URL to release; a favorite's is a plain https URL

const listeners = new Set();
function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

export function getAlternativesState() { return state; }
export function onAlternativesChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function releasePhoto() {
  if (state.photoURL && photoIsBlob) URL.revokeObjectURL(state.photoURL);
  photoIsBlob = false;
}

/** Clears the photo and results (called when the screen opens). An in-flight search is discarded. */
export function resetAlternatives() {
  runId++;
  releasePhoto();
  lastSource = null;
  state = { status: 'idle', photoURL: '', result: null, errorMessage: '' };
}

// ── Photo handling ────────────────────────────────────────
function decodeImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}

/** Longest edge capped at 1024px, JPEG at 0.7, returned as base64 without the data: prefix. */
function toJpegBase64(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('decode');
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';                 // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
}

/** Keeps only well-formed alternatives, so a slightly off reply still renders. */
function cleanResult(data) {
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const itemIdentified = text(data?.itemIdentified);
  const alternatives = (Array.isArray(data?.alternatives) ? data.alternatives : [])
    .map((a) => ({
      name: text(a?.name),
      brand: text(a?.brand),
      priceRange: text(a?.priceRange),
      retailer: text(a?.retailer),
      searchQuery: text(a?.searchQuery) || text(a?.name),
    }))
    .filter((a) => a.name && a.retailer);
  if (!itemIdentified && !alternatives.length) throw new Error('Empty result');
  return { itemIdentified, alternatives };
}

// ── Analyze ───────────────────────────────────────────────
/** Signs in (once), POSTs the body, and returns the cleaned result. */
async function requestAlternatives(body) {
  await startFavorites();                  // signs in anonymously (once)
  const { auth } = await getAuthKit();
  if (!auth.currentUser) throw new Error('No signed-in user');
  const idToken = await auth.currentUser.getIdToken();

  let res;
  try {
    res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const err = new Error('network');
    err.cause = networkErr;
    throw err;
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
  if (res.status === 422) throw new Error('favorite-photo');   // the function couldn't download the item's photo
  if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);
  return cleanResult(data);
}

function failureMessage(err) {
  if (err.message === 'decode') return 'This photo couldn’t be opened. Please try a JPEG or PNG.';
  if (err.message === 'favorite-photo') return 'Could not load that item’s photo. Please try another.';
  if (err.message === 'network') return 'Couldn’t reach Gemini. Please check your connection and try again.';
  return DEFAULT_ERROR;
}

/** Shows the photo straight away, then asks Gemini for alternatives (starts on its own, as on iOS). */
export async function analyzePhoto(file) {
  if (!file) return;
  const id = ++runId;
  lastSource = { file };
  releasePhoto();
  const photoURL = URL.createObjectURL(file);
  photoIsBlob = true;
  set({ status: 'loading', photoURL, result: null, errorMessage: '' });

  try {
    const img = await decodeImage(photoURL);
    const imageBase64 = toJpegBase64(img);
    const result = await requestAlternatives({ imageBase64 });

    if (id !== runId) return;
    set({ status: 'done', result });
  } catch (err) {
    if (id !== runId) return;
    console.error('[alternatives] failed', err);
    if (err.message === 'decode') {
      releasePhoto();
      lastSource = null;
      set({ photoURL: '' });
    }
    set({ status: 'error', errorMessage: failureMessage(err) });
  }
}

/** Searches for alternatives to one of the user's favorites (the function downloads its photo). */
export async function analyzeFavorite(product) {
  if (!product?.imageURL) return;
  const id = ++runId;
  lastSource = { product };
  releasePhoto();
  set({ status: 'loading', photoURL: product.imageURL, result: null, errorMessage: '' });

  try {
    const result = await requestAlternatives({ imageURL: product.imageURL });

    if (id !== runId) return;
    set({ status: 'done', result });
  } catch (err) {
    if (id !== runId) return;
    console.error('[alternatives] failed', err);
    set({ status: 'error', errorMessage: failureMessage(err) });
  }
}

/** Runs the last photo or favorite again (after an error). */
export function retry() {
  if (lastSource?.file) analyzePhoto(lastSource.file);
  else if (lastSource?.product) analyzeFavorite(lastSource.product);
}

export function hasRetry() { return !!lastSource; }
