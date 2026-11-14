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
  twin: window.__game.twinActive,
}));

async function throwBall(powerMs = 500, x = 640, y = 380) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(powerMs);
  await page.mouse.up();
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400);
    if ((await state()).phase !== 'rolling') return;
  }
}

await page.goto('http://localhost:5173');
await page.waitForSelector('text=Jouer');
await page.click('#start-btn');
await page.waitForTimeout(600);

// throw jack (retries happen automatically in game)
while ((await state()).jack) await throwBall(520);

// Force: lots of tokens, and only Eden left unthrown on team 0
await page.evaluate(() => {
  const g = window.__game;
  g.teams[0].charges = { twin: 2, tsiktsuk: 2 };
  for (const p of g.teams[0].players) if (p.key !== 'eden') p.thrown = true;
});

for (let step = 0; step < 10; step++) {
  const s = await state();
  if (s.phase === 'between') { await page.waitForTimeout(500); continue; }
  if (s.player === 'eden' && !s.twin && await page.isVisible('#perk-bar button.perk-ready')) {
    const label = await page.textContent('#perk-bar button.perk-ready');
    console.log('perk button:', label);
    await page.click('#perk-bar button.perk-ready');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'shot-twin.png' });
    console.log('TWIN active:', await state());
    await throwBall(450, 640, 500);
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'shot-twin-after.png' });
    console.log('after twin throw:', await state());
    break;
  }
  await throwBall(450);
}

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
