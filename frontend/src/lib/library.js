import { useEffect, useState } from 'react';
import { fetchLibrary } from './api.js';
import { TEACHINGS } from '../data/teachings.js';

// The verified quote library from the backend (quotes_library.py), loaded once and shared.
// If the backend is offline, the placeholder teachings are used so pages still render.

let cache = null;
let pending = null;

function fallback() {
  return TEACHINGS.map((t) => ({ ...t, app_themes: [t.themeId], themes: [t.themeId] }));
}

export function loadLibrary() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetchLibrary()
      .then((res) => { cache = { quotes: res.quotes, live: true }; return cache; })
      .catch(() => { pending = null; return { quotes: fallback(), live: false }; });
  }
  return pending;
}

export function useLibrary() {
  const [lib, setLib] = useState(cache || { quotes: [], live: false, loading: true });
  useEffect(() => {
    let on = true;
    loadLibrary().then((l) => on && setLib(l));
    return () => { on = false; };
  }, []);
  return {
    ...lib,
    forTheme: (themeId) => lib.quotes.filter((q) => (q.app_themes || []).includes(themeId)),
    byId: (id) => lib.quotes.find((q) => q.id === id),
  };
}

// Hand-off from one page to the reel studio (e.g. "make a reel from this passage").
const DRAFT_KEY = 'ekagra-reel-draft';
export function setReelDraft(draft) {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* storage blocked */ }
}
// Read without removing (React may render twice in development); clear it after mount.
export function peekReelDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function clearReelDraft() {
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked */ }
}
