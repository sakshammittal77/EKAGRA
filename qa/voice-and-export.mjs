// Voice + layout QA: Arya neural audio & live speed change, reel narration, audio inside the
// exported video (decoded and measured), and the layout fixes.
import puppeteer from 'puppeteer-core';

const OUT = 'shots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Instrument Web Audio: count buffer sources started and record playbackRate changes.
await page.evaluateOnNewDocument(() => {
  window.__audio = { starts: [], rates: [], recorderAudioTracks: null, exported: null };
  const P = AudioBufferSourceNode.prototype;
  const start = P.start;
  P.start = function (...a) { window.__audio.starts.push(Math.round(this.buffer.duration * 10) / 10); return start.apply(this, a); };
  const setV = AudioParam.prototype.setValueAtTime;
  AudioParam.prototype.setValueAtTime = function (v, t) { if (v > 0.5 && v < 2.5) window.__audio.rates.push(v); return setV.call(this, v, t); };
  const MR = window.MediaRecorder;
  window.MediaRecorder = function (stream, opts) { window.__audio.recorderAudioTracks = stream.getAudioTracks().length; return new MR(stream, opts); };
  window.MediaRecorder.isTypeSupported = MR.isTypeSupported;
  // capture the exported file instead of downloading it
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download && this.href.startsWith('blob:')) { window.__audio.exported = this.href; return undefined; }
    return click.call(this);
  };
});

const report = {};

// ---- Arya on the home page
await page.setViewport({ width: 1356, height: 760 });
await page.goto('http://localhost:5173/?demo=QA#/home', { waitUntil: 'networkidle2' });
await sleep(2500);
await page.evaluate(() => document.querySelector('.arya-hero .speak-btn').click());
await sleep(2500);
const a1 = await page.evaluate(() => ({ starts: [...window.__audio.starts], highlighted: document.querySelectorAll('.spoken span.said, .spoken span.now').length }));
await page.evaluate(() => [...document.querySelectorAll('.speed-switch button')].find((b) => b.textContent === '1.5×').click());
await sleep(1500);
const a2 = await page.evaluate(() => ({ starts: [...window.__audio.starts], rates: [...window.__audio.rates], highlighted: document.querySelectorAll('.spoken span.said, .spoken span.now').length, speaking: document.querySelector('.arya-hero').classList.contains('speaking') }));
report.arya = {
  neuralClipSeconds: a1.starts[0], wordsHighlightedAt2_5s: a1.highlighted,
  sourcesStartedAfterSpeedChange: a2.starts.length, rateSetTo: a2.rates.slice(-1)[0],
  stillSpeakingAfterSpeedChange: a2.speaking, wordsHighlightedLater: a2.highlighted,
};
await page.evaluate(() => document.querySelector('.arya-hero .speak-btn').click()); // stop

// ---- Reel studio: narration + export with voice
await page.goto('http://localhost:5173/?demo=QA#/reels/new', { waitUntil: 'networkidle2' });
await sleep(1000);
await page.evaluate(() => [...document.querySelectorAll('.theme-card')].find((c) => c.textContent.includes('Courage')).click());
await sleep(400);
await page.type('#situation', 'I have to speak at the college fest and I am scared');
await page.evaluate(() => [...document.querySelectorAll('.seg button')].find((b) => b.textContent === '30s').click());
await page.evaluate(() => document.querySelector('.reel-form .btn-primary').click());
await page.waitForSelector('.studio-3', { timeout: 20000 });
await sleep(2500); // narration preloads
const startsBefore = await page.evaluate(() => window.__audio.starts.length);
await page.click('.player-big');
await sleep(6000);
report.reelNarration = await page.evaluate((b) => ({ neuralClipsPlayed: window.__audio.starts.slice(b) }), startsBefore);
const frame = await page.evaluate(() => { const r = document.querySelector('.studio-player').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), viewH: innerHeight }; });
report.studioPlayerFits = { ...frame, fits: frame.bottom <= frame.viewH };
await page.screenshot({ path: `${OUT}/v2-studio.png` });

// export (records the whole 30s reel in real time)
await page.evaluate(() => document.querySelector('.player-big')?.click()); // ensure state
await page.evaluate(() => [...document.querySelectorAll('.tool')].find((t) => /Export/.test(t.textContent)).click());
await page.waitForFunction(() => window.__audio.exported, { timeout: 70000 });
report.export = await page.evaluate(async () => {
  const blob = await (await fetch(window.__audio.exported)).blob();
  const ctx = new AudioContext();
  let rms = 0, seconds = 0;
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const d = buf.getChannelData(0);
    let sum = 0; for (let i = 0; i < d.length; i += 10) sum += d[i] * d[i];
    rms = Math.sqrt(sum / (d.length / 10)); seconds = buf.duration;
  } catch (e) { return { error: String(e), size: blob.size }; }
  return { sizeKB: Math.round(blob.size / 1024), audioTracksRecorded: window.__audio.recorderAudioTracks, audioSeconds: Math.round(seconds), loudnessRMS: Math.round(rms * 1000) / 1000, hasSound: rms > 0.005 };
});

// ---- Layout: saved reel modal at a short window, themes, login
await page.setViewport({ width: 1356, height: 570 });
await page.goto('http://localhost:5173/?demo=QA#/reels', { waitUntil: 'networkidle2' });
await sleep(1500);
await page.evaluate(() => document.querySelector('.poster').click());
await sleep(1200);
report.modalFits = await page.evaluate(() => { const c = document.querySelector('.modal-card').getBoundingClientRect(); const p = document.querySelector('.modal-card .player').getBoundingClientRect(); return { cardBottom: Math.round(c.bottom), playerBottom: Math.round(p.bottom), viewH: innerHeight, fits: p.bottom <= c.bottom && c.bottom <= innerHeight, scrollNeeded: document.querySelector('.modal-card').scrollHeight > document.querySelector('.modal-card').clientHeight }; });
await page.screenshot({ path: `${OUT}/v2-modal.png` });

await page.setViewport({ width: 1356, height: 760 });
await page.goto('http://localhost:5173/?demo=QA#/teachings', { waitUntil: 'networkidle2' });
await sleep(1500);
report.themeHindi = await page.evaluate(() => [...document.querySelectorAll('.theme-hi')].map((e) => { const r = e.getBoundingClientRect(); const c = e.closest('.theme-card').getBoundingClientRect(); return r.right <= c.right && r.bottom <= c.bottom && e.scrollWidth <= e.clientWidth + 1; }));
await page.screenshot({ path: `${OUT}/v2-themes.png` });

await page.setViewport({ width: 1356, height: 570 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await page.waitForSelector('.auth-card');
await sleep(800);
report.login = await page.evaluate(() => { const c = document.querySelector('.auth-card').getBoundingClientRect(); const h = document.querySelector('.how').getBoundingClientRect(); const l = document.querySelector('.local-login').getBoundingClientRect(); return { cardFits: c.bottom <= 570, localLoginBelowHow: l.top > h.bottom }; });
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await sleep(500);
await page.screenshot({ path: `${OUT}/v2-login-bottom.png` });

report.errors = errors.filter((e) => !/422/.test(e)).slice(0, 8);
console.log(JSON.stringify(report, null, 1));
await browser.close();
