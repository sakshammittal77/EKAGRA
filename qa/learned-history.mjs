import puppeteer from 'puppeteer-core';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 1356, height: 900 });
await page.goto('http://localhost:5173/?demo=HistoryQA#/teachings/courage', { waitUntil: 'networkidle2' });
await sleep(1500);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle2' });
await sleep(1500);

// Are all listed cards visible, with no holes in the masonry columns?
const layout = () => page.evaluate(() => {
  window.scrollTo(0, document.body.scrollHeight); window.scrollTo(0, 0); // let reveals fire
  const cards = [...document.querySelectorAll('.quote-grid .quote-card:not(.leaving)')];
  const onScreen = cards.filter((c) => { const r = c.getBoundingClientRect(); return r.top < innerHeight - 40 && r.bottom > 0; });
  const invisible = onScreen.filter((c) => +getComputedStyle(c).opacity < 0.95).length;
  const grid = document.querySelector('.quote-grid').getBoundingClientRect();
  const cols = {};
  cards.forEach((c) => { const r = c.getBoundingClientRect(); (cols[Math.round(r.left)] ||= []).push(r); });
  let maxGap = 0, firstOffset = 0;
  Object.values(cols).forEach((col) => {
    col.sort((a, b) => a.top - b.top);
    firstOffset = Math.max(firstOffset, col[0].top - grid.top);
    for (let i = 1; i < col.length; i++) maxGap = Math.max(maxGap, col[i].top - col[i - 1].bottom);
  });
  const tabs = [...document.querySelectorAll('.seg-tabs button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim());
  return { cards: cards.length, onScreen: onScreen.length, invisibleOnScreen: invisible, maxGapPx: Math.round(maxGap), firstCardOffsetPx: Math.round(firstOffset), tabs };
});

const report = { start: await layout(), steps: [] };
for (let k = 0; k < 3; k++) {
  await page.evaluate(() => document.querySelector('.quote-grid .qc-learn').click());
  await sleep(900);
  await sleep(700); // let any entrance animation settle
  report.steps.push({ ...(await layout()), toast: await page.evaluate(() => document.querySelector('.toast')?.textContent) });
}
await page.screenshot({ path: 'shots/v7-after-marking.png' });
// Undo the last one
await page.evaluate(() => [...document.querySelectorAll('.toast button')].find((b) => b.textContent === 'Undo').click());
await sleep(900);
report.afterUndo = await layout();
// Learned tab
await page.evaluate(() => document.querySelectorAll('.seg-tabs button')[1].click());
await sleep(1200);
report.learnedTab = await layout();
// History page
await page.goto('http://localhost:5173/?demo=HistoryQA#/history', { waitUntil: 'networkidle2' });
await sleep(1500);
report.history = await page.evaluate(() => ({ groups: [...document.querySelectorAll('.history-day')].map((h) => h.textContent), cards: document.querySelectorAll('.quote-card').length, firstNote: document.querySelector('.quote-meta')?.textContent, navTab: !!document.querySelector('.tab.active') && document.querySelector('.tab.active').textContent }));
await page.screenshot({ path: 'shots/v7-history.png' });
await page.evaluate(() => document.querySelector('.qc-learn').click()); // unmark
await sleep(1300);
report.historyAfterUnmark = await page.evaluate(() => ({ cards: document.querySelectorAll('.quote-card:not(.leaving)').length, toast: document.querySelector('.toast')?.textContent }));
report.errors = errors;
console.log(JSON.stringify(report, null, 1));
await browser.close();
