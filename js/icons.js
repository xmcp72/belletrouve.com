// Belle Trouvé — inline SVG icons (stroke = currentColor unless noted)

const s = (body, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const icons = {
  home:     s('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>'),
  browse:   s('<rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/>'),
  heart:    s('<path d="M12 20.5s-7.8-4.9-10-9.5c-1.5-3.2.6-6.5 4-6.5 2.2 0 3.6 1.2 4.6 2.7l1.4 2 1.4-2c1-1.5 2.4-2.7 4.6-2.7 3.4 0 5.5 3.3 4 6.5-2.2 4.6-10 9.5-10 9.5Z"/>'),
  // Studio: wand + sparkle (locked design-system icon). Session 56: redrawn after the iOS
  // SF Symbol wand.and.stars — thicker wand with a separate tip, solid four-point stars.
  studio:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M7 7l1.6 1.6"/><path d="M10.9 10.9l9.6 9.6"/><g fill="currentColor" stroke="none"><path d="M16.5 1.5C16.9 4.1 17.9 5.1 20.5 5.5 17.9 5.9 16.9 6.9 16.5 9.5 16.1 6.9 15.1 5.9 12.5 5.5 15.1 5.1 16.1 4.1 16.5 1.5Z"/><path d="M4.5 9.8C4.7 11.2 5.3 11.8 6.7 12 5.3 12.2 4.7 12.8 4.5 14.2 4.3 12.8 3.7 12.2 2.3 12 3.7 11.8 4.3 11.2 4.5 9.8Z"/><path d="M6.5 16.7C6.66 17.84 7.16 18.34 8.3 18.5 7.16 18.66 6.66 19.16 6.5 20.3 6.34 19.16 5.84 18.66 4.7 18.5 5.84 18.34 6.34 17.84 6.5 16.7Z"/></g></svg>`,
  chevronLeft:  s('<path d="M15 18l-6-6 6-6"/>', 'stroke-width="2.2"'),
  share:    s('<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>'),
  heartFill: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.8-4.9-10-9.5c-1.5-3.2.6-6.5 4-6.5 2.2 0 3.6 1.2 4.6 2.7l1.4 2 1.4-2c1-1.5 2.4-2.7 4.6-2.7 3.4 0 5.5 3.3 4 6.5-2.2 4.6-10 9.5-10 9.5Z"/></svg>`,
  camera:   s('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>'),
  external: s('<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  moon:     s('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'),
  menu:     s('<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>'),
  search:   s('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  chevronUp:    s('<path d="M6 15l6-6 6 6"/>', 'stroke-width="2.4"'),
  chevronRight: s('<path d="M9 6l6 6-6 6"/>'),
  arrowRight:   s('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'),
  arrowUp:      s('<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>'),
  arrowUpRight: s('<path d="M7 17 17 7"/><path d="M8 7h9v9"/>'),
  // Photo with a magnifying glass (SF Symbol photo.badge.magnifyingglass) — Smart Alternatives
  photoSearch:  s('<path d="M12.5 15.5H4.5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2V11"/><path d="M2.8 12.8l3.4-3.4a1 1 0 0 1 1.4 0l3.4 3.4"/><circle cx="12.8" cy="7.6" r="1.2"/><circle cx="17.3" cy="16.3" r="3.2"/><path d="M19.7 18.7 22 21"/>'),
  trash:    s('<path d="M4 7h16"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/><path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7"/><path d="M10 11v6M14 11v6"/>'),
  mail:     s('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>'),
  tag:      s('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.4"/>'),
  hand:     s('<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>'),
  apple:    `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.1-4.2ZM13.9 5.1c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4Z"/></svg>`,

  // Studio card icons (Session 56) — drawn to match the iPad's SF Symbols:
  // person.crop.rectangle, sparkles, photo.on.rectangle.angled
  studioTryOn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><circle cx="12" cy="10" r="2.7" fill="currentColor" stroke="none"/><path d="M6.6 19.5c.8-2.8 2.9-4.3 5.4-4.3s4.6 1.5 5.4 4.3Z" fill="currentColor" stroke="none"/></svg>`,
  studioConsultant: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 7l1.5 4.6L19 13l-4.5 1.4L13 19l-1.5-4.6L7 13l4.5-1.4Z"/><path d="M6 3l.8 2.3L9 6l-2.2.7L6 9l-.8-2.3L3 6l2.2-.7Z"/><path d="M18.5 2.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5Z"/></svg>`,
  studioAlternatives: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 7V5.5a2 2 0 0 1 2-2h10.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1"/><rect x="3" y="7.5" width="15" height="13" rx="2"/><circle cx="13.3" cy="11.6" r="1.4" fill="currentColor" stroke="none"/><path d="M3.5 18.5l4.2-4.2a1 1 0 0 1 1.4 0l4.6 4.6"/><path d="M12.2 17.4l1.5-1.5a1 1 0 0 1 1.4 0l2.6 2.6"/></svg>`,
};

/** Replace every [data-icon="name"] placeholder inside root with its SVG. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.hydrated) return;
    const svg = icons[el.dataset.icon];
    if (svg) { el.innerHTML = svg; el.dataset.hydrated = '1'; }
  });
}
