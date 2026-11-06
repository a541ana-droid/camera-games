// الألعاب الثلاث (تفادى! / فقاعات / متاهة الميلان): كل لعبة تُحمَّل وتُبدأ بلمسة حقيقية وتُغذّى بمدخل اصطناعي (يد اصطناعية / ميل اصطناعي)
// وتنتهي بـapi.end ونتيجة منتهية بلا أخطاء صفحة. تُشغَّل المتغيّرات بالتوازي (كل واحد في كروم مستقل) وتُحفظ لقطة منتصف اللعب في مجلد النظام المؤقت.
// المتغيّرات المتسلسلة (series) تلتقط ردّ المضيف Series.result لفحص scores/ranks لكل لاعب.
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chrome, BASE, sleep } from './lib.mjs';
const SHOTS = process.env.SHOTS || tmpdir();
let fails = 0, total = 0;
const ok = (n, cond, i) => { total++; if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
// مركز زرّ i من ui.row (اليسار ← اليمين) كما في runtime.js
const rowX = (W, H, n, i, maxW, gap) => { const u = Math.min(W, H) / 100, g = gap, tot = Math.min(W - u * 6, maxW), w = (tot - g * (n - 1)) / n; return (W - tot) / 2 + i * (w + g) + w / 2; };
const VAR = [
  { id: 'lane-phone-series2', game: 'games/lane-dodger.js', vp: [390, 844], series: ['أ', 'ب'], hand: { x: 0.25, y: 0.6, r: 0.1, ax: 0.2, ay: 0.05, hz: 2 }, expectScores: 2,
    taps: (W, H) => [[W / 2, H * 0.62 + 29]], shotAt: 4 },
  { id: 'lane-tv-4p', game: 'games/lane-dodger.js', vp: [1920, 1080], hand: { x: 0.62, y: 0.6, r: 0.08, ax: 0.1, ay: 0.05, hz: 2 },
    taps: (W, H) => [[rowX(W, H, 4, 3, 420, 8), H * 0.46 + 27], [W / 2, H * 0.62 + 29]], shotAt: 4 },
  { id: 'bubbles-phone-shared', game: 'games/bubble-mirror.js', vp: [390, 844], hand: { x: 0.5, y: 0.5, r: 0.12, ax: 0.35, ay: 0.3, hz: 1.2 }, minScore: 3,
    taps: (W, H) => [[W / 2, H * 0.67 + 29]], shotAt: 12 },
  { id: 'bubbles-tv-series3-split', game: 'games/bubble-mirror.js', vp: [1920, 1080], series: ['أ', 'ب', 'ج'], hand: { x: 0.5, y: 0.5, r: 0.1, ax: 0.4, ay: 0.3, hz: 1.2 }, expectScores: 3,
    taps: (W, H) => [[rowX(W, H, 2, 1, 420, 10), H * 0.4 + 27], [W / 2, H * 0.67 + 29]], shotAt: 12 },
  { id: 'maze-phone-1p', game: 'games/tilt-maze.js', vp: [390, 844], sensors: true, taps: (W, H) => [[W / 2, H * 0.62 + 29]], shotAt: 10 },
  { id: 'maze-tv-series2', game: 'games/tilt-maze.js', vp: [1920, 1080], sensors: true, series: ['أ', 'ب'], expectScores: 2, passTaps: 1, taps: (W, H) => [[W / 2, H * 0.62 + 29]], shotAt: 10 },
];
async function run(v, idx) {
  const c = await chrome({ port: 9460 + idx, size: v.vp.join(',') });
  try {
    await c.send('Emulation.setDeviceMetricsOverride', { width: v.vp[0], height: v.vp[1], deviceScaleFactor: 1, mobile: v.vp[0] < 600 });
    await c.nav(BASE + '/index.html?debug=1' + (v.sensors ? '&sensors=1' : '')); await c.ev(`document.getElementById('synth').checked=true`);
    const [W, H] = await c.ev(`[document.getElementById('stage').clientWidth||innerWidth, innerHeight]`);
    const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(250); };
    await c.ev(`window.__res=null; __engine.events.length=0; if(window.Series){const o=Series.result; Series.result=m=>{window.__res=JSON.parse(JSON.stringify(m)); return o.call(Series,m)}}`);
    if (v.hand) await c.ev(`DebugSynth.state.hand=null`);
    if (v.series) await c.ev(`Series.start({names:${JSON.stringify(v.series)},games:['${v.game}'],rounds:1})`); else await c.ev(`__engine.startGame('${v.game}')`);
    if (v.series) { await sleep(600); await c.ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/^ابدأ/.test(b.textContent.trim())&&b.offsetParent); if(b) b.click()})()`); } // شاشة «اللعبة 1 من 1» في السلسلة
    for (let i = 0; i < 120 && !(await c.ev(`!!(__engine.state()&&__engine.state().ready)`)); i++) await sleep(300);
    await sleep(900);
    ok(v.id + ' loaded and ready', await c.ev(`!!(__engine.state()&&__engine.state().ready)`), { W, H });
    for (const [x, y] of v.taps(W, H)) await tap(x, y);
    await sleep(3800); // العدّ التنازلي
    if (v.hand) await c.ev(`DebugSynth.state.hand=${JSON.stringify(v.hand)}`);
    if (v.sensors) await c.ev(`window.__iv=setInterval(()=>{const s=__engine.sensors.synth; const t=performance.now()/1000; s.x=0.5*Math.sin(t*1.7)+0.3*Math.sin(t*0.6); s.y=0.5*Math.cos(t*1.3)}, 100)`);
    let end = null, shot = false, passTaps = v.passTaps || 0, hudSeen = new Set(), t0 = Date.now();
    while (!end && Date.now() - t0 < 170000) {
      await sleep(500); const el = (Date.now() - t0) / 1000;
      if (!shot && el >= v.shotAt) { shot = true; const s = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SHOTS}/newgames-${v.id}.png`, Buffer.from(s.result.data, 'base64')); }
      hudSeen.add(await c.ev(`document.getElementById('hScore').textContent+'|'+document.getElementById('hTime').textContent`).catch(() => ''));
      if (passTaps > 0 && el > 64 && !(await c.ev(`!!(window.__res)`))) { /* شاشة التمرير: لمسة واحدة تنقل الدور */ if (el < 70 || el % 3 < 0.6) { await tap(W / 2, H / 2); passTaps = 0; } }
      end = v.series ? await c.ev(`window.__res`) : await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`);
    }
    ok(v.id + ' reached api.end', !!end, { end: end && { score: end.score, scores: end.scores, ranks: end.ranks, text: end.text }, seconds: Math.round((Date.now() - t0) / 1000) });
    if (end) {
      ok(v.id + ' score finite', Number.isFinite(end.score), end.score);
      if (v.series) ok(v.id + ' per-player scores finite, length ' + v.expectScores, Array.isArray(end.scores) && end.scores.length === v.expectScores && end.scores.every(Number.isFinite), end.scores);
      if (v.minScore != null) ok(v.id + ' synthetic hand popped bubbles (score >= ' + v.minScore + ')', end.score >= v.minScore, end.score);
      if (v.series && end.ranks) ok(v.id + ' ranks valid', end.ranks.length === v.expectScores && end.ranks.every(r => Number.isInteger(r) && r >= 1), end.ranks);
    }
    ok(v.id + ' mid-play screenshot saved', shot, `${SHOTS}/newgames-${v.id}.png`);
    ok(v.id + ' HUD updated during play', hudSeen.size > 2, [...hudSeen].slice(0, 4));
    const errs = c.log.filter(l => l.startsWith('exception') || /game-error|violation/i.test(l));
    ok(v.id + ' no page errors / violations', errs.length === 0 && !(await c.ev(`__engine.events.some(e=>e.n==='game-error'||e.n==='violation')`)), errs.slice(0, 3));
  } catch (e) { fails++; total++; console.log('FAIL ' + v.id + ' ERR', e.message); } finally { c.close(); }
}
const only = process.env.ONLY; const list = VAR.map((v, i) => [v, i]).filter(([v]) => !only || v.id.includes(only));
await Promise.all(list.map(([v, i]) => run(v, i)));
console.log(`\n${total - fails}/${total} passed`);
process.exit(fails ? 1 : 0);
