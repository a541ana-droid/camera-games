// يلعب «سباق الحارات» كاملًا بلمسات حقيقية (CDP Input) وفيديو اصطناعي، ويتحقق أن الفائز هو اللاعب الذي تحرّك في حارته، في الوضعين (حركة/لون).
import { writeFileSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const SHOTS = process.env.SHOTS || (await import('node:os')).tmpdir();
const c = await chrome(), out = []; let fails = 0;
const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(150); };
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
const blob = (col, x, mv, r = .1) => ({ c: col, x, y: .5, r, ...(mv ? { ax: .12, ay: .05, hz: 3 } : {}) });
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await c.ev(`document.getElementById('synth').checked=true`);
  const size = await c.ev(`[document.getElementById('stage').clientWidth||innerWidth, innerHeight]`); console.log('viewport', JSON.stringify(size));
  const W = size[0], H = size[1];
  const bw = Math.min(110, (W - 60) / 3), x0 = W / 2 - (3 * bw + 20) / 2, y1 = H * .4, y2 = H * .52, bw2 = Math.min(160, (W - 50) / 2), x2 = W / 2 - bw2 - 5, y3 = H * .66;
  for (const [label, count, mode, winner, blobs] of [
    ['motion-3p-lane3', 3, 'motion', 2, [blob('#e5484d', .17, false, .06), blob('#4cc38a', .5, false, .06), blob('#3b82f6', .83, true, .13)]],
    ['color-2p-player1', 2, 'color', 0, [blob('#e5484d', .25, true, .08), blob('#4cc38a', .75, false, .08)]],
  ]) {
    await c.ev(`DebugSynth.state.blobs=[]; __engine.events.length=0; __engine.startGame('games/multi-lane.js')`); await sleep(1800);
    await tap(x0 + (count - 2) * (bw + 10) + bw / 2, y1 + 25);              // عدد اللاعبين
    await tap(mode === 'motion' ? x2 + bw2 / 2 : x2 + bw2 + 10 + bw2 / 2, y2 + 25); // الوضع
    await tap(W / 2, y3 + 28);                                              // ابدأ
    await sleep(3600); await c.ev(`DebugSynth.state.blobs=${JSON.stringify(blobs)}`);
    await sleep(4000); const shot = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(SHOTS + '/race-' + label + '.jpg', Buffer.from(shot.result.data, 'base64'));
    let end = null; for (let i = 0; i < 80 && !end; i++) { await sleep(500); end = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`); }
    const state = await c.ev(`(()=>{const s=__engine.state(); return s? {mode:s.mode, frames:s.frames}:null})()`);
    ok(label + ' winner', end && end.text.includes('اللاعب ' + ['1', '2', '3', '4'][winner]), { end, state });
    await c.ev(`__engine.stopGame('exit')`); await sleep(300);
  }
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
