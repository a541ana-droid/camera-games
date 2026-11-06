// يختبر ثلاث ألعاب جديدة (balloon-bop, simon-zones, goalie) بجوال عمودي 390×844 وتلفاز 1920×1080: يبدأ كل لعبة، يحقن حركة اصطناعية، ويتحقق من الوصول إلى api.end بدرجة منتهية بلا أخطاء صفحة. يحفظ لقطة منتصف اللعب في مجلد النظام المؤقت.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chrome, BASE, sleep } from './lib.mjs';
const SHOTS = process.env.SHOTS || tmpdir();
let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
const VIEWS = { phone: [390, 844, true], tv: [1920, 1080, false] };
// cfg: لعبة، عدد اللاعبين (أو 0 بلا اختيار)، حركة اصطناعية
const GAMES = [
  { f: 'balloon-bop', runs: [['phone', 0], ['tv', 0], ['phone', 0, 'still']] },
  { f: 'simon-zones', runs: [['phone', 3], ['tv', 1]] },
  { f: 'goalie', runs: [['phone', 1], ['tv', 4]] },
];
async function run(g, idx) {
  const c = await chrome({ port: 9360 + idx });
  const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(150); };
  try {
    for (const [view, players, still] of g.runs) {
      const [vw, vh, mob] = VIEWS[view];
      await c.send('Emulation.setDeviceMetricsOverride', { width: vw, height: vh, deviceScaleFactor: 1, mobile: mob });
      await c.nav(BASE + '/index.html?debug=1&mode=auto'); await c.ev(`document.getElementById('synth').checked=true`);
      await c.ev(`DebugSynth.state.blobs=[]; DebugSynth.state.hand=null; __engine.events.length=0; __engine.startGame('games/${g.f}.js')`); await sleep(2200);
      const [W, H] = await c.ev(`(()=>{const s=document.getElementById('stage'); return [s.clientWidth||innerWidth, s.clientHeight||innerHeight]})()`);
      const un = Math.min(W, H) / 100;
      if (players) { // اختيار عدد اللاعبين ثم «ابدأ»
        const tot = Math.min(W - un * 6, 440), gap = un * 2.5, bw = (tot - gap * 3) / 4, x0 = (W - tot) / 2;
        await tap(x0 + (players - 1) * (bw + gap) + bw / 2, H * 0.46 + 28); await tap(W / 2, H * 0.62 + 29);
      } else await tap(W / 2, H * 0.6);
      await sleep(4300);
      // حركة اصطناعية: يد تتحرك يمينًا ويسارًا وعلى ارتفاعات مختلفة، وكتلة ثانية
      if (!still) await c.ev(`DebugSynth.state.hand={x:.5,y:.7,r:.13,ax:.35,ay:.2,hz:1.3}; DebugSynth.state.blobs=[{c:'#ccc',x:.2,y:.45,r:.1,ax:.1,ay:.25,hz:.8,ph:2}]`);
      await sleep(14000);
      const shot = await c.send('Page.captureScreenshot', { format: 'png' }); const path = SHOTS + `/newgame-${g.f}-${view}-${players}p${still ? '-still' : ''}.png`; writeFileSync(path, Buffer.from(shot.result.data, 'base64')); console.log('shot', path);
      let end = null; for (let i = 0; i < 160 && !end; i++) { await sleep(500); end = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`); }
      const errs = await c.ev(`__engine.events.filter(e=>/error|violation/.test(e.n)).map(e=>e.n+':'+JSON.stringify(e.d)).slice(0,3)`);
      ok(g.f + ' ' + view + ' reaches end with finite score', end && Number.isFinite(end.score), { end, errs });
      if (still) ok(g.f + ' still (no motion) scores low: gravity works', end && end.score < 30, end);
      ok(g.f + ' ' + view + ' no game errors', errs.length === 0, errs);
      await c.ev(`__engine.stopGame('exit')`); await sleep(300);
    }
    ok(g.f + ' no page exceptions', !c.log.some(l => l.startsWith('exception')), c.log.filter(l => l.startsWith('exception')));
  } catch (e) { console.log('ERR', g.f, e); fails++; } finally { c.close(); }
}
await Promise.all(GAMES.map(run));
console.log(fails ? `FAILED ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0);
