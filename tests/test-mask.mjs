import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.check('#test-mode');
await page.click('#start-btn');
await page.waitForTimeout(400);
for(let i=0;i<4;i++){ if(!(await page.evaluate(()=>window.__game.throwingJack))) break; await page.mouse.move(640,380); await page.mouse.down(); await page.waitForTimeout(520); await page.mouse.up(); await page.waitForTimeout(2300); }
const setPlayer=(t,k)=>page.evaluate(([t,k])=>{const g=window.__game;g.current=t;g.currentPlayer=g.teams[t].players.find(p=>p.key===k);g.currentPlayer.thrown=false;g.phase='aim';window.__refresh();},[t,k]);
const throwIt=async(y=370)=>{await page.mouse.move(640,y);await page.mouse.down();await page.waitForTimeout(470);await page.mouse.up();for(let i=0;i<40;i++){await page.waitForTimeout(250);if(await page.evaluate(()=>window.__game.phase)==='aim')return;}};
await setPlayer(0,'mom'); await throwIt(380);   // a boule to shoot
await setPlayer(1,'gali');
await page.locator('#perk-bar button.perk-ready',{hasText:'disguise'}).click();
await page.waitForTimeout(200);
await page.locator('#disguise-options button',{hasText:'sniper'}).click();
await page.waitForTimeout(1500);
console.log('disguised as:', await page.evaluate(()=>window.__game.disguise?.as));
// use the borrowed sniper
const b=await page.evaluate(()=>{const x=window.__balls.find(b=>b.team!==-1);return{x:x.body.position.x,z:x.body.position.z};});
await page.evaluate(([x,z])=>window.__aimAt(x,z),[b.x,b.z]);
await page.locator('#perk-bar button.perk-ready',{hasText:'snipe'}).click();
await page.waitForTimeout(150);
console.log('disguise right after using perk:', await page.evaluate(()=>window.__game.disguise));
await page.mouse.click(640,400);
await page.waitForTimeout(250);
await page.screenshot({path:'shot-maskoff.png'});
await page.waitForTimeout(1200);
console.log('phase:', await page.evaluate(()=>window.__game.phase), '| player:', await page.evaluate(()=>window.__game.currentPlayer?.key));
console.log('banner:', await page.textContent('#turn-banner'));
console.log('ERRORS:', errors.length?errors:'none');
await browser.close();
