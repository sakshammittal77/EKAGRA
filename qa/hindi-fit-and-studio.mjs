import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
const out = {};
for (const w of [1356, 1100, 375]) {
  await page.setViewport({ width: w, height: 760 });
  await page.goto('http://localhost:5173/?demo=QA#/teachings', { waitUntil: 'networkidle2' });
  await sleep(1800);
  out[`glyphs@${w}`] = await page.evaluate(() => [...document.querySelectorAll('.theme-glyph')].map((g) => {
    const r = g.getBoundingClientRect(), c = g.closest('.theme-card').getBoundingClientRect(), f = g.closest('.theme-card').querySelector('.theme-foot').getBoundingClientRect();
    return `${g.textContent}:${Math.round(parseFloat(getComputedStyle(g).fontSize))}px ${r.left >= c.left && r.right <= c.right - 10 && r.bottom <= f.top + 1 ? 'OK' : 'CUT'}`;
  }));
  if (w === 1356) await page.screenshot({ path: 'shots/v3-themes.png' });
}
// studio player at a short window, after scrolling (sticky)
await page.setViewport({ width: 1356, height: 570 });
await page.goto('http://localhost:5173/?demo=QA#/reels/new', { waitUntil: 'networkidle2' });
await sleep(800);
await page.evaluate(() => [...document.querySelectorAll('.theme-card')].find((c) => c.textContent.includes('Service')).click());
await sleep(300);
await page.evaluate(() => document.querySelector('.reel-form .btn-primary').click());
await page.waitForSelector('.studio-3', { timeout: 20000 });
await sleep(1200);
await page.evaluate(() => window.scrollTo(0, 400));
await sleep(600);
out.studioAt570 = await page.evaluate(() => { const r = document.querySelector('.studio-player').getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), fits: r.bottom <= innerHeight }; });
await page.screenshot({ path: 'shots/v3-studio570.png' });
console.log(JSON.stringify(out, null, 1));
await browser.close();
