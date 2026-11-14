import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push(String(e)));
const state = () => page.evaluate(() => ({
  phase: window.__game.phase,
  jack: window.__game.throwingJack,
  player: window.__game.currentPlayer?.key ?? null,
  thrown: window.__game.teams.map((t) => t.players.filter((p) => p.thrown).map((p) => p.key)),
}));
async function throwBall(ms = 500) {
  await page.mouse.move(640, 380); await page.mouse.down();
  await page.waitForTimeout(ms); await page.mouse.up();
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(400); if ((await state()).phase !== 'rolling') return; }
}

await page.goto('http://localhost:5173');
await page.click('#start-btn');
await page.waitForTimeout(600);
while ((await state()).jack) await throwBall(520);

const before = await state();
const options = await page.$$eval('#player-picker button', (bs) => bs.map((b) => b.textContent));
console.log('default thrower:', before.player, '| picker options:', options);

// pick the LAST option (not the default)
await page.click('#player-picker button:last-of-type');
await page.waitForTimeout(400);
const picked = await state();
console.log('after picking:', picked.player);
await page.screenshot({ path: 'shot-picker.png' });
await throwBall(500);
const after = await state();
console.log('thrown so far:', after.thrown);
console.log('picked player marked thrown:', after.thrown.flat().includes(picked.player));
console.log('default player still available:', !after.thrown.flat().includes(before.player));

// Hebrew trivia smoke: finish the end and check the question renders
for (let i = 0; i < 20; i++) { if ((await state()).phase === 'between') break; await throwBall(400 + Math.random() * 300); }
await page.click('#next-end-btn');
await page.waitForTimeout(500);
console.log('trivia question:', await page.textContent('#trivia-question'));
await page.screenshot({ path: 'shot-hebrew.png' });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
