import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(500);
// throw the jack for real first
for (let i = 0; i < 4; i++) { if (!(await page.evaluate(() => window.__game.throwingJack))) break; await page.mouse.move(640,380); await page.mouse.down(); await page.waitForTimeout(520); await page.mouse.up(); await page.waitForTimeout(2500); }
const st = () => page.evaluate(() => ({ phase: window.__game.phase, player: window.__game.currentPlayer?.key, balls: window.__balls.length }));
const setPlayer = (team, key) => page.evaluate(([t, k]) => {
  const g = window.__game; g.throwingJack = false; g.current = t;
  g.currentPlayer = g.teams[t].players.find(p => p.key === k);
  g.currentPlayer.thrown = false; g.phase = 'aim'; window.__refresh();
}, [team, key]);
const throwIt = async (ms=480) => { await page.mouse.move(640,380); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); for (let i=0;i<30;i++){ await page.waitForTimeout(300); const s=await st(); if(s.phase!=='rolling'&&s.phase!=='magnet-pull') return s; } };
const perkByText = (txt) => page.locator('#perk-bar button.perk-ready', { hasText: txt });

console.log('perk count:', await page.locator('#perk-bar button').count());
// Ori magnet
await setPlayer(1, 'ori');
await perkByText('magnet').click();
console.log('magnet armed:', await page.evaluate(() => window.__game.magnetArmed));
await throwIt();
await page.waitForTimeout(400);
await page.screenshot({ path: 'shot-magnet.png' });
console.log('after magnet throw:', await st());
// Ofer whip (needs a ball on court — magnet ball is there)
await setPlayer(0, 'ofer');
await perkByText('whip').click();
console.log('phase:', (await st()).phase);
const bpos = await page.evaluate(() => { const b = window.__balls.find(b => b.team !== -1); return { x: b.body.position.x, z: b.body.position.z }; });
await page.evaluate(([x,z]) => window.__aimAt(x,z), [bpos.x, bpos.z]);
const before = (await st()).balls;
await page.mouse.click(640, 400);
await page.waitForTimeout(300);
await page.screenshot({ path: 'shot-whip.png' });
await page.waitForTimeout(1200);
const after = await st();
console.log('balls', before, '->', after.balls, '| phase:', after.phase, '| player:', after.player);
console.log('ofer extra throws:', await page.evaluate(() => window.__game.teams[0].players.find(p=>p.key==='ofer').extra));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
