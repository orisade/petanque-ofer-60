import { chromium } from 'playwright';
const errors = [];
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:5173/');
await p.check('#test-mode');
await p.click('#start-btn');
await p.waitForTimeout(300);
const out = await p.evaluate(async () => {
  const T = window.__t.fast();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  T.throwAt({ power: 0.75, loft: 0.42, dist: 9 }); T.settle();
  for (let i = 0; i < 3; i++) { if (T.state().phase === 'aim') { T.throwAt({ power: 0.55, loft: 0.5 }); T.settle(); } }
  const before = window.__balls.map(b => [+b.body.position.x.toFixed(2), +b.body.position.z.toFixed(2)]);
  const ph0 = T.state().phase;
  T.perk('smash');
  const ph1 = T.state().phase;
  for (let i = 0; i < 600 && T.state().phase !== 'aim'; i++) T.step();
  T.settle();
  const after = window.__balls.map(b => [+b.body.position.x.toFixed(2), +b.body.position.z.toFixed(2)]);
  return { ph0, ph1, ph2: T.state().phase, coins: T.state().coins, before, after };
});
console.log(JSON.stringify(out));
console.log('errors', errors);
await b.close();
