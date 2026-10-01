// Belle Trouvé — Style Consultant (web)
// Mirrors StyleConsultantService.swift: POSTs { message, history, favoritesContext } to the
// styleConsult Cloud Function with the anonymous user's Firebase ID token as a Bearer header,
// and gets back { reply }.
//
// Session 56 difference from iOS: the saves context goes with EVERY message. iOS sends it
// only with the first one, but the function keeps no state between calls, so from the
// second question on the stylist no longer knows what was saved.
//
// The conversation lives in memory only while you're on the screen: renderConsultant calls
// resetConversation when the screen opens, so leaving and coming back starts a new
// conversation, as on iOS (Session 56). Nothing is stored.

import { startFavorites, getFavorites, favoritesReady, onFavoritesChange } from './favorites.js';
import { getAuthKit } from './firebase.js';

const FUNCTION_URL = 'https://us-central1-chic-vivo.cloudfunctions.net/styleConsult';
const MAX_FAVORITES_IN_CONTEXT = 25;   // same cap as iOS
const FAVORITES_WAIT_MS = 3000;        // how long the first send waits for saves to load

// ── State ─────────────────────────────────────────────────
let messages = [];      // { role: 'user' | 'model', text }
let loading = false;
let errorMessage = '';
let draft = '';         // unsent text in the field
let epoch = 0;          // bumped on reset, so a reply still on its way is discarded

const listeners = new Set();
function notify() {
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

/** Starts a new, empty conversation (called when the screen opens). */
export function resetConversation() {
  epoch++;
  messages = [];
  loading = false;
  errorMessage = '';
  draft = '';
}

export function getConversation() { return { messages, loading, errorMessage }; }
export function onConversationChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getDraft() { return draft; }
export function setDraft(text) { draft = text; }
export function clearError() { if (errorMessage) { errorMessage = ''; notify(); } }

// ── Saves context ─────────────────────────────────────────
/** "- Brand Title (Category)" per line, newest saves first, capped like iOS. */
function buildFavoritesContext(items) {
  return items.slice(0, MAX_FAVORITES_IN_CONTEXT).map((p) => {
    const parts = [];
    if (p.brand) parts.push(p.brand);
    parts.push(p.title);
    if (p.category) parts.push(`(${p.category})`);
    return `- ${parts.join(' ')}`;
  }).join('\n');
}

/** Resolves once saves have loaded, or after a short wait so a slow load never blocks sending. */
function waitForFavorites() {
  if (favoritesReady()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = onFavoritesChange(() => { if (favoritesReady()) { off(); clearTimeout(timer); resolve(); } });
    const timer = setTimeout(() => { off(); resolve(); }, FAVORITES_WAIT_MS);
  });
}

/** Signs in (anonymously, once) and starts loading saves, so the first send is quick. */
export function warmUp() {
  return startFavorites().catch((err) => console.warn('[consultant] warm-up failed', err));
}

// ── Send ──────────────────────────────────────────────────
/**
 * Sends a message. On failure the message is taken back out of the conversation (so the
 * history sent next time still alternates user / stylist) and its text is returned, so the
 * screen can put it back in the field. Returns null on success.
 */
export async function sendMessage(text) {
  const message = text.trim();
  if (!message || loading) return null;

  const history = messages.map((m) => ({ role: m.role, text: m.text }));
  const e = epoch;
  messages = [...messages, { role: 'user', text: message }];
  loading = true;
  errorMessage = '';
  notify();

  try {
    await startFavorites();
    await waitForFavorites();
    const { auth } = await getAuthKit();
    if (!auth.currentUser) throw new Error('No signed-in user');
    const idToken = await auth.currentUser.getIdToken();

    let res;
    try {
      res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          message,
          history,
          favoritesContext: buildFavoritesContext(getFavorites()),
        }),
      });
    } catch (networkErr) {
      const err = new Error('network');
      err.cause = networkErr;
      throw err;
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON error page */ }
    if (!res.ok) throw new Error(data?.error || `Server error (${res.status})`);
    const reply = typeof data?.reply === 'string' ? data.reply.trim() : '';
    if (!reply) throw new Error('Empty reply');

    if (e !== epoch) return null;          // left the screen meanwhile — discard
    messages = [...messages, { role: 'model', text: reply }];
    return null;
  } catch (err) {
    if (e !== epoch) return null;
    console.error('[consultant] send failed', err);
    messages = messages.slice(0, -1);
    errorMessage = err.message === 'network'
      ? 'Couldn’t reach your stylist. Please check your connection and try again.'
      : 'Your stylist couldn’t answer just now. Please try again.';
    return message;
  } finally {
    if (e === epoch) {
      loading = false;
      notify();
    }
  }
}
