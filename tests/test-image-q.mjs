import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.click('#start-btn');
await page.waitForTimeout(500);
// mark every non-image question as used, so the image one is picked
await page.evaluate(() => {
  window.__questions.forEach((q, i) => { if (!q.image) window.__game.usedQuestions.add(i); });
});
const throwOnce = async () => { await page.mouse.move(640, 380); await page.mouse.down(); await page.waitForTimeout(400 + Math.random() * 300); await page.mouse.up(); for (let i = 0; i < 40; i++) { await page.waitForTimeout(400); if ((await state()) !== "rolling") return; } };
const state = () => page.evaluate(() => window.__game.phase);
for (let i = 0; i < 25 && !(await page.isVisible("#next-end-btn")); i++) await throwOnce();
await page.click("#next-end-btn");
await page.waitForSelector('#trivia-image:not(.hidden)', { timeout: 5000 });
await page.waitForTimeout(500);
console.log('question:', await page.textContent('#trivia-question'));
console.log('image loaded:', await page.$eval('#trivia-image', (i) => i.complete && i.naturalWidth > 0));
await page.screenshot({ path: 'shot-image-q.png' });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
