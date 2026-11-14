import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const state = () => page.evaluate(() => ({
  phase: window.__game.phase,
  player: window.__game.currentPlayer?.key ?? null,
  jack: window.__game.throwingJack,
}));
const ballPositions = () => page.evaluate(() => window.__balls.map((b) => ({
  team: b.team,
  x: +b.body.position.x.toFixed(3),
  z: +b.body.position.z.toFixed(3),
})));

async function throwBall(ms = 500) {
  await page.mouse.move(640, 380);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400);
    if ((await state()).phase !== 'rolling') return;
  }
}

await page.goto('http://localhost:5173');
await page.click('#start-btn');
await page.waitForTimeout(600);
while ((await state()).jack) await throwBall(520);

// a few boules on the court, then force Mom's turn with a cleaner charge
for (let i = 0; i < 3; i++) {
  if ((await state()).phase !== 'aim') break;
  await throwBall(430 + i * 60);
}
await page.evaluate(() => {
  const g = window.__game;
  g.teams[0].charges = { cleaner: 1 };
  g.current = 0;
  g.currentPlayer = g.teams[0].players.find((p) => p.key === 'mom');
  g.currentPlayer.thrown = false;
  g.phase = 'aim';
});
await page.waitForTimeout(300);

const before = await ballPositions();
console.log('balls before:', before);

const label = await page.textContent('#perk-bar button.perk-ready');
console.log('perk button:', label.trim());
await page.click('#perk-bar button.perk-ready');
await page.waitForTimeout(300);
console.log('phase after activate:', (await state()).phase);

// aim the cleaner at the column where most balls sit, then launch it
const targetX = before.length ? before[0].x : 0;
await page.evaluate((x) => { window.__aimAt(x, 0); }, targetX);
await page.waitForTimeout(150);
await page.mouse.click(640, 400);
await page.waitForTimeout(400);
console.log('phase while cleaning:', (await state()).phase);
await page.screenshot({ path: 'shot-cleaner.png' });

// wait for the sweep to finish
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(300);
  if ((await state()).phase !== 'cleaning') break;
}
const after = await ballPositions();
const s = await state();
console.log('balls after:', after);
console.log('phase after sweep:', s.phase, '| player:', s.player);

const moved = before.filter((b, i) => after[i] && Math.hypot(after[i].x - b.x, after[i].z - b.z) > 0.1);
console.log('balls moved by the cleaner:', moved.length, '/', before.length);
console.log('Mom still to throw:', s.player === 'mom' && s.phase === 'aim');
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
