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

// measure a throw: peak height and where it finally stops
async function measure(loft) {
  await page.evaluate((l) => {
    const g = window.__game;
    g.loft = l;
    g.throwingJack = false; g.current = 0;
    g.currentPlayer = g.teams[0].players.find(p => !p.thrown) || g.teams[0].players[0];
    g.currentPlayer.thrown = false; g.phase = 'aim';
    window.__refresh();
  }, loft);
  await page.evaluate(() => window.__aimAt(0, 1.0));
  const n = await page.evaluate(() => window.__balls.length);
  await page.mouse.move(640, 300);
  await page.mouse.down(); await page.waitForTimeout(430); await page.mouse.up();
  // sample peak height while it flies
  let peak = 0;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(80);
    const h = await page.evaluate((n) => { const b = window.__balls[n]; return b ? b.body.position.y : -1; }, n);
    if (h > peak) peak = h;
    if (await phase() === 'aim') break;
  }
  const res = await page.evaluate((n) => { const b = window.__balls[n]; return b ? { z: b.body.position.z, land: b.landZ } : null; }, n);
  return { loft, peak: +peak.toFixed(2), restZ: res ? +res.z.toFixed(2) : null };
}

const flat = await measure(0.22);
const lob  = await measure(1.0);
console.log('ROLL  (flat):', flat);
console.log('LOB   (high):', lob);
console.log('lob flies higher:', lob.peak > flat.peak + 0.3);
// arc panel live?
await page.evaluate(() => { window.__game.phase = 'aim'; window.__refresh(); });
console.log('arc label:', await page.textContent('#arc-label'));
await page.mouse.move(640, 400);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(100);
console.log('after scroll up:', await page.textContent('#arc-label'));
await page.mouse.down(); await page.waitForTimeout(250);
await page.screenshot({ path: 'shot-arc.png' });
await page.mouse.up();
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
