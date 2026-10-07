// Draws one frame of a reel onto a 9:16 canvas. Used for the live preview and for the
// in-browser video export, so what you see is exactly what you download.
// Coordinates are in a 1080 x 1920 space; the caller scales the context.

export const W = 1080;
export const H = 1920;

const SANS = '"Manrope", "Anek Devanagari", "Anek Bangla", "Anek Tamil", sans-serif';
const SERIF = '"Fraunces", "Anek Devanagari", Georgia, serif';
const MONO = '"JetBrains Mono", monospace';
const LOGO = '"Fraunces", Georgia, serif';

export const FONT_FACES = [
  '800 100px "Manrope"', '600 40px "Manrope"', 'italic 400 80px "Fraunces"', '700 80px "Fraunces"',
  '500 30px "JetBrains Mono"', '700 60px "Anek Devanagari"',
  '700 60px "Anek Bangla"', '700 60px "Anek Tamil"',
];

const PALETTE = {
  Hook: ['#3b4396', '#e0621a'],
  'Modern Situation': ['#2f3a8f', '#1f7a8c'],
  'Authentic Teaching': ['#e0621a', '#c9962a'],
  'Micro-Action': ['#c9962a', '#2f7d4a'],
  'Outro & Reflection': ['#e0621a', '#3b4396'],
};

const WORDS_PER_CUE = 7;

// narration: optional seconds of spoken narration per scene. When given, a scene is stretched
// so its narration fits at no more than 1.15x speed (long passages are never rushed or cut).
export function buildTimeline(reel, narration = null) {
  let scenes = (reel?.scenes || []).map((s, i, all) => ({
    ...s,
    start: Number(s.start_time ?? (i ? all[i - 1].end_time : 0)) || 0,
    end: Number(s.end_time ?? 0) || 0,
  }));
  if (narration) {
    let at = 0;
    scenes = scenes.map((s, i) => {
      const planned = s.end - s.start;
      const need = narration[i] ? narration[i] / 1.15 + 0.6 : 0;
      const out = { ...s, start: at, end: at + Math.max(planned, need) };
      at = out.end;
      return out;
    });
  }
  const last = scenes.length ? scenes[scenes.length - 1].end : 0;
  const total = (narration ? last : Math.max(Number(reel?.durationSeconds) || 0, last)) || 30;
  const cues = [];
  scenes.forEach((s, si) => {
    if (s.authentic_quote) return; // the quote is already on screen in full
    const words = (s.voiceover_text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return;
    const size = Math.ceil(words.length / Math.ceil(words.length / WORDS_PER_CUE)); // even chunks, no one-word orphans
    const n = Math.ceil(words.length / size);
    const step = (s.end - s.start) / n;
    for (let k = 0; k < n; k += 1) {
      cues.push({ scene: si, start: s.start + k * step, end: s.start + (k + 1) * step,
        text: words.slice(k * size, (k + 1) * size).join(' ') });
    }
  });
  return { scenes, total, cues, quote: reel?.authenticQuote || '', source: reel?.sourceCitation || '' };
}

export function sceneAt(tl, t) {
  const i = tl.scenes.findIndex((s) => t >= s.start && t < s.end);
  return i === -1 ? tl.scenes.length - 1 : i;
}

// ---------- text helpers ----------
const fitCache = new Map();

function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

function fit(ctx, text, font, maxW, maxH, lh, start, min) {
  const key = `${font(1)}|${text}|${maxW}|${maxH}|${start}`;
  if (fitCache.has(key)) return fitCache.get(key);
  let size = start;
  let lines;
  for (; size >= min; size -= 4) {
    ctx.font = font(size);
    lines = wrap(ctx, text, maxW);
    if (lines.length * size * lh <= maxH && lines.every((l) => ctx.measureText(l).width <= maxW)) break;
  }
  const out = { size: Math.max(size, min), lines };
  if (fitCache.size > 300) fitCache.clear();
  fitCache.set(key, out);
  return out;
}

const ease = (x) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- cached textures ----------
let gridTex = null;
let grainTex = null;
function textures() {
  if (!gridTex) {
    gridTex = document.createElement('canvas');
    gridTex.width = W; gridTex.height = H;
    const g = gridTex.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = 27; y < H; y += 54) for (let x = 27; x < W; x += 54) g.fillRect(x, y, 3, 3);
    grainTex = document.createElement('canvas');
    grainTex.width = 256; grainTex.height = 256;
    const n = grainTex.getContext('2d');
    const img = n.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    n.putImageData(img, 0, 0);
  }
  return { gridTex, grainTex };
}

// ---------- frame ----------
export function drawFrame(ctx, tl, t) {
  const { gridTex: grid, grainTex: grain } = textures();
  const si = sceneAt(tl, t);
  const s = tl.scenes[si] || {};
  const local = t - (s.start || 0);
  const dur = Math.max(0.5, (s.end || 1) - (s.start || 0));
  const [c1, c2] = PALETTE[s.name] || PALETTE.Hook;

  // background
  ctx.fillStyle = '#14110e';
  ctx.fillRect(0, 0, W, H);
  const blob = (x, y, r, color, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + a);
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  blob(W * (0.25 + 0.12 * Math.sin(t * 0.4)), H * (0.28 + 0.06 * Math.cos(t * 0.3)), 900, c1, '55');
  blob(W * (0.8 + 0.1 * Math.cos(t * 0.35)), H * (0.78 + 0.05 * Math.sin(t * 0.45)), 800, c2, '40');
  ctx.drawImage(grid, 0, 0);

  // progress segments
  const segW = (W - 120 - (tl.scenes.length - 1) * 12) / Math.max(1, tl.scenes.length);
  tl.scenes.forEach((sc, i) => {
    const x = 60 + i * (segW + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, 64, segW, 6);
    const p = i < si ? 1 : i > si ? 0 : Math.min(1, local / dur);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, 64, segW * p, 6);
  });

  // HUD row
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 44px ${LOGO}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText('EKAGRA', 60, 150);
  ctx.font = `500 26px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText(`${String(si + 1).padStart(2, '0')} · ${(s.name || '').toUpperCase()}`, W - 60, 146);

  ctx.textAlign = 'center';
  if (s.authentic_quote) drawQuote(ctx, tl, s, local, dur);
  else if (si === tl.scenes.length - 1) drawOutro(ctx, s, local);
  else drawKinetic(ctx, s, local);

  // subtitles
  const cue = tl.cues.find((c) => t >= c.start && t < c.end);
  if (cue) {
    ctx.font = `600 44px ${SANS}`;
    const lines = wrap(ctx, cue.text, 860);
    const lh = 60;
    const boxH = lines.length * lh + 40;
    const y0 = 1600 - boxH / 2;
    const bw = Math.min(940, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 70);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, (W - bw) / 2, y0, bw, boxH, 22);
    ctx.fill();
    ctx.fillStyle = '#fff';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 20 + lh * (i + 0.78)));
  }

  // footer
  ctx.font = `500 24px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('EKAGRA · WORDS VERIFIED FROM THE COMPLETE WORKS', W / 2, H - 60);

  // scene-change glitch
  if (local < 0.28 && si > 0) {
    const k = 1 - local / 0.28;
    for (let i = 0; i < 7; i += 1) {
      const y = Math.random() * H;
      ctx.fillStyle = i % 2 ? `rgba(255,122,26,${0.35 * k})` : `rgba(92,225,255,${0.3 * k})`;
      ctx.fillRect(0, y, W, 6 + Math.random() * 40 * k);
    }
    ctx.fillStyle = `rgba(255,255,255,${0.18 * k})`;
    ctx.fillRect(0, 0, W, H);
  }

  // grain
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.save();
  ctx.translate((Math.random() * 256) | 0, (Math.random() * 256) | 0);
  ctx.fillRect(-256, -256, W + 256, H + 256);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawKinetic(ctx, s, local) {
  const text = (s.on_screen_text || s.voiceover_text || '').trim();
  const font = (n) => `800 ${n}px ${SANS}`;
  const { size, lines } = fit(ctx, text, font, 900, 640, 1.08, 128, 56);
  ctx.font = font(size);
  const lh = size * 1.08;
  const y0 = 860 - (lines.length * lh) / 2;

  // scene tag
  ctx.font = `500 28px ${MONO}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`[ ${(s.name || '').toUpperCase()} ]`, 540, y0 - 70);

  // words drop in one by one
  let k = 0;
  const longest = text.split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
  lines.forEach((line, li) => {
    ctx.font = font(size);
    const words = line.split(' ');
    const widths = words.map((w) => ctx.measureText(`${w} `).width);
    let x = 540 - (widths.reduce((a, b) => a + b, 0) - ctx.measureText(' ').width) / 2;
    words.forEach((w, wi) => {
      const p = ease((local - 0.15 - k * 0.09) / 0.45);
      k += 1;
      if (p > 0) {
        ctx.save();
        ctx.globalAlpha = p;
        const cx = x + widths[wi] / 2;
        const cy = y0 + lh * (li + 0.82);
        ctx.translate(cx, cy + (1 - p) * 40);
        ctx.scale(1 + (1 - p) * 0.25, 1 + (1 - p) * 0.25);
        ctx.fillStyle = w === longest ? '#f39b52' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(w, 0, 0);
        ctx.restore();
      }
      x += widths[wi];
    });
  });
}

function drawQuote(ctx, tl, s, local, dur) {
  ctx.font = `500 30px ${MONO}`;
  ctx.fillStyle = '#f39b52';
  ctx.fillText('SWAMI VIVEKANANDA', 540, 330);
  ctx.font = `120px ${SERIF}`;
  ctx.fillStyle = 'rgba(243,155,82,0.55)';
  ctx.fillText('“', 540, 470);

  const font = (n) => `italic 400 ${n}px ${SERIF}`;
  const { size, lines } = fit(ctx, s.authentic_quote, font, 900, 860, 1.18, 92, 38);
  const lh = size * 1.18;
  const y0 = 940 - (lines.length * lh) / 2;
  const totalWords = s.authentic_quote.split(/\s+/).length;
  const shown = Math.ceil(totalWords * Math.min(1, local / (dur * 0.7)));
  let k = 0;
  ctx.font = font(size);
  lines.forEach((line, li) => {
    const words = line.split(' ');
    const widths = words.map((w) => ctx.measureText(`${w} `).width);
    let x = 540 - (widths.reduce((a, b) => a + b, 0) - ctx.measureText(' ').width) / 2;
    ctx.textAlign = 'left';
    words.forEach((w, wi) => {
      ctx.fillStyle = k < shown ? '#fff4e6' : 'rgba(255,255,255,0.14)';
      ctx.fillText(w, x, y0 + lh * (li + 0.8));
      x += widths[wi];
      k += 1;
    });
  });
  ctx.textAlign = 'center';

  // verified badge
  const a = ease((local - 0.4) / 0.6);
  if (a > 0) {
    ctx.globalAlpha = a;
    ctx.font = `500 26px ${MONO}`;
    const src = wrap(ctx, tl.source, 820).slice(0, 3);
    const bh = 74 + src.length * 36;
    const by = 1380;
    ctx.strokeStyle = 'rgba(74,222,128,0.8)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(74,222,128,0.08)';
    roundRect(ctx, 90, by, 900, bh, 20);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.font = `700 26px ${MONO}`;
    ctx.fillText('✓ VERBATIM · NOT WRITTEN BY AI', 540, by + 48);
    ctx.font = `500 24px ${MONO}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    src.forEach((l, i) => ctx.fillText(l, 540, by + 92 + i * 36));
    ctx.globalAlpha = 1;
  }
}

function drawOutro(ctx, s, local) {
  const a = ease(local / 0.6);
  ctx.globalAlpha = a;
  ctx.font = `700 150px ${LOGO}`;
  ctx.fillStyle = '#fff';
  ctx.fillText('EKAGRA', 540, 760 + (1 - a) * 30);
  ctx.font = `64px "Rozha One", serif`;
  ctx.fillStyle = '#f39b52';
  ctx.fillText('एकाग्र', 540, 860);
  const font = (n) => `800 ${n}px ${SANS}`;
  const { size, lines } = fit(ctx, (s.on_screen_text || '').trim(), font, 860, 300, 1.1, 76, 40);
  ctx.font = font(size);
  ctx.fillStyle = '#fff';
  lines.forEach((l, i) => ctx.fillText(l, 540, 1040 + i * size * 1.1));
  ctx.globalAlpha = 1;
}
