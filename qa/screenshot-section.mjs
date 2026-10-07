// Viewport screenshots of specific sections, scrolled into view and given time to animate.
import puppeteer from 'puppeteer-core';
const [,, url, selector, file, w = 1356, h = 760, wait = 3500] = process.argv;
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: +w, height: +h });
await page.goto(url, { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 1500));
if (selector !== '-') await page.evaluate((s) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }, selector);
await new Promise((r) => setTimeout(r, +wait));
await page.screenshot({ path: file });
await browser.close();
