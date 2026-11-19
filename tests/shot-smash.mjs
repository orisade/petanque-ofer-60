import { chromium } from 'playwright';
const errors = [];
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:5173/');
await p.check('#test-mode');
await p.click('#start-btn');
await p.waitForTimeout(400);
await p.evaluate(() => { const T = window.__t.fast(); T.throwAt({ power: 0.75, loft: 0.42, dist: 9 }); T.settle();
  for (let i=0;i<2;i++){ if (T.state().phase==='aim'){ T.throwAt({power:0.55,loft:0.5}); T.settle(); } }
  T.perk('smash'); });
await p.addStyleTag({ content: '#bigshout{display:none!important}' });
await p.waitForTimeout(1800);
await p.evaluate(() => { const s = window.__smash(); if (s) s.t = -0.5; });
const marks = [1.9, 2.3, 2.6, 3.0, 4.3];
for (const m of marks) {
  await p.evaluate((v) => { const s = window.__smash(); if (s) s.t = v - 0.12; }, m);
  await p.waitForTimeout(120);
  await p.screenshot({ path: `/tmp/smash-${m}.png` });
}
console.log('errors', errors);
await b.close();
