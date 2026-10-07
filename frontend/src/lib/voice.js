// Narration for Arya and the reels.
// 1st choice: natural neural voices from the backend (/api/tts), played through Web Audio so
//    the speed can change mid-sentence and the voice can be recorded into exported videos.
// Fallback: the browser's own speechSynthesis (more robotic, can't be recorded).

import { API_URL } from './api.js';
import { audioContext, voiceBus } from './ambient.js';

const LANG = { en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN' };

// ---------------- neural voice (backend) ----------------
const cache = new Map(); // `${lang}|${voice}|${text}` -> Promise<{ url, duration, marks }>

async function fetchNeural(text, lang, voice) {
  const key = `${lang}|${voice}|${text}`;
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      const res = await fetch(`${API_URL}/api/tts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang, voice }),
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const data = await res.json();
      const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: data.mime || 'audio/mpeg' }));
      const decoded = await audioContext().decodeAudioData(bytes.buffer.slice(0)); // only for the length
      return { url, duration: decoded.duration, marks: data.marks || [] };
    })().catch((e) => { cache.delete(key); throw e; }));
  }
  return cache.get(key);
}

// Warm the cache (e.g. all scenes of a reel) so playback starts instantly.
export function preload(texts, lang, voice = 'female') {
  texts.filter(Boolean).forEach((t) => fetchNeural(t, lang, voice).catch(() => {}));
}

// Length in seconds of the natural narration for each text (null where unavailable).
export function narrationLengths(texts, lang, voice = 'female') {
  return Promise.all(texts.map((t) => (t ? fetchNeural(t, lang, voice).then((n) => n.duration).catch(() => null) : null)));
}

// ---------------- browser fallback ----------------
let voices = [];
const loadVoices = () => { voices = window.speechSynthesis?.getVoices() || []; };
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}
function pickBrowserVoice(lang) {
  if (!voices.length) loadVoices();
  const code = LANG[lang] || 'en-IN';
  const score = (v) => (v.lang === code ? 100 : v.lang.startsWith(code.slice(0, 2)) ? 60 : -999)
    + (/natural|online|neural/i.test(v.name) ? 40 : 0) + (/google/i.test(v.name) ? 25 : 0);
  return [...voices].sort((a, b) => score(b) - score(a))[0] || null;
}

export function canSpeak() {
  return typeof window !== 'undefined' && ('AudioContext' in window || 'speechSynthesis' in window);
}

// ---------------- one narration at a time ----------------
let current = null;

export function stopSpeaking() {
  current?.stop();
  current = null;
  window.speechSynthesis?.cancel();
}

/**
 * Speak text. Returns a controller { stop(), setRate(r) }.
 * onWord(charIndex) fires as each word starts; onEnd() when finished or stopped.
 * fromChar lets the browser fallback resume mid-text (used when the speed changes).
 * fit (seconds): speed the voice up slightly (at most 1.15x, pitch kept) to finish within that time.
 */
export function speak(text, { lang = 'en', rate = 1, voice = 'female', onStart, onEnd, onWord, fromChar = 0, fit } = {}) {
  stopSpeaking();
  if (!text) return { stop() {}, setRate() {} };
  let stopped = false;
  let ended = false;
  const finish = () => { if (!ended) { ended = true; onEnd?.(); } };
  const ctl = {
    stop() { stopped = true; ctl._stop?.(); finish(); },
    setRate(r) { rate = r; ctl._rate?.(r); },
  };
  current = ctl;

  fetchNeural(text, lang, voice).then(({ url, duration, marks }) => {
    if (stopped) return;
    const ctx = audioContext();
    ctx.resume();
    if (fit) rate = Math.min(1.15, Math.max(rate, duration / fit));
    // An <audio> element keeps the voice's pitch when the speed changes (preservesPitch),
    // and routing it through Web Audio lets exported videos record it.
    const audio = new Audio(url);
    audio.preservesPitch = true;
    audio.playbackRate = rate;
    const node = ctx.createMediaElementSource(audio);
    node.connect(voiceBus());
    let raf = 0;
    let mi = 0;
    const tick = () => {
      while (mi < marks.length && marks[mi].t <= audio.currentTime) { onWord?.(marks[mi].c ?? 0); mi += 1; }
      raf = requestAnimationFrame(tick);
    };
    const cleanup = () => { cancelAnimationFrame(raf); try { node.disconnect(); } catch { /* gone */ } };
    ctl._rate = (r) => { audio.playbackRate = r; };
    ctl._stop = () => { audio.pause(); cleanup(); };
    audio.onended = () => { cleanup(); if (current === ctl) current = null; finish(); };
    audio.play().then(() => { onStart?.(); raf = requestAnimationFrame(tick); }).catch(() => { cleanup(); finish(); });
  }).catch(() => {
    if (stopped) return;
    // fallback: the browser's voice
    const synth = window.speechSynthesis;
    if (!synth) { finish(); return; }
    if (fit) rate = Math.min(1.7, Math.max(rate, text.split(/\s+/).length / (fit * 2.5)));
    let offset = fromChar;
    let seq = 0; // only the latest utterance may end the narration (cancel() fires onend on the old one)
    const say = (startAt) => {
      const id = ++seq;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(startAt));
      u.lang = LANG[lang] || 'en-IN';
      const v = pickBrowserVoice(lang);
      if (v) u.voice = v;
      u.rate = rate;
      u.onstart = () => onStart?.();
      u.onend = () => { if (!stopped && id === seq) finish(); };
      u.onerror = () => { if (!stopped && id === seq) finish(); };
      u.onboundary = (e) => { if (id === seq) { offset = startAt + e.charIndex; onWord?.(offset); } };
      synth.speak(u);
    };
    // the browser voice can't change speed mid-utterance, so continue from the current word
    ctl._rate = () => say(offset);
    ctl._stop = () => synth.cancel();
    say(fromChar);
  });
  return ctl;
}
