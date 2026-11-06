// التراجع التلقائي: إن لم يبدأ الـWorker داخل iframe (محاكاة: ?breaklauncher=1) ينتقل المحرك إلى Worker من المضيف ويعمل اللعب، وتبقى بقية الجلسة على host.
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome(); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
try {
  await c.nav(BASE + '/index.html?debug=1&breaklauncher=1&mode=auto');
  await c.ev(`__engine.startGame('tests/games/idle.js')`); await sleep(5000);
  const r = await c.ev(`(()=>{const s=__engine.state(); return {ev:__engine.events.filter(e=>e.n!=='hb').map(e=>e.n+':'+e.d), mode:s&&s.mode, ready:s&&s.ready, frames:s&&s.frames, fell:__engine.fellBack(), launcher:!!document.getElementById('launcher')}})()`);
  ok('iframe launch failed → fallback to host → game ready and running', r.fell && r.mode === 'host' && r.ready && r.frames > 30 && !r.launcher, r);
  await c.ev(`__engine.startGame('tests/games/idle.js')`); await sleep(1500);
  const r2 = await c.ev(`(()=>{const s=__engine.state(); return {mode:s&&s.mode, ready:s&&s.ready}})()`); ok('next game in the session goes straight to host mode', r2.mode === 'host' && r2.ready, r2);
  await c.ev(`__engine.startGame('games/zz-loop-test.js')`); await sleep(4500);
  ok('hang is also terminated in host mode', await c.ev(`!__engine.state() && __engine.events.some(e=>e.n==='stop'&&e.d==='no-heartbeat')`), null);
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
