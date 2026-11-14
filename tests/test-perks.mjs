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
  charges: window.__game.teams.map((t) => ({ ...t.charges })),
  scores: window.__game.teams.map((t) => t.score),
}));

async function throwBall(powerMs = 500, x = 640, y = 380) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(powerMs);
  await page.mouse.up();
  // wait for settle -> next aim phase or between
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(400);
    const s = await state();
    if (s.phase !== 'rolling') return s;
  }
  throw new Error('balls never settled');
}

await page.goto('http://localhost:5173');
await page.waitForSelector('text=Jouer');
await page.click('#start-btn');
await page.waitForTimeout(600);

// seed perk charges so every perk can fire this game
await page.evaluate(() => {
  window.__game.teams[0].charges = { tsiktsuk: 1, twin: 1 };
  window.__game.teams[1].charges = { dig: 1 };
});

const seen = { tsiktsuk: false, dig: false, twin: false };

for (let step = 0; step < 25; step++) {
  const s = await state();
  if (s.phase === 'between') { // end screen or trivia
    if (await page.isVisible('#next-end-btn')) { await page.click('#next-end-btn'); await page.waitForTimeout(400); continue; }
    if (await page.isVisible('#trivia-answers')) {
      await page.click('#trivia-answers button'); // any answer
      await page.waitForTimeout(2200);
      continue;
    }
    await page.waitForTimeout(500);
    continue;
  }
  if (s.jack) { await throwBall(520); continue; }

  // perk opportunities
  if (s.player === 'gali' && !seen.tsiktsuk && await page.isVisible('#perk-bar button.perk-ready')) {
    await page.click('#perk-bar button.perk-ready');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'shot-tsiktsuk.png' });
    seen.tsiktsuk = true;
    console.log('TSIKTSUK armed, state:', await state());
    await throwBall(500);
    continue;
  }
  if (s.player === 'happy' && !seen.dig && await page.isVisible('#perk-bar button.perk-ready')) {
    await page.click('#perk-bar button.perk-ready');
    await page.waitForTimeout(300);
    await page.mouse.click(640, 400); // dig spot mid-court
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'shot-dig.png' });
    seen.dig = true;
    const after = await state();
    console.log('DIG done, state:', after);
    if (after.player !== 'happy' || after.phase !== 'aim') throw new Error('dig should NOT consume Happy\'s turn');
    console.log('Happy still throws after digging ✓');
    await throwBall(500); // her actual throw
    continue;
  }
  if (s.player === 'eden' && !seen.twin && await page.isVisible('#perk-bar button.perk-ready')) {
    await page.click('#perk-bar button.perk-ready');
    await page.waitForTimeout(1800); // camera glide
    await page.screenshot({ path: 'shot-twin.png' });
    seen.twin = true;
    console.log('TWIN active, state:', await state());
    await throwBall(450, 640, 500);
    console.log('after twin throw:', await state());
    continue;
  }
  await throwBall(420 + Math.random() * 250);
}

console.log('PERKS SEEN:', seen);
console.log('FINAL:', await state());
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
