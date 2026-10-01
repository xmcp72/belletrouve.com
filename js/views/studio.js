// Belle Trouvé — Studio (Session 56)
// Mirrors StudioView.swift and the Studio web mockups: a centered header with the gold
// "AI Creative Tools · Uses Google Gemini" line, then three feature cards capped at 560px
// (iOS btMaxContentWidth(560)). Card icons match the iPad's SF Symbols; the wand + sparkle
// Studio icon stays in the nav.
//
// Each tool is its own screen and route:
//   /studio/try-on             → views/tryOn.js
//   /studio/style-consultant   → views/consultant.js
//   /studio/smart-alternatives → views/alternatives.js

import { pageHead, esc } from '../components.js';

const TOOLS = [
  {
    path: '/studio/try-on',
    icon: 'studioTryOn',
    title: 'Virtual Try-On',
    description: 'Select a photo from your library and see how accessories look on you',
    cta: 'Try It Now',
  },
  {
    path: '/studio/style-consultant',
    icon: 'studioConsultant',
    title: 'Style Consultant',
    // The consultant is text-only, so no "upload a photo" (iOS updated to match, Session 56)
    description: 'Describe a look or ask a question — your AI stylist handles the rest',
    cta: 'Ask the Stylist',
  },
  {
    path: '/studio/smart-alternatives',
    icon: 'studioAlternatives',
    title: 'Smart Alternatives',
    description: 'Upload any item and find budget-friendly alternatives in seconds',
    cta: 'Find an Alternative',
  },
];

function studioCard(t) {
  return `
    <a class="studio-card" href="${t.path}">
      <span class="studio-card-icon" data-icon="${t.icon}"></span>
      <h2 class="studio-card-title">${esc(t.title)}</h2>
      <p class="studio-card-desc">${esc(t.description)}</p>
      <span class="studio-cta">${esc(t.cta)} <span data-icon="arrowRight"></span></span>
    </a>`;
}

export function renderStudio(view) {
  view.innerHTML = `
    ${pageHead('Studio')}
    <p class="studio-tagline">AI Creative Tools · Uses Google Gemini</p>
    <nav class="studio-cards" aria-label="Studio tools">
      ${TOOLS.map(studioCard).join('')}
    </nav>`;
}
