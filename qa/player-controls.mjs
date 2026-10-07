import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
const out = {};
const check = () => [...document.querySelectorAll('.player')].map((p) => {
  const box = p.getBoundingClientRect();
  const ctrls = [...p.querySelectorAll('.player-bar > *, .switch button, .export-btn')];
  const outside = ctrls.filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > box.right + 0.5 || r.left < box.left - 0.5 || r.bottom > box.bottom + 0.5); }).map((e) => e.className || e.tagName);
  const row = [...p.querySelectorAll('.switch, .export-btn')].map((e) => { const r = e.getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
  return { width: Math.round(box.width), controlsOutside: outside, buttonsCentredOnOneLine: row.length ? Math.max(...row) - Math.min(...row) <= 1 : null, playerBg: getComputedStyle(p).backgroundColor };
});
// studio
for (const [w, h] of [[1356, 900], [1356, 570], [375, 812]]) {
  await page.setViewport({ width: w, height: h });
  await page.goto('http://localhost:5173/?demo=QA#/reels/new', { waitUntil: 'networkidle2' });
  await sleep(700);
  await page.evaluate(() => [...document.querySelectorAll('.theme-card')].find((c) => c.textContent.includes('Education')).click());
  await sleep(300);
  await page.evaluate(() => document.querySelector('.reel-form .btn-primary').click());
  await page.waitForSelector('.studio-3', { timeout: 20000 });
  await sleep(1500);
  out[`studio@${w}x${h}`] = await page.evaluate(check);
  await page.evaluate(() => document.querySelector('.studio-player').scrollIntoView({ block: 'center' }));
  await sleep(400);
  if (w === 1356 && h === 900) await page.screenshot({ path: 'shots/v6-studio.png' });
  // modal
  await page.goto('http://localhost:5173/?demo=QA#/reels', { waitUntil: 'networkidle2' });
  await sleep(1000);
  await page.evaluate(() => document.querySelector('.poster').click());
  await sleep(1200);
  out[`modal@${w}x${h}`] = await page.evaluate(check);
  if (w === 1356 && h === 570) await page.screenshot({ path: 'shots/v6-modal.png' });
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
