// Belle Trouvé — Add to Collection / New Collection sheet (web)
// Mirrors the "Add to Collection" sheet and NewCollectionSheet.swift, per the Session 47
// Favorites mockups: bottom sheet on phones, centered modal on tablet and desktop.
// Built on <dialog>, so focus stays inside it, Esc closes it, and the page behind is inert.
//
//   openCollectionSheet(product)  — ••• on a saved card: tick collections on/off, or create one
//                                   (a new collection created here gets the item straight away)
//   openNewCollection()           — New Collection tile: just the name form

import {
  getCollections, onCollectionsChange, isInCollection,
  addToCollection, removeFromCollection, createCollection,
} from './favorites.js';
import { esc, toast } from './components.js';

const NAME_MAX = 60;

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;

export function openCollectionSheet(product) {
  openSheet({ product, startWith: 'list' });
}

export function openNewCollection() {
  openSheet({ product: null, startWith: 'name' });
}

function openSheet({ product, startWith }) {
  document.querySelector('dialog.bt-sheet')?.close();   // only one at a time

  const dlg = document.createElement('dialog');
  dlg.className = 'bt-sheet';
  dlg.setAttribute('aria-labelledby', 'btSheetTitle');
  document.body.appendChild(dlg);

  let mode = startWith;
  let busy = false;
  const off = onCollectionsChange(() => { if (mode === 'list') paintList(); });

  function close() { dlg.close(); }

  // ── List: Add to Collection ─────────────────────────────
  function paintList({ focusFirst = false } = {}) {
    const list = getCollections();
    dlg.innerHTML = `
      <div class="bt-sheet-grabber" aria-hidden="true"></div>
      <h2 class="bt-sheet-title" id="btSheetTitle" tabindex="-1">Add to Collection</h2>
      <div class="bt-sheet-list" role="group" aria-label="Collections">
        ${list.length ? list.map((c) => {
          const on = isInCollection(product.id, c.id);
          return `
            <button class="coll-row" type="button" data-coll="${esc(c.id)}" role="checkbox" aria-checked="${on}">
              <span class="coll-row-name">${esc(c.name)}</span>
              <span class="coll-check">${CHECK_ICON}</span>
            </button>`;
        }).join('') : '<p class="bt-sheet-hint">You don’t have any collections yet.</p>'}
      </div>
      <button class="bt-sheet-new" type="button" data-new>${PLUS_ICON}<span>New Collection</span></button>
      <button class="bt-sheet-done" type="button" data-done>Done</button>`;
    // Focus the title, not the first row — a focused row shows a highlight before the user has done anything
    if (focusFirst) dlg.querySelector('.bt-sheet-title').focus();
  }

  // ── Name form: New Collection ──────────────────────────
  function paintName() {
    dlg.innerHTML = `
      <div class="bt-sheet-grabber" aria-hidden="true"></div>
      <h2 class="bt-sheet-title" id="btSheetTitle">New Collection</h2>
      <form class="bt-sheet-form" novalidate>
        <label class="visually-hidden" for="btCollName">Collection name</label>
        <input class="bt-input" id="btCollName" type="text" placeholder="Collection name"
          maxlength="${NAME_MAX}" autocomplete="off" enterkeyhint="done">
        <p class="bt-sheet-error" role="alert" hidden></p>
        <button class="bt-sheet-primary" type="submit" disabled>Create Collection</button>
        <button class="bt-sheet-done" type="button" data-cancel-name>Cancel</button>
      </form>`;

    const input = dlg.querySelector('#btCollName');
    const submit = dlg.querySelector('.bt-sheet-primary');
    const error = dlg.querySelector('.bt-sheet-error');
    input.addEventListener('input', () => { submit.disabled = !input.value.trim() || busy; });

    dlg.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name || busy) return;
      busy = true;
      submit.disabled = true;
      submit.textContent = 'Creating…';
      error.hidden = true;
      try {
        const id = await createCollection(name);
        if (product) {
          // Created from an item's ••• — add the item to it, then show the list with it ticked
          await addToCollection(product.id, id);
          busy = false;
          mode = 'list';
          paintList({ focusFirst: true });
          toast(`Added to ${name}`);
        } else {
          busy = false;
          close();
          toast('Collection created');
        }
      } catch (err) {
        console.error('[collections] create failed', err);
        busy = false;
        submit.textContent = 'Create Collection';
        submit.disabled = !input.value.trim();
        error.textContent = 'Couldn’t create the collection. Please check your connection and try again.';
        error.hidden = false;
      }
    });

    setTimeout(() => input.focus(), 50);   // after the open animation starts (as on iOS)
  }

  // ── Events ─────────────────────────────────────────────
  dlg.addEventListener('click', async (e) => {
    if (e.target === dlg) {
      // Taps on the sheet's own padding also target the dialog — only close for taps outside it
      const r = dlg.getBoundingClientRect();
      const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      if (outside) close();
      return;
    }
    if (e.target.closest('[data-done]')) { close(); return; }
    if (e.target.closest('[data-cancel-name]')) {
      if (product) { mode = 'list'; paintList({ focusFirst: true }); } else close();
      return;
    }
    if (e.target.closest('[data-new]')) { mode = 'name'; paintName(); return; }

    const row = e.target.closest('[data-coll]');
    if (row && product) {
      const id = row.dataset.coll;
      const wasIn = isInCollection(product.id, id);
      try {
        // Optimistic in favorites.js — the listener repaints the tick immediately
        if (wasIn) await removeFromCollection(product.id, id);
        else await addToCollection(product.id, id);
      } catch (err) {
        console.error('[collections] update failed', err);
        toast('Couldn’t update the collection — please try again');
      }
      dlg.querySelector(`[data-coll="${CSS.escape(id)}"]`)?.focus();   // keep focus on the row after repaint
    }
  });

  dlg.addEventListener('close', () => { off(); dlg.remove(); }, { once: true });

  if (mode === 'list') paintList(); else paintName();
  dlg.showModal();
  if (mode === 'list') dlg.querySelector('.bt-sheet-title').focus();   // Tab then reaches the rows
}
