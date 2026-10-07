import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
for (const w of [1356, 1440, 1100, 375]) {
  await page.setViewport({ width: w, height: 800 });
  await page.goto('http://localhost:5173/?demo=QA#/teachings/courage', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));
  const r = await page.evaluate(() => [...document.querySelectorAll('.quote-actions')].map((a) => new Set([...a.children].map((c) => Math.round(c.getBoundingClientRect().top))).size));
  console.log(w, 'cards:', r.length, 'rows per card:', [...new Set(r)].join(','));
}
await browser.close();
