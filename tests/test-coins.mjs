import { chromium } from 'playwright';
const errors = [];
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:5173');
await p.click('#start-btn');           // NO test mode: start from zero coins
await p.waitForTimeout(500);
const coins = () => p.evaluate(() => window.__game.teams.map(t => t.coins));
const phase = () => p.evaluate(() => window.__game.phase);
const qAnswer = (txt) => p.evaluate((t) => { const q = window.__questions.find(x => x.question === t); return q.answers[q.correct]; }, txt);

console.log('coins at kickoff:', await coins());
const throwOnce = async () => {
  await p.mouse.move(640, 430); await p.mouse.down(); await p.waitForTimeout(470); await p.mouse.up();
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(250); const s = await phase(); if (s !== 'rolling' && s !== 'magnet-pull') return s; }
};
// play one full end, answering both trivia questions correctly
for (let i = 0; i < 25; i++) {
  if (await p.isVisible('#next-end-btn')) { await p.click('#next-end-btn'); await p.waitForTimeout(400); continue; }
  if (await p.isVisible('#trivia-answers')) {
    const team = await p.textContent('#trivia-team');
    const q = await p.textContent('#trivia-question');
    await p.locator('#trivia-answers button').filter({ hasText: await qAnswer(q) }).first().click();
    await p.waitForTimeout(2800);
    console.log(`  ${team.trim()} answered right -> coins`, await coins());
    continue;
  }
  if (await phase() === 'between') { await p.waitForTimeout(400); continue; }
  await throwOnce();
}
console.log('coins after end 1 (kept for later):', await coins());
// spend one: force Ofer's turn and fire the whip (cost 1)
await p.evaluate(() => {
  const g = window.__game;
  g.teams[0].coins = 3;
  g.current = 0;
  g.currentPlayer = g.teams[0].players.find(x => x.key === 'mom');
  g.currentPlayer.thrown = false; g.phase = 'aim'; window.__refresh();
});
console.log('before spending:', await coins(), '| chip:', (await p.textContent('#perk-bar button.perk-toggle')).trim());
await p.click('#perk-bar button.perk-toggle');       // open sheet
await p.waitForTimeout(200);
const whip = p.locator('#perk-bar button.perk-ready', { hasText: 'cleaner' });
console.log('cleaner label:', (await whip.textContent()).replace(/\s+/g, ' ').trim());
await whip.click();
await p.waitForTimeout(300);
console.log('after firing cleaner (cost 1):', await coins(), '| phase:', await phase());
// affordability gate: zero coins -> nothing ready
await p.evaluate(() => { window.__game.teams[0].coins = 0; window.__game.phase = 'aim'; window.__refresh(); });
await p.waitForTimeout(200);
console.log('broke -> ready perks:', await p.locator('#perk-bar button.perk-ready').count(), '| chip:', (await p.textContent('#perk-bar button.perk-toggle')).trim());
console.log('ERRORS:', errors.length ? errors : 'none');
await b.close();
