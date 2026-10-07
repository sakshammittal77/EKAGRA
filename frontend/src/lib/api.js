// Talks to the team's FastAPI backend.
// Every request carries the Firebase login token so the backend knows who is asking.
// If the backend isn't running, calls fail quietly and the website keeps working.

import { auth } from '../firebase.js';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

// Local development only: App.jsx sets this in demo mode, and the backend accepts it
// only when it runs with DEV_AUTH=true. Real logins always use the Firebase token.
let devUser = null;
export function setDevUser(name) { devUser = import.meta.env.DEV ? name : null; }

async function token() {
  const user = auth?.currentUser;
  if (user) return user.getIdToken();
  if (devUser) return `dev:${devUser}`;
  throw new Error('Not logged in');
}

async function request(path, { method = 'GET', body, authed = true, text = false } = {}) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  if (authed) headers.Authorization = `Bearer ${await token()}`;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch { /* not JSON */ }
    throw new Error(`${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }
  return text ? res.text() : res.json();
}

const apiFetch = (path, opts) => request(path, opts);
const publicFetch = (path, opts = {}) => request(path, { ...opts, authed: false });

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

export function transcribeAudio(audioBase64, mime, language = null) {
  return apiFetch('/api/assistant/transcribe', { method: 'POST', body: { audio: audioBase64, mime, language } });
}

export function assistantChat(messages, shownQuoteIds = [], language = null) {
  return apiFetch('/api/assistant/chat', {
    method: 'POST',
    body: { messages, shown_quote_ids: shownQuoteIds, language },
  });
}

export function listMyReels(userId) {
  return apiFetch(`/api/reels/user/${userId}`);
}

export function getStats(userId) {
  return apiFetch(`/api/users/${userId}/stats`);
}

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

export function editReel(reelId, scenes) {
  return apiFetch(`/api/reels/${reelId}`, { method: 'PATCH', body: { scenes } });
}

export function deleteReel(reelId) {
  return apiFetch(`/api/reels/${reelId}`, { method: 'DELETE' });
}

export function hookVariants(reelId) {
  return apiFetch(`/api/reels/${reelId}/hooks`, { method: 'POST' });
}

export function captions(reelId, format = 'srt') {
  return apiFetch(`/api/reels/${reelId}/captions?format=${format}`, { text: true });
}

export function renderStatus(reelId) {
  return apiFetch(`/api/reels/${reelId}/render-status`);
}

export function renderReel(reelId) {
  return apiFetch(`/api/reels/${reelId}/render-video`, { method: 'POST' });
}

// ---- public (no login needed) ----
export function fetchLibrary() {
  return publicFetch('/api/quotes');
}

export function fetchDaily() {
  return publicFetch('/api/quotes/daily');
}

export function matchQuotes(situation, theme, limit = 3) {
  return publicFetch('/api/quotes/match', { method: 'POST', body: { situation, theme: theme || null, limit } });
}

export function factCheck(text) {
  return publicFetch('/api/fact-check', { method: 'POST', body: { text } });
}
