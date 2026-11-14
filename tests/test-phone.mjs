import { chromium, devices } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function run(name, opts, shots) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${name}: ${e}`));
  await p.goto('http://localhost:5173');
  await p.check('#test-mode');
  await p.click('#start-btn');
  await p.waitForTimeout(1200);
  const touch = !!opts.hasTouch;
  // throw the jack with touch or mouse
  if (touch) {
    await p.touchscreen.tap(Math.round(p.viewportSize().width / 2), Math.round(p.viewportSize().height * 0.55));
    await p.waitForTimeout(400);
  }
  const perkRows = await p.locator('#perk-bar button').count();
  const chip = await p.textContent('#perk-bar button.perk-toggle');
  console.log(`${name.padEnd(16)} viewport=${p.viewportSize().width}x${p.viewportSize().height} fov=${await p.evaluate(() => +window.__camFov().toFixed(0))} perkRows=${perkRows} chip="${chip.trim()}"`);
  await p.screenshot({ path: shots[0] });
  // expand perks
  await p.click('#perk-bar button.perk-toggle');
  await p.waitForTimeout(200);
  console.log(`${' '.repeat(16)} expanded rows=${await p.locator('#perk-bar button').count()}`);
  await p.screenshot({ path: shots[1] });
  await ctx.close();
}

await run('desktop', { viewport: { width: 1280, height: 800 } }, ['shot-r-desktop.png', 'shot-r-desktop-open.png']);
await run('iPhone portrait', { ...devices['iPhone 13'] }, ['shot-r-phone.png', 'shot-r-phone-open.png']);
await run('iPhone landscape', { ...devices['iPhone 13 landscape'] }, ['shot-r-phone-ls.png', 'shot-r-phone-ls-open.png']);
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
