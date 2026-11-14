import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(400);
const phase = () => page.evaluate(() => window.__game.phase);
const hold = async () => (await page.isVisible('#holding'))
  ? (await page.textContent('#holding')).replace(/\s+/g, ' ').trim() : '(hidden)';

console.log('before jack:', await hold());
for (let i = 0; i < 4; i++) {
  if (!(await page.evaluate(() => window.__game.throwingJack))) break;
  await page.mouse.move(640, 430); await page.mouse.down(); await page.waitForTimeout(520); await page.mouse.up();
  await page.waitForTimeout(2400);
}
console.log('jack down, no boules:', await hold());
for (let i = 0; i < 5; i++) {
  if (await phase() !== 'aim') break;
  await page.mouse.move(610 + i * 20, 430);
  await page.mouse.down(); await page.waitForTimeout(430 + i * 25); await page.mouse.up();
  for (let j = 0; j < 30; j++) { await page.waitForTimeout(250); if (await phase() === 'aim') break; }
  console.log(`after boule ${i + 1}:`, await hold());
}
const jackR = await page.evaluate(() => window.__balls.find(b => b.team === -1)?.r);
console.log('jack radius:', jackR);
await page.screenshot({ path: 'shot-holding.png', clip: { x: 300, y: 0, width: 680, height: 560 } });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
