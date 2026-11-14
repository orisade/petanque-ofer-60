import { chromium } from 'playwright';
const errors = [];
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:5173');
await p.check('#test-mode'); await p.click('#start-btn'); await p.waitForTimeout(400);
const st = () => p.evaluate(() => ({ phase: window.__game.phase, jack: window.__game.throwingJack }));
const settle = async () => { for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); const s = await st(); if (s.phase === 'aim' || s.phase === 'aim-jack') return s; } return await st(); };
// jack
for (let i = 0; i < 5; i++) {
  if (!(await st()).jack) break;
  await p.mouse.move(640, 420); await p.mouse.down(); await p.waitForTimeout(540); await p.mouse.up();
  await settle();
}
// a few boules
for (let i = 0; i < 4; i++) {
  if ((await st()).phase !== 'aim') break;
  await p.mouse.move(618 + i * 15, 415);
  await p.mouse.down(); await p.waitForTimeout(500 + i * 15); await p.mouse.up();
  await settle();
}
console.log('balls:', await p.evaluate(() => window.__balls.map(x => ({ team: x.team, r: x.r }))));
console.log('holding:', (await p.textContent('#holding')).replace(/\s+/g,' ').trim());
await p.screenshot({ path: 'shot-balls.png' });
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
