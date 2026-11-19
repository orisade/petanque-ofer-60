import { chromium } from 'playwright';
const t0 = Date.now();
const errors = [];
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 900, height: 600 } });
p.on('pageerror', e => errors.push(String(e)));
await p.goto('http://localhost:5173');
await p.click('#start-btn');                 // no test mode: zero coins
await p.waitForTimeout(300);

// everything below runs inside the page, stepping the sim as fast as it can
const out = await p.evaluate(async () => {
  const log = [];
  const T = window.__t.fast();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  log.push(['kickoff coins', T.state().coins]);

  // play a whole end: jack, then every boule, answering trivia right
  for (let guard = 0; guard < 60; guard++) {
    const s = T.state();
    if (document.querySelector('#next-end-btn')?.offsetParent) {
      document.getElementById('next-end-btn').click();
      await sleep(20);
      continue;
    }
    if (document.getElementById('trivia-answers').children.length &&
        !document.getElementById('trivia-screen').classList.contains('hidden')) {
      const team = document.getElementById('trivia-team').textContent;
      T.answer(true);
      await sleep(30);
      log.push([`${team} correct -> coins`, T.state().coins]);
      continue;
    }
    if (s.phase === 'between') { await sleep(20); continue; }
    if (s.phase === 'aim-jack') { T.throwAt({ power: 0.75, loft: 0.42, dist: 9 }); continue; }
    if (s.phase === 'aim') { T.throwAt({ power: 0.55 + Math.random() * 0.1, loft: 0.5, dirX: (Math.random() - 0.5) * 0.6 }); continue; }
    break;
  }
  log.push(['after end 1, coins kept', T.state().coins]);
  log.push(['score', T.state().scores]);

  // spend: Mom's cleaner costs 1
  const g = window.__game;
  g.teams[0].coins = 3;
  g.current = 0;
  g.currentPlayer = g.teams[0].players.find(x => x.key === 'mom');
  g.currentPlayer.thrown = false;
  g.phase = 'aim';
  window.__refresh();
  log.push(['before spend', T.state().coins]);
  T.perk('cleaner');
  log.push(['after firing cleaner (cost 1)', T.state().coins]);
  return log;
});
out.forEach(([k, v]) => console.log(String(k).padEnd(34), JSON.stringify(v)));
console.log('ERRORS:', errors.length ? errors : 'none');
console.log(`\nwall time: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await b.close();
