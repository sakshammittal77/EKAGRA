import puppeteer from 'puppeteer-core';

const OUT = process.argv[2] || '.';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1356, height: 570 });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
await page.waitForSelector('.auth-card', { timeout: 15000 });

const labels = { en: 'English', hi: 'हिन्दी', bn: 'বাংলা', ta: 'தமிழ்' };
for (const [code, label] of Object.entries(labels)) {
  await page.evaluate((l) => [...document.querySelectorAll('.lang-btn')].find((b) => b.textContent.trim() === l)?.click(), label);
  await new Promise((r) => setTimeout(r, 2500));
  const m = await page.evaluate(() => {
    const r = (s) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b && { x: Math.round(b.left), y: Math.round(b.top + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
    const side = document.querySelector('.side');
    return { card: r('.auth-card'), side: r('.side'), title: r('.auth-title'), viewW: innerWidth, docW: document.documentElement.scrollWidth, sideScrollW: side.scrollWidth, sideClientW: side.clientWidth };
  });
  console.log(code, JSON.stringify(m));
  await page.screenshot({ path: `${OUT}/login-${code}.png` });
}
await browser.close();
