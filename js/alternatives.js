// Belle Trouvé — Smart Alternatives (web)
// Mirrors SmartAlternativesService.swift: shrinks the chosen photo to 1024px on its longest
// edge, re-encodes it as JPEG (quality 0.7), and POSTs { imageBase64 } to the
// smartAlternatives Cloud Function with the anonymous user's ID token as a Bearer header.
// The function returns { itemIdentified, alternatives: [{ name, brand, priceRange, retailer, searchQuery }] }.
//
// The photo and result live in memory only while you're on the screen: renderAlternatives
// calls resetAlternatives when the screen opens, so leaving and coming back starts fresh,
// as on iOS (Session 56). Nothing is stored.

import { startFavorites } from './favorites.js';
import { getAuthKit } from './firebase.js';

const FUNCTION_URL = 'https://us-central1-chic-vivo.cloudfunctions.net/smartAlternatives';
const MAX_EDGE = 1024;       // same as iOS
const JPEG_QUALITY = 0.7;    // same as iOS

// ── State ─────────────────────────────────────────────────
// status: 'idle' | 'loading' | 'done' | 'error'
let state = { status: 'idle', photoURL: '', result: null, errorMessage: '' };
let lastFile = null;
let runId = 0;               // ignores a stale answer if a new photo was picked meanwhile

const listeners = new Set();
function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

export function getAlternativesState() { return state; }
export function onAlternativesChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function releasePhoto() {
  if (state.photoURL) URL.revokeObjectURL(state.photoURL);
}

/** Clears the photo and results (called when the screen opens). An in-flight search is discarded. */
export function resetAlternatives() {
  runId++;
  releasePhoto();
  lastFile = null;
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
/** Shows the photo straight away, then asks Gemini for alternatives (starts on its own, as on iOS). */
export async function analyzePhoto(file) {
  if (!file) return;
  const id = ++runId;
  lastFile = file;
  releasePhoto();
  const photoURL = URL.createObjectURL(file);
  set({ status: 'loading', photoURL, result: null, errorMessage: '' });

  try {
    const img = await decodeImage(photoURL);
    const imageBase64 = toJpegBase64(img);

    await startFavorites();                  // signs in anonymously (once)
    const { auth } = await getAuthKit();
    if (!auth.currentUser) throw new Error('No signed-in user');
    const idToken = await auth.currentUser.getIdToken();

    let res;
    try {
      res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ imageBase64 }),
      });
    } catch (networkErr) {
      const err = new Error('network');
      err.cause = networkErr;
      throw err;
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);
    const result = cleanResult(data);

    if (id !== runId) return;
    set({ status: 'done', result });
  } catch (err) {
    if (id !== runId) return;
    console.error('[alternatives] failed', err);
    let errorMessage = 'Gemini couldn’t find alternatives for this photo. Please try again, or choose a different photo.';
    if (err.message === 'decode') {
      errorMessage = 'This photo couldn’t be opened. Please try a JPEG or PNG.';
      releasePhoto();
      set({ photoURL: '' });
      lastFile = null;
    } else if (err.message === 'network') {
      errorMessage = 'Couldn’t reach Gemini. Please check your connection and try again.';
    }
    set({ status: 'error', errorMessage });
  }
}

/** Runs the last photo again (after an error). */
export function retry() {
  if (lastFile) analyzePhoto(lastFile);
}

export function hasRetry() { return !!lastFile; }
