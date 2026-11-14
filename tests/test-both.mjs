import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const state = () => page.evaluate(() => ({ phase: window.__game.phase }));
async function throwBall(ms = 500) {
  await page.mouse.move(640, 380); await page.mouse.down();
  await page.waitForTimeout(ms); await page.mouse.up();
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(400); if ((await state()).phase !== 'rolling') return; }
}
await page.goto('http://localhost:5173');
await page.click('#start-btn');
await page.waitForTimeout(600);
for (let i = 0; i < 20; i++) { if ((await state()).phase === 'between') break; await throwBall(400 + Math.random() * 300); }
await page.click('#next-end-btn');
await page.waitForTimeout(500);
// question 1
const team1 = await page.textContent('#trivia-team');
const q1 = await page.textContent('#trivia-question');
const correct1 = await page.evaluate((qt) => { const q = window.__questions.find((x) => x.question === qt); return q.answers[q.correct]; }, q1);
await page.locator("#trivia-answers button").filter({ hasText: correct1 }).first().click();
await page.waitForTimeout(1600);
console.log('team1:', team1, '| chooser:', await page.textContent('#trivia-question'));
await page.click('#trivia-answers button'); // pick perk
await page.waitForTimeout(600);
// question 2 should now show for the OTHER team
const team2 = await page.textContent('#trivia-team');
const q2 = await page.textContent('#trivia-question');
console.log('team2:', team2, '| question:', q2);
console.log('different teams:', team1 !== team2);
const correct2 = await page.evaluate((qt) => { const q = window.__questions.find((x) => x.question === qt); return q.answers[q.correct]; }, q2);
await page.locator("#trivia-answers button").filter({ hasText: correct2 }).first().click();
await page.waitForTimeout(1600);
console.log('team2 chooser:', await page.textContent('#trivia-question'));
await page.click('#trivia-answers button');
await page.waitForTimeout(600);
console.log('charges:', await page.evaluate(() => window.__game.teams.map((t) => ({ ...t.charges }))));
console.log('phase after both:', (await state()).phase);
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
