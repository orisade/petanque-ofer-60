import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', m => m.type()==='error' && errors.push(m.text()));
page.on('pageerror', e => errors.push(String(e)));
page.on('requestfailed', r => errors.push('FAILED REQUEST: ' + r.url().slice(0,80)));
await page.goto(pathToFileURL(process.cwd() + '/dist/index.html').href);
await page.waitForSelector('text=Jouer', { timeout: 10000 });
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(2500);
// photo faces present?
const faces = await page.evaluate(() => {
  let n = 0;
  window.__game; // ensure module ran
  document.querySelectorAll('canvas').length;
  return window.__facesLoaded ?? -1;
});
const perks = await page.locator('#perk-bar button').count();
await page.mouse.move(640, 380); await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up();
await page.waitForTimeout(2800);
await page.screenshot({ path: 'shot-dist.png' });
console.log('perk rows:', perks, '| phase:', await page.evaluate(()=>window.__game.phase));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
