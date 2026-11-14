import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(600);
const perks = await page.$$eval('#perk-bar button', bs => bs.map(b => b.className));
console.log('perk buttons at start:', perks.length, perks);
// jump straight to Eden's turn (no jack phase needed for a visual check)
await page.evaluate(() => {
  const g = window.__game;
  g.throwingJack = false;
  g.current = 0;
  g.currentPlayer = g.teams[0].players.find(p => p.key === 'eden');
  g.phase = 'aim';
  window.__refresh();
});
await page.waitForTimeout(200);
await page.click('#perk-bar button.perk-ready');   // first ready perk for team 0 = tsiktsuk? filter by text
await page.waitForTimeout(1800);
console.log('twin active:', await page.evaluate(() => window.__game.twinActive));
await page.screenshot({ path: 'shot-amit.png' });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
