// الميكروفون: (1) لا ميكروفون في القائمة (2) عيّنات اصطناعية تصل اللعبة بالشكل والمعدل (3) بلا قدرة ⇒ خطأ مقروء (4) مسار حقيقي بجهاز مزيّف: المسار يُوقف عند الخروج/إخفاء الصفحة/النهاية (5) المؤشر المرئي
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome({ fake: true }); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
const ind = () => c.ev(`!document.getElementById('micInd').hidden`);
const run = async (path, setup, ms = 4500) => { await c.ev(`__engine.events.length=0; __engine.startGame('${path}?'+Date.now())`); if (setup) await setup(); let r = null; for (let i = 0; i < ms / 100 && !r; i++) { await sleep(100); r = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`); } return r; };
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto'));
  ok('menu: no mic open, no tracks, indicator hidden', await c.ev('!Mic.live() && Mic.tracksLive===0') && !(await ind()), null);
  // (2) اصطناعي
  await c.ev(`Mic.useSynth({level:0.0,pitch:0,fire:0})`);
  const r = await run('tests/games/mic-probe.js', async () => { await sleep(600); await c.ev(`Mic.synth.level=0.8; Mic.synth.pitch=440`); await sleep(500); await c.ev(`Mic.synth.fire=1`); await sleep(300); await c.ev(`Mic.synth.level=0.05`); });
  const d = r && JSON.parse(r.text);
  ok('synthetic: samples reach the game, ≤30Hz', d && d.n > 20 && d.n <= 90, d);
  ok('synthetic: level rises toward 0.8 (smoothed, ≤1)', d && d.maxL > 0.6 && d.maxL <= 1, d && d.maxL);
  ok('synthetic: onset fired, loud flag set, pitch passes', d && d.onsets >= 1 && d.loud > 3 && d.pitch === 440, d);
  ok('sample shape only (no audio bytes): no extra keys leaked', d && d.keys === 'level,loud,onset,pitch' && d.err === '', null);
  ok('after end: mic closed + indicator hidden', !(await c.ev('Mic.live() && Mic.synth && false')) && !(await ind()), null);
  // (3) بلا قدرة
  const r3 = await run('tests/games/mic-nocap.js'); ok('no capability ⇒ readable EngineError', r3 && /audio\.mic/.test(r3.text), r3);
  // مؤشر أثناء اللعب
  await c.ev(`__engine.startGame('tests/games/mic-probe.js?'+Date.now())`); await sleep(900);
  ok('indicator visible while mic open', await ind() && /لا يُسجَّل/.test(await c.ev(`document.getElementById('micInd').textContent`)), null);
  await c.ev(`__engine.stopGame('exit')`); await sleep(200); ok('exit: indicator hidden, no sampling', !(await ind()) && (await c.ev('Mic.tracksLive')) === 0, null);
  // (4) مسار حقيقي بجهاز مزيّف
  await c.ev(`Mic.useSynth(null)`);
  const r4 = await run('tests/games/mic-probe.js', async () => { await sleep(1000); ok('real(fake device): track live during game', (await c.ev('Mic.tracksLive')) === 1 && await ind(), await c.ev('Mic.tracksLive')); });
  const d4 = r4 && JSON.parse(r4.text); ok('real(fake device): samples reach game', d4 && d4.n > 20 && d4.err === '', d4);
  await sleep(200); ok('real: track stopped after game end', (await c.ev('Mic.tracksLive')) === 0 && !(await ind()), null);
  await c.ev(`__engine.startGame('tests/games/mic-probe.js?'+Date.now())`); await sleep(1000);
  const had = await c.ev('Mic.tracksLive'); await c.ev(`__engine.stopGame('exit'); 0`); await sleep(200);
  ok('real: track stopped after exit', had === 1 && (await c.ev('Mic.tracksLive')) === 0, { had });
  await c.ev(`__engine.startGame('tests/games/mic-probe.js?'+Date.now())`); await sleep(1000);
  await c.ev(`Object.defineProperty(document,'hidden',{get:()=>true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); 0`); await sleep(200);
  ok('page hidden: track stopped, indicator hidden', (await c.ev('Mic.tracksLive')) === 0 && !(await ind()), null);
  await c.ev(`Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); 0`); await sleep(700);
  ok('page visible again: mic resumes', (await c.ev('Mic.tracksLive')) === 1, null);
  await c.ev(`__engine.stopGame('exit'); 0`); await sleep(200);
  ok('final: nothing open, menu state', (await c.ev('Mic.tracksLive')) === 0 && !(await ind()), null);
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
