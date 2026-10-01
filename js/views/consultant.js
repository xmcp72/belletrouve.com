// Belle Trouvé — Style Consultant screen (web)
// Mirrors StyleConsultantView.swift and the Session 47 consultant mockup: back button and
// title, an empty state until the first message, gold user bubbles on the right, bordered
// stylist bubbles on the left, a three-dot typing indicator, and an input bar pinned to the
// bottom of the screen (just above the tab bar on phones).
//
// Replies are shown with light formatting (paragraphs, bold, italics, bullet and numbered
// lists) because Gemini writes markdown. Everything is escaped first, so no reply can
// inject HTML.

import { esc } from '../components.js';
import { hydrateIcons } from '../icons.js';
import {
  getConversation, onConversationChange, sendMessage, warmUp,
  getDraft, setDraft, clearError, resetConversation,
} from '../consultant.js';

const MAX_LENGTH = 2000;

// ── Reply formatting (safe markdown subset) ───────────────
function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?!\s)(.+?)(?<!\s)_(?!\w)/g, '$1<em>$2</em>');
}

function formatReply(text) {
  const lines = text.replace(/\r/g, '').split('\n');
  let html = '';
  let para = [];
  let list = null;   // 'ul' | 'ol' | null

  const flushPara = () => {
    if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; }
  };
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  const openList = (type) => {
    if (list !== type) { closeList(); html += `<${type}>`; list = type; }
  };

  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if (!line) { flushPara(); closeList(); continue; }
    if ((m = line.match(/^[*\-•]\s+(.*)$/))) { flushPara(); openList('ul'); html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); openList('ol'); html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) { flushPara(); closeList(); html += `<p class="bubble-heading">${inline(m[1])}</p>`; continue; }
    closeList();
    para.push(line);
  }
  flushPara();
  closeList();
  return html;
}

// ── Pieces ────────────────────────────────────────────────
const EMPTY_STATE = `
  <div class="consult-empty">
    <span class="consult-empty-icon" data-icon="studioConsultant"></span>
    <h2>Your personal style consultant</h2>
    <p>Ask me anything — outfit ideas, what to wear for an occasion, how to style a piece, building your wardrobe, and more.</p>
  </div>`;

const TYPING = `
  <div class="bubble model typing" aria-label="Your stylist is typing">
    <span></span><span></span><span></span>
  </div>`;

function bubble(m) {
  return m.role === 'user'
    ? `<div class="bubble user">${esc(m.text)}</div>`
    : `<div class="bubble model">${formatReply(m.text)}</div>`;
}

// ── Screen ────────────────────────────────────────────────
let unsubscribe = null;

export function renderConsultant(view, { goBack }) {
  unsubscribe?.();
  resetConversation();   // every visit starts a new conversation, as on iOS

  view.innerHTML = `
    <div class="page-head has-back">
      <button class="icon-btn back-btn" type="button" data-back aria-label="Back to Studio">
        <span data-icon="chevronLeft"></span>
      </button>
      <h1 class="page-title">Style Consultant</h1>
      <span class="page-head-spacer"></span>
    </div>
    <div class="consult">
      <div class="consult-log" role="log" aria-live="polite" aria-label="Conversation"></div>
      <div class="consult-bar">
        <p class="consult-error" role="alert" hidden></p>
        <div class="consult-bar-row">
          <textarea class="consult-input" rows="1" maxlength="${MAX_LENGTH}"
            placeholder="Ask your style consultant..." aria-label="Message your style consultant"
            enterkeyhint="send"></textarea>
          <button class="consult-send" type="button" aria-label="Send" disabled>
            <span data-icon="arrowUp"></span>
          </button>
        </div>
      </div>
    </div>`;

  const log = view.querySelector('.consult-log');
  const errorLine = view.querySelector('.consult-error');
  const input = view.querySelector('.consult-input');
  const sendBtn = view.querySelector('.consult-send');

  view.querySelector('[data-back]').addEventListener('click', () => goBack('/studio'));

  const autoGrow = () => {
    // scrollHeight leaves out the border, so add it back (the field is border-box). Scrolling
    // is only allowed once the text passes the CSS max-height of about 4 lines; otherwise
    // Safari shows a scrollbar for a pixel or two of overflow.
    input.style.height = 'auto';
    const borders = input.offsetHeight - input.clientHeight;
    const needed = input.scrollHeight + borders;
    const max = parseFloat(getComputedStyle(input).maxHeight) || Infinity;
    input.style.height = `${Math.min(needed, max)}px`;
    input.style.overflowY = needed > max ? 'auto' : 'hidden';
  };

  const updateSend = () => {
    sendBtn.disabled = !input.value.trim() || getConversation().loading;
  };

  const scrollToEnd = (smooth) => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    });
  };

  let shownCount = -1;
  const paint = () => {
    if (!log.isConnected) { unsubscribe?.(); unsubscribe = null; return; }
    const { messages, loading, errorMessage } = getConversation();

    log.innerHTML = (messages.length || loading)
      ? messages.map(bubble).join('') + (loading ? TYPING : '')
      : EMPTY_STATE;
    hydrateIcons(log);

    errorLine.textContent = errorMessage;
    errorLine.hidden = !errorMessage;
    updateSend();

    const count = messages.length + (loading ? 1 : 0);
    if (shownCount !== -1 && count !== shownCount) scrollToEnd(true);
    shownCount = count;
  };

  const send = async () => {
    const text = input.value;
    if (!text.trim() || getConversation().loading) return;
    input.value = '';
    setDraft('');
    autoGrow();
    const failedText = await sendMessage(text);
    // Put a failed message back in the field, unless something new has been typed meanwhile
    if (failedText && input.isConnected && !input.value.trim()) {
      input.value = failedText;
      setDraft(failedText);
      autoGrow();
      updateSend();
    }
  };

  input.addEventListener('input', () => {
    setDraft(input.value);
    clearError();
    autoGrow();
    updateSend();
  });
  input.addEventListener('keydown', (e) => {
    // Enter sends, Shift+Enter adds a line (ignored mid-composition, e.g. Japanese input)
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  sendBtn.addEventListener('click', send);

  input.value = getDraft();
  autoGrow();

  unsubscribe = onConversationChange(paint);
  paint();

  // Focus the field on desktop; on phones and tablets that would pop the keyboard up uninvited
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) input.focus({ preventScroll: true });

  return warmUp();
}
