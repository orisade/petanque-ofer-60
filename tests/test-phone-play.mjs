import { chromium, devices } from 'playwright';
const errors = [];
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:5173');
await p.check('#test-mode'); await p.click('#start-btn');
await p.waitForTimeout(900);
const st = () => p.evaluate(() => ({ phase: window.__game.phase, balls: window.__balls.length, loft: +window.__game.loft.toFixed(2) }));

// touch-and-drag: press low, drag up the court (flattens the arc), release
await p.mouse.move(195, 480);
await p.mouse.down();
await p.waitForTimeout(150);
console.log('holding (near):', await st());
await p.screenshot({ path: 'shot-ph-aim-near.png' });
await p.mouse.move(230, 300, { steps: 8 });
await p.waitForTimeout(150);
console.log('dragged far:   ', await st());
await p.screenshot({ path: 'shot-ph-aim-far.png' });
await p.mouse.up();
for (let i = 0; i < 30; i++) { await p.waitForTimeout(250); const s = await st(); if (s.phase !== 'rolling') break; }
console.log('after throw:   ', await st());
await p.screenshot({ path: 'shot-ph-after.png' });
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
