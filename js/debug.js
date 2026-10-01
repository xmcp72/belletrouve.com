// Belle Trouvé — on-page diagnostics for devices without dev tools (iPhone Firefox, etc.).
// Completely inactive unless the address has ?debug (e.g. https://belletrouve.com/?debug).
// Shows a small log panel across the top with script errors and failed images.

const ON = new URLSearchParams(location.search).has('debug');
const MAX_LINES = 14;
const lines = [];
let panel = null;

function render() {
  if (!panel) {
    panel = document.createElement('pre');
    panel.setAttribute('aria-hidden', 'true');
    panel.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'top:env(safe-area-inset-top,0px)', 'z-index:99999',
      'margin:0', 'padding:6px 8px', 'max-height:45vh', 'overflow:hidden',
      'background:rgba(0,0,0,.88)', 'color:#7CFC8A', 'font:11px/1.35 ui-monospace,Menlo,monospace',
      'white-space:pre-wrap', 'word-break:break-all', 'pointer-events:none',
    ].join(';');
    document.body.appendChild(panel);
  }
  panel.textContent = lines.slice(-MAX_LINES).join('\n');
}

export function debugLog(message) {
  if (!ON) return;
  lines.push(`${new Date().toLocaleTimeString()}  ${message}`);
  if (document.body) render();
  else document.addEventListener('DOMContentLoaded', render, { once: true });
}

if (ON) {
  debugLog(`UA: ${navigator.userAgent}`);
  window.addEventListener('error', (e) => {
    debugLog(`JS error: ${e.message} (${String(e.filename || '').split('/').pop()}:${e.lineno})`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    debugLog(`Promise rejected: ${e.reason?.message || e.reason}`);
  });
}
