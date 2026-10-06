// Talks to the team's FastAPI backend.
// Every request carries the Firebase login token so the backend knows who is asking.
// If the backend isn't running, calls fail quietly and the website keeps working.

import { auth } from '../firebase.js';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function apiFetch(path, { method = 'GET', body } = {}) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not logged in');
  const token = await user.getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch { /* not JSON */ }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

// Call once after login. Returns the backend user ({ id, name, ... }).
export function startSession() {
  return apiFetch('/api/auth/session', { method: 'POST' });
}

export function saveQuestionnaire(userId, profile) {
  return apiFetch(`/api/users/${userId}/questionnaire`, { method: 'POST', body: profile });
}

export function logQuery(userId, queryText, currentMood) {
  return apiFetch(`/api/users/${userId}/queries`, {
    method: 'POST',
    body: { query_text: queryText, current_mood: currentMood || null },
  });
}

export function listMyReels(userId) {
  return apiFetch(`/api/reels/user/${userId}`);
}

// Ready for when reel making is switched on (LLM + Creatomate on the backend).
export function generateReel(userId, { situation, teachingId, theme, language, durationSec } = {}) {
  return apiFetch('/api/reels/generate-tailored', {
    method: 'POST',
    body: {
      user_id: userId,
      situation_override: situation || null,
      teaching_id: teachingId || null,
      theme: theme || null,
      language: language || null,
      duration_sec: durationSec || null,
    },
  });
}

export function renderStatus(reelId) {
  return apiFetch(`/api/reels/${reelId}/render-status`);
}

export function renderReel(reelId) {
  return apiFetch(`/api/reels/${reelId}/render-video`, { method: 'POST' });
}
