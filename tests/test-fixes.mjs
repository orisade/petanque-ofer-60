import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(400);
const st = () => page.evaluate(() => ({ phase: window.__game.phase, player: window.__game.currentPlayer?.key, balls: window.__balls.length, disguise: window.__game.disguise?.as ?? null }));
for (let i=0;i<4;i++){ if(!(await page.evaluate(()=>window.__game.throwingJack))) break; await page.mouse.move(640,380); await page.mouse.down(); await page.waitForTimeout(520); await page.mouse.up(); await page.waitForTimeout(2300); }
const setPlayer = (t,k) => page.evaluate(([t,k]) => { const g=window.__game; g.current=t; g.currentPlayer=g.teams[t].players.find(p=>p.key===k); g.currentPlayer.thrown=false; g.phase='aim'; window.__refresh(); }, [t,k]);
const throwIt = async () => { await page.mouse.move(640,370); await page.mouse.down(); await page.waitForTimeout(470); await page.mouse.up(); for(let i=0;i<40;i++){await page.waitForTimeout(250); const s=await st(); if(s.phase==='aim') return s;} return await st(); };

// --- 1. Ofer: whip then TWO throws in a row
await setPlayer(0,'mom'); await throwIt();
await setPlayer(0,'ofer');
await page.locator('#perk-bar button.perk-ready',{hasText:'whip'}).click();
const b = await page.evaluate(()=>{const x=window.__balls.find(b=>b.team!==-1);return{x:x.body.position.x,z:x.body.position.z};});
await page.evaluate(([x,z])=>window.__aimAt(x,z),[b.x,b.z]);
await page.mouse.click(640,400);
for(let i=0;i<30;i++){ await page.waitForTimeout(200); if((await st()).phase==='aim') break; }
console.log('after whip:', await st(), '| banner:', await page.textContent('#turn-banner'));
const s1 = await throwIt();
console.log('after 1st throw -> player:', s1.player, '| balls:', s1.balls, '| banner:', await page.textContent('#turn-banner'));
const s2 = await throwIt();
console.log('after 2nd throw -> player:', s2.player, '| balls:', s2.balls);

// --- 2. Gali disguise + copied perk
await setPlayer(1,'gali');
await page.locator('#perk-bar button.perk-ready',{hasText:'disguise'}).click();
await page.waitForTimeout(200);
console.log('disguise options:', await page.locator('#disguise-options button').count());
await page.locator('#disguise-options button',{hasText:'sniper'}).click();
await page.waitForTimeout(1600);
await page.screenshot({ path:'shot-disguise.png' });
console.log('disguised as:', (await st()).disguise, '| banner:', await page.textContent('#turn-banner'));
const sniperReady = await page.locator('#perk-bar button.perk-ready',{hasText:'snipe'}).count();
console.log('Gali can use the sniper:', sniperReady > 0);

// --- 3. magnet strength: distance of nearest ball to magnet after pull
await setPlayer(1,'ori');
await page.locator('#perk-bar button.perk-ready',{hasText:'magnet'}).click();
await throwIt();
await page.waitForTimeout(2600);
const d = await page.evaluate(() => {
  const m = window.__balls.find(b => b.magnet);
  if (!m) return null;
  return window.__balls.filter(b => b !== m).map(b => +Math.hypot(b.body.position.x-m.body.position.x, b.body.position.z-m.body.position.z).toFixed(2));
});
console.log('distances from magnet:', d);
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
