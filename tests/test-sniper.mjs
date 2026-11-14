import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(400);
const st = () => page.evaluate(() => ({ phase: window.__game.phase, player: window.__game.currentPlayer?.key, balls: window.__balls.length }));
for (let i = 0; i < 4; i++) { if (!(await page.evaluate(() => window.__game.throwingJack))) break; await page.mouse.move(640,380); await page.mouse.down(); await page.waitForTimeout(520); await page.mouse.up(); await page.waitForTimeout(2300); }
const setPlayer = (t,k) => page.evaluate(([t,k]) => { const g=window.__game; g.current=t; g.currentPlayer=g.teams[t].players.find(p=>p.key===k); g.currentPlayer.thrown=false; g.phase='aim'; window.__refresh(); }, [t,k]);
const throwIt = async () => { await page.mouse.move(640,380); await page.mouse.down(); await page.waitForTimeout(480); await page.mouse.up(); for(let i=0;i<30;i++){await page.waitForTimeout(300); const s=await st(); if(s.phase==='aim') return s;} };
await setPlayer(0,'mom'); await throwIt();   // put a boule on court
await setPlayer(0,'yariv');
await page.locator('#perk-bar button.perk-ready', { hasText: 'snipe' }).click();
console.log('phase:', (await st()).phase, '| crosshair visible:', await page.isVisible('#crosshair'));
const b = await page.evaluate(() => { const x = window.__balls.find(b=>b.team!==-1); return {x:x.body.position.x,z:x.body.position.z}; });
await page.evaluate(([x,z]) => window.__aimAt(x,z), [b.x,b.z]);
const before = (await st()).balls;
await page.mouse.click(640, 400);
await page.waitForTimeout(150);
await page.screenshot({ path: 'shot-sniper.png' });
await page.waitForTimeout(900);
const after = await st();
console.log('balls', before, '->', after.balls, '| phase:', after.phase, '| player:', after.player);
console.log('turn banner:', await page.textContent('#turn-banner'));
// whip timing: Ofer
await setPlayer(0,'mom'); await throwIt();
await setPlayer(0,'ofer');
await page.locator('#perk-bar button.perk-ready', { hasText: 'whip' }).click();
const b2 = await page.evaluate(() => { const x = window.__balls.find(b=>b.team!==-1); return {x:x.body.position.x,z:x.body.position.z}; });
await page.evaluate(([x,z]) => window.__aimAt(x,z), [b2.x,b2.z]);
const t0 = Date.now();
await page.mouse.click(640, 400);
await page.waitForTimeout(900);
await page.screenshot({ path: 'shot-whip-slow.png' });
for (let i=0;i<40;i++){ await page.waitForTimeout(150); if ((await st()).phase === 'aim') break; }
console.log('whip duration ms:', Date.now()-t0);
console.log('banner:', await page.textContent('#turn-banner'));
console.log('boules left:', await page.textContent('#boules-left'));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
