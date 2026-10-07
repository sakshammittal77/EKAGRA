// Shared Web Audio graph:
//   voice (narration) ─┐
//   ambient pad ───────┼─> speakers
//                      └─> MediaStream (recorded into exported videos)
// The ambient pad is made in the browser, so no audio files are needed.

let ctx = null;
let ambientGain = null;
let voiceGain = null;
let streamDest = null;
let nodes = [];

export function audioContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  streamDest = ctx.createMediaStreamDestination();
  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0;
  voiceGain = ctx.createGain();
  voiceGain.gain.value = 1;
  [ambientGain, voiceGain].forEach((g) => { g.connect(ctx.destination); g.connect(streamDest); });
  return ctx;
}

export function voiceBus() {
  audioContext();
  return voiceGain;
}

export function startAmbient() {
  audioContext();
  ctx.resume();
  if (nodes.length) return;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  filter.Q.value = 0.7;
  filter.connect(ambientGain);
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  // A minor add9 drone: A2, E3, A3, B3
  [110, 164.81, 220, 246.94].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 6;
    const g = ctx.createGain();
    g.gain.value = i === 3 ? 0.05 : 0.12;
    o.connect(g).connect(filter);
    o.start();
    nodes.push(o);
  });
  nodes.push(lfo);
  ambientGain.gain.cancelScheduledValues(ctx.currentTime);
  ambientGain.gain.setTargetAtTime(0.16, ctx.currentTime, 0.8); // sits under the narration
}

export function stopAmbient() {
  if (!ctx || !nodes.length) return;
  ambientGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  const old = nodes;
  nodes = [];
  setTimeout(() => old.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 1500);
}

// Short "tick" when a scene changes (only while the ambient pad is on)
export function blip() {
  if (!ctx || !nodes.length) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(1400, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.08);
  g.gain.setValueAtTime(0.04, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
  o.connect(g).connect(ambientGain);
  o.start();
  o.stop(ctx.currentTime + 0.12);
}

// Everything you hear (voice + ambient), for recording.
export function audioStream() {
  audioContext();
  return streamDest.stream;
}
