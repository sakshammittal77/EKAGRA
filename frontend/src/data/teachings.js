// Themes and teachings for EKAGRA.
//
// The quotations come from verified_quotes.json, which is generated from
// backend/quotes_library.py (exact passages from The Complete Works of
// Swami Vivekananda, each checked word for word against its source page).
// Never edit quotes here: change quotes_library.py and run
//   python backend/scripts/export_quotes.py

import VERIFIED from './verified_quotes.json';

export const THEMES = [
  {
    id: 'courage',
    name: 'Courage',
    hi: 'साहस',
    area: 'Anxiety management',
    blurb: 'For the moments fear holds you back.',
  },
  {
    id: 'self-confidence',
    name: 'Self-confidence',
    hi: 'आत्मविश्वास',
    area: 'Self-belief',
    blurb: 'When you doubt what you can do.',
  },
  {
    id: 'concentration',
    name: 'Concentration',
    hi: 'एकाग्रता',
    area: 'Focus',
    blurb: 'When your mind keeps wandering.',
  },
  {
    id: 'education',
    name: 'Education',
    hi: 'शिक्षा',
    area: 'Love of learning',
    blurb: 'What learning is really for.',
  },
  {
    id: 'service',
    name: 'Service',
    hi: 'सेवा',
    area: 'Purpose & service',
    blurb: 'Finding strength in helping others.',
  },
];

// Every verified teaching, once each. `themeIds` lists all themes it belongs to.
export const TEACHINGS = VERIFIED;

export function themeById(id) {
  return THEMES.find((t) => t.id === id);
}

export function teachingsForTheme(themeId) {
  return TEACHINGS.filter((t) => (t.themeIds || [t.themeId]).includes(themeId));
}
