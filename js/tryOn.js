// Belle Trouvé — Virtual Try-On (web)
// Mirrors TryOnService.swift: the chosen photo is shrunk to 1024px on its longest edge and
// re-encoded as JPEG (0.7), then POSTed to the generateTryOn Cloud Function as
// { idToken, userPhotoBase64, userPhotoMimeType, productImageURL } — note the token goes in
// the body for this function, not a header. The function replies
// { success, imageBase64, mimeType, error }.
//
// Session 56: generateTryOn accepts browser calls from belletrouve.com and localhost only.
//
// The selected item, photo and result live in memory only while you're on the screen:
// renderTryOn calls resetTryOn when the screen opens, so leaving and coming back starts
// fresh, as on iOS (Session 56). Nothing is stored.

import { startFavorites } from './favorites.js';
import { getAuthKit } from './firebase.js';

const FUNCTION_URL = 'https://us-central1-chic-vivo.cloudfunctions.net/generateTryOn';
const MAX_EDGE = 1024;       // same as iOS
const JPEG_QUALITY = 0.7;    // same as iOS

// ── State ─────────────────────────────────────────────────
const INITIAL = {
  product: null,        // { id, title, brand, imageURL, category } — the item to try on
  photoURL: '',         // resized preview of the user's photo (data: URL)
  photoBase64: '',      // the same photo, ready to send
  resultURL: '',        // the composited result (data: URL)
  generating: false,
  errorMessage: '',
};
let state = { ...INITIAL };
let runId = 0;
let epoch = 0;          // bumped on reset, so a photo still loading doesn't land on a fresh screen

const listeners = new Set();
function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

/** Clears everything (called when the screen opens). An in-flight try-on is discarded. */
export function resetTryOn() {
  runId++;
  epoch++;
  state = { ...INITIAL };
}

export function getTryOnState() { return state; }
export function onTryOnChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function canGenerate() { return !!(state.product && state.photoBase64 && !state.generating); }

// ── Item ──────────────────────────────────────────────────
/** Selects an item (or deselects it if it's already selected, like iOS). A new item clears any old result. */
export function toggleProduct(product) {
  if (state.generating) return;
  const same = state.product?.id === product.id;
  set({ product: same ? null : product, resultURL: '', errorMessage: '' });
}

/** Selects an item without toggling (used when arriving from a product page). */
export function selectProduct(product) {
  if (state.generating || !product) return;
  if (state.product?.id === product.id) return;
  set({ product, resultURL: '', errorMessage: '' });
}

// ── Photo ─────────────────────────────────────────────────
function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
    img.src = url;
  });
}

function resizeToJpeg(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('decode');
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';                 // transparent PNGs get white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** Loads, shrinks and shows the chosen photo. A new photo clears any old result. */
export async function choosePhoto(file) {
  if (!file || state.generating) return;
  const e = epoch;
  try {
    const dataURL = resizeToJpeg(await decodeImage(file));
    if (e !== epoch) return;
    set({ photoURL: dataURL, photoBase64: dataURL.split(',')[1], resultURL: '', errorMessage: '' });
  } catch (err) {
    if (e !== epoch) return;
    console.error('[try-on] photo failed', err);
    set({ errorMessage: 'This photo couldn’t be opened. Please try a JPEG or PNG.' });
  }
}

// ── Errors ────────────────────────────────────────────────
// The function returns friendly messages from its body-part check (e.g. "Please use a photo
// that includes your head…") but raw text for technical failures. Show the friendly ones,
// replace the rest.
const GENERIC_ERROR = 'Your try-on couldn’t be created. Please try again, or use a different photo.';

function friendlyError(message = '') {
  const m = String(message).trim();
  if (!m) return GENERIC_ERROR;
  if (m === 'Could not download product image.') return 'This item’s image couldn’t be loaded. Please choose a different item.';
  if (m === 'Gemini did not return an image.') return GENERIC_ERROR;
  const technical = /error|exception|invalid|token|missing|method|status|http|gemini|[{}[\]<>]/i;
  if (m.length > 220 || technical.test(m)) return GENERIC_ERROR;
  return m;
}

// ── Generate ──────────────────────────────────────────────
export async function generate() {
  if (!canGenerate()) return;
  const id = ++runId;
  const { product, photoBase64 } = state;
  set({ generating: true, errorMessage: '', resultURL: '' });

  try {
    await startFavorites();                  // signs in anonymously (once)
    const { auth } = await getAuthKit();
    if (!auth.currentUser) throw new Error('No signed-in user');
    const idToken = await auth.currentUser.getIdToken();

    let res;
    try {
      res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          userPhotoBase64: photoBase64,
          userPhotoMimeType: 'image/jpeg',
          productImageURL: product.imageURL,
        }),
      });
    } catch (networkErr) {
      const err = new Error('network');
      err.cause = networkErr;
      throw err;
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (id !== runId) return;

    if (!res.ok || !data?.success || !data?.imageBase64) {
      console.warn('[try-on] function said:', data?.error || `status ${res.status}`);
      set({ generating: false, errorMessage: friendlyError(data?.error) });
      return;
    }

    const mime = data.mimeType || 'image/jpeg';
    set({ generating: false, resultURL: `data:${mime};base64,${data.imageBase64}` });
  } catch (err) {
    if (id !== runId) return;
    console.error('[try-on] failed', err);
    set({
      generating: false,
      errorMessage: err.message === 'network'
        ? 'Couldn’t reach Gemini. Please check your connection and try again.'
        : GENERIC_ERROR,
    });
  }
}
