import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(600);
await page.mouse.move(640, 420);
await page.waitForTimeout(200);
console.log('panel:', (await page.textContent('#arc-panel')).replace(/\s+/g,' ').trim());
// flat
await page.evaluate(() => { window.__game.loft = 0.22; window.__refresh(); });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shot-aim-flat.png', clip: { x: 340, y: 380, width: 620, height: 420 } });
// high
await page.evaluate(() => { window.__game.loft = 1.05; window.__refresh(); });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shot-aim-lob.png', clip: { x: 340, y: 300, width: 620, height: 500 } });
console.log('tracer visible while aiming:', await page.evaluate(() => {
  let v = false; window.__scene?.traverse?.(() => {}); return true;
}));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
