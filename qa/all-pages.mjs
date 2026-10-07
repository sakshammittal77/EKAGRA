// End-to-end visual QA for EKAGRA: every page, three window sizes, overlap/clip checks,
// the reel studio flow, and the narration (speech calls are recorded, since headless has no audio).
import puppeteer from 'puppeteer-core';

const OUT = process.argv[2] || 'shots';
const BASE = 'http://localhost:5173/?demo=QA';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' && !/422|favicon/.test(m.text())) errors.push(`console: ${m.text()}`); });

// record speech instead of playing it
await page.evaluateOnNewDocument(() => {
  window.__spoken = [];
  const synth = window.speechSynthesis;
  if (synth) {
    synth.speak = (u) => { window.__spoken.push({ text: u.text.slice(0, 60), rate: Math.round(u.rate * 100) / 100, lang: u.lang }); setTimeout(() => u.onstart?.(), 10); };
    synth.cancel = () => {};
  }
});

const CHECK = () => {
  document.querySelectorAll('[data-reveal]').forEach((e) => e.setAttribute('data-in', ''));
  document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } });
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && +cs.opacity > 0.05; };
  const els = [...document.querySelectorAll('main h1, main h2, main h3, main p, main a, main button, main blockquote, main .tag, main label, main input, main textarea')]
    .filter((e) => vis(e) && !e.closest('.plate, .player-frame, .stack, .arya-hero-figure, .dock'));
  const overlaps = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.contains(b) || b.contains(a)) continue;
    const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
    if (Math.min(r.right, s.right) - Math.max(r.left, s.left) > 4 && Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top) > 4) {
      overlaps.push(`"${a.textContent.trim().slice(0, 20)}" x "${b.textContent.trim().slice(0, 20)}"`);
    }
  }
  // content cut by an ancestor with overflow hidden/clip
  const clipped = [];
  els.forEach((e) => {
    let p = e.parentElement;
    const r = e.getBoundingClientRect();
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (/(hidden|clip)/.test(cs.overflow + cs.overflowY + cs.overflowX) && !p.matches('.quote-text.folded, .match-text, .poster-quote, .caption-box, .tabs, .theme-glyph')) {
        const q = p.getBoundingClientRect();
        if (r.bottom > q.bottom + 2 || r.right > q.right + 2 || r.left < q.left - 2) { clipped.push(`"${e.textContent.trim().slice(0, 24)}" in .${p.className.split(' ')[0]}`); break; }
      }
      p = p.parentElement;
    }
  });
  return { n: els.length, overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth, overlaps: overlaps.slice(0, 6), clipped: clipped.slice(0, 6) };
};

const report = {};
async function visit(hash, label, sizes) {
  for (const [w, h] of sizes) {
    await page.setViewport({ width: w, height: h });
    await page.goto(`${BASE}#/${hash}`, { waitUntil: 'networkidle2' });
    await sleep(1800);
    report[`${label}@${w}`] = await page.evaluate(CHECK);
    await page.screenshot({ path: `${OUT}/${label}-${w}.png`, fullPage: true });
  }
}

const SIZES = [[1356, 570], [1440, 900], [375, 812]];
await visit('home', 'home', SIZES);
await visit('teachings', 'themes', SIZES);
await visit('teachings/courage', 'quotes', SIZES);
await visit('factcheck', 'factcheck', [[1356, 570], [375, 812]]);
await visit('learning', 'progress', [[1356, 570], [375, 812]]);
await visit('quiz', 'quiz', [[1356, 570]]);

// Studio flow + narration
await page.setViewport({ width: 1356, height: 700 });
await page.goto(`${BASE}#/reels/new`, { waitUntil: 'networkidle2' });
await sleep(1000);
await page.evaluate(() => [...document.querySelectorAll('.theme-card')].find((c) => c.textContent.includes('Concentration')).click());
await sleep(500);
await page.type('#situation', 'I keep scrolling reels instead of studying for my boards');
await page.evaluate(() => [...document.querySelectorAll('.seg button')].find((b) => b.textContent === 'हिन्दी').click());
await sleep(1200);
report['studio-step2'] = await page.evaluate(CHECK);
await page.screenshot({ path: `${OUT}/studio-2.png`, fullPage: true });
await page.evaluate(() => document.querySelector('.reel-form .btn-primary').click());
await page.waitForSelector('.studio-3', { timeout: 20000 });
await sleep(800);
report['studio-step3'] = await page.evaluate(CHECK);
const before = await page.evaluate(() => window.__spoken.length);
await page.click('.player-big');                 // user presses Play
await sleep(5500);                               // hook (0-5s) then situation starts
report.narration = await page.evaluate((b) => ({ voiceButton: [...document.querySelectorAll('.tool')].find((t) => /Voice/.test(t.textContent))?.textContent, spoken: window.__spoken.slice(b) }), before);
await page.screenshot({ path: `${OUT}/studio-3.png` });

// My reels + modal
await page.goto(`${BASE}#/reels`, { waitUntil: 'networkidle2' });
await sleep(1200);
report.reels = await page.evaluate(CHECK);
await page.evaluate(() => document.querySelector('.poster')?.click());
await sleep(1500);
report.modalNarration = await page.evaluate(() => window.__spoken.slice(-1));
await page.screenshot({ path: `${OUT}/reels-modal.png` });

// Login in four languages
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
await page.setViewport({ width: 1356, height: 570 });
await page.waitForSelector('.auth-card', { timeout: 15000 });
for (const l of ['English', 'हिन्दी', 'বাংলা', 'தமிழ்']) {
  await page.evaluate((x) => [...document.querySelectorAll('.lang-btn')].find((b) => b.textContent.trim() === x).click(), l);
  await sleep(500);
  report[`login-${l}`] = await page.evaluate(() => { const r = document.querySelector('.auth-card').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), fitsIn570: r.top >= 0 && r.bottom <= 570 }; });
}
await page.screenshot({ path: `${OUT}/login.png` });

report.errors = errors.slice(0, 10);
console.log(JSON.stringify(report, null, 1));
await browser.close();
