import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Track every narration <audio>: pitch setting, speed, and whether it ended or was cut off.
await page.evaluateOnNewDocument(() => {
  window.__clips = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const clip = { len: Math.round(this.duration * 10) / 10, rate: this.playbackRate, preservesPitch: this.preservesPitch, rates: [], ended: false, cut: false };
    window.__clips.push(clip);
    this.addEventListener('loadedmetadata', () => { clip.len = Math.round(this.duration * 10) / 10; });
    this.addEventListener('ratechange', () => clip.rates.push(this.playbackRate));
    this.addEventListener('ended', () => { clip.ended = true; });
    const pause = this.pause.bind(this);
    this.pause = () => { if (!this.ended && this.currentTime < this.duration - 0.05) { clip.cut = true; clip.cutAt = Math.round(this.currentTime * 10) / 10; } return pause(); };
    return play.call(this);
  };
});

const report = {};

// Arya: speed change keeps the same clip, pitch preserved
await page.setViewport({ width: 1356, height: 900 });
await page.goto('http://localhost:5173/?demo=QA#/home', { waitUntil: 'networkidle2' });
await sleep(2500);
await page.evaluate(() => document.querySelector('.arya-hero .speak-btn').click());
await sleep(2500);
await page.evaluate(() => [...document.querySelectorAll('.speed-switch button')].find((b) => b.textContent === '1.5×').click());
await sleep(1200);
report.arya = await page.evaluate(() => ({ clipsPlayed: window.__clips.length, preservesPitch: window.__clips[0]?.preservesPitch, rateChanges: window.__clips[0]?.rates, stillSpeaking: document.querySelector('.arya-hero').classList.contains('speaking') }));
await page.evaluate(() => document.querySelector('.arya-hero .speak-btn').click());

// Reel with the long "Strength, O man..." passage, played start to finish
await page.evaluate(() => { sessionStorage.setItem('ekagra-reel-draft', JSON.stringify({ teachingId: 'abhih_fearless', theme: 'courage', situation: 'I have to speak at the college fest and I am scared' })); window.__clips.length = 0; });
await page.goto('http://localhost:5173/?demo=QA#/reels/new', { waitUntil: 'networkidle2' });
await sleep(1000);
await page.evaluate(() => [...document.querySelectorAll('.seg button')].find((b) => b.textContent === '30s').click());
await page.evaluate(() => document.querySelector('.reel-form .btn-primary').click());
await page.waitForSelector('.studio-3', { timeout: 20000 });
await page.waitForFunction(() => !document.querySelector('.player-loading'), { timeout: 30000 });
const total = await page.evaluate(() => document.querySelector('.time').textContent);
report.panel = await page.evaluate(() => {
  const kids = [...document.querySelectorAll('.player-toggles > *')];
  return { buttons: kids.map((k) => k.textContent.trim()), oneRow: new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top))).size === 1 };
});
await page.screenshot({ path: 'shots/v4-studio.png' });
await page.click('.player-big');
const secs = await page.evaluate(() => { const [, b] = document.querySelector('.time').textContent.split('/'); const [m, s] = b.split(':').map(Number); return m * 60 + s; });
await sleep((secs + 2) * 1000);
report.reel = { timeShown: total, clips: await page.evaluate(() => window.__clips.map((c) => ({ len: c.len, rate: Math.round(c.rate * 100) / 100, preservesPitch: c.preservesPitch, endedNaturally: c.ended, cutOff: c.cut }))) };

// Saved reel window at a short screen
await page.setViewport({ width: 1356, height: 570 });
await page.goto('http://localhost:5173/?demo=QA#/reels', { waitUntil: 'networkidle2' });
await sleep(1200);
await page.evaluate(() => document.querySelector('.poster').click());
await sleep(1500);
report.modal = await page.evaluate(() => { const c = document.querySelector('.modal-card'); const p = c.querySelector('.player').getBoundingClientRect(); return { playerBottom: Math.round(p.bottom), viewH: innerHeight, playerFullyVisible: p.top >= 0 && p.bottom <= innerHeight }; });
await page.screenshot({ path: 'shots/v4-modal.png' });

report.errors = errors;
console.log(JSON.stringify(report, null, 1));
await browser.close();
