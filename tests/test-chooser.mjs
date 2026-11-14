import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const state = () => page.evaluate(() => ({
  phase: window.__game.phase,
  jack: window.__game.throwingJack,
  charges: window.__game.teams.map((t) => ({ ...t.charges })),
}));

async function throwBall(powerMs = 500) {
  await page.mouse.move(640, 380);
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

// play one full end
for (let i = 0; i < 20; i++) {
  const s = await state();
  if (s.phase === 'between') break;
  await throwBall(400 + Math.random() * 300);
}
await page.click('#next-end-btn');
await page.waitForTimeout(500);

// trivia: answer CORRECTLY by looking up the question bank
const q = await page.textContent('#trivia-question');
const correctIdx = await page.evaluate((qt) => { const q = window.__questions.find((x) => x.question === qt); return q.answers[q.correct]; }, q);
await page.locator("#trivia-answers button").filter({ hasText: correctIdx }).first().click();
await page.waitForTimeout(1600);

// perk chooser should now be visible
const chooserText = await page.textContent('#trivia-question');
console.log('chooser prompt:', chooserText);
const perkBtns = await page.$$eval('#trivia-answers button', (bs) => bs.map((b) => b.textContent));
console.log('perk options:', perkBtns);
await page.screenshot({ path: 'shot-chooser.png' });
await page.click('#trivia-answers button');
await page.waitForTimeout(500);
console.log('charges after pick:', (await state()).charges);
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
