// Themes and teachings for EKAGRA.
//
// IMPORTANT: every quote below is a PLACEHOLDER. The authenticity team will
// replace `text` and `source` with exact quotations from
// The Complete Works of Swami Vivekananda. Never paste quotes from social
// media or quote websites here.

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

const PER_THEME = 4;

// Builds placeholder teachings: courage-1, courage-2, ...
export const TEACHINGS = THEMES.flatMap((theme) =>
  Array.from({ length: PER_THEME }, (_, i) => ({
    id: `${theme.id}-${i + 1}`,
    themeId: theme.id,
    text: `Placeholder quote ${i + 1} on ${theme.name.toLowerCase()}. The verified quotation will go here.`,
    source: 'Source to be added · Complete Works, Vol. __',
    isPlaceholder: true,
  }))
);

export function themeById(id) {
  return THEMES.find((t) => t.id === id);
}

export function teachingsForTheme(themeId) {
  return TEACHINGS.filter((t) => t.themeId === themeId);
}
