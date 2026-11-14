import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(500);

async function probe(x, y, tag) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(220);
  const s = await page.evaluate(() => ({
    loft: +(window.__game.loft).toFixed(2),
    deg: Math.round(window.__game.loft * 57.3),
    aim: { x: +window.__game.aimPoint.x.toFixed(2), z: +window.__game.aimPoint.z.toFixed(2) },
    label: document.getElementById('arc-label').textContent,
  }));
  const o = await page.evaluate(() => ({ z: window.__game.twinActive ? 0 : -9.2 }));
  const r = Math.hypot(s.aim.x, s.aim.z - o.z).toFixed(2);
  console.log(`${tag.padEnd(18)} ${s.label.padEnd(18)} aim=(${s.aim.x}, ${s.aim.z})  radius=${r}`);
  return s;
}

console.log('mouse position            arc                 reticle');
const near  = await probe(640, 700, 'close to player');
const mid   = await probe(640, 520, 'mid court');
const far   = await probe(640, 390, 'far up court');
const left  = await probe(430, 520, 'mid, left');
const right = await probe(850, 520, 'mid, right');
console.log('\nangle grows with distance:', near.loft < mid.loft && mid.loft < far.loft);
console.log('sides swing the aim:', left.aim.x < -0.2 && right.aim.x > 0.2);
await page.screenshot({ path: 'shot-aim-near.png', clip: { x: 380, y: 400, width: 560, height: 400 } });
await page.mouse.move(640, 390);
await page.waitForTimeout(200);
await page.screenshot({ path: 'shot-aim-far.png', clip: { x: 380, y: 300, width: 560, height: 500 } });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
