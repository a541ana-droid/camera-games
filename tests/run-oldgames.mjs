// الألعاب الثلاث الأصلية على المحرك 0.2: تُلعب بلمسات حقيقية وفيديو اصطناعي، ويُتحقق من التقدّم الفعلي عبر HUD (يمرّ من Worker ← المضيف).
import { writeFileSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const SHOTS = process.env.SHOTS || (await import('node:os')).tmpdir();
const c = await chrome(); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(150); };
const hud = () => c.ev(`['hScore','hTitle','hTime'].map(i=>document.getElementById(i).textContent)`);
const shot = async n => { const s = await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(SHOTS + '/' + n + '.jpg', Buffer.from(s.result.data, 'base64')); };
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await c.ev(`document.getElementById('synth').checked=true`);
  // صيد الألوان: المطلوب لون عشوائي من 5؛ نغطي المنطقة الوسطى بالألوان كلها بالتناوب
  await c.ev(`__engine.startGame('games/color-hunt.js')`); await sleep(1800); await tap(450, 300); await sleep(300);
  const cols = ['#e5484d', '#4cc38a', '#3b82f6', '#f5d90a', '#f97316']; let sc = 0;
  for (let i = 0; i < 14 && sc === 0; i++) { /* كل لون 2.2 ث: يكفي للتثبيت حتى مع العدّ التنازلي وحِمل الجهاز */ await c.ev(`DebugSynth.state.blobs=[{c:'${cols[i % 5]}',x:.5,y:.5,r:.28}]`); await sleep(2200); const h = await hud(); const m = /(\d+)/.exec(h[0] || ''); sc = m ? +m[1] : 0; }
  await shot('color-hunt-play'); ok('color-hunt: score rose after matching the requested color in the zone', sc > 0, await hud());
  await c.ev(`__engine.stopGame('exit'); DebugSynth.state.blobs=[]`); await sleep(300);
  // مطرقة الهواء: يد تكنس الشاشة كلها
  await c.ev(`__engine.startGame('games/mole-air.js')`); await sleep(1800); await tap(450, 300); await sleep(300);
  await c.ev(`DebugSynth.state.hand={x:.5,y:.5,r:.22,ax:.45,ay:.4,hz:3}`); await sleep(8000); await shot('mole-air-play');
  const h2 = await hud(); ok('mole-air: score > 0 after sweeping hand', +h2[0] > 0, h2); await c.ev(`__engine.stopGame('exit'); DebugSynth.state.hand=null`); await sleep(300);
  // تجمّد: ابدأ ثم راقب الانتقال من موسيقى إلى تجمّد ورفع مقياس الحركة
  await c.ev(`__engine.startGame('games/freeze.js')`); await sleep(1800); await tap(450, 300); await sleep(500);
  await c.ev(`DebugSynth.state.hand={x:.5,y:.5,r:.2,ax:.3,ay:.2,hz:3}`); await sleep(7000); await shot('freeze-play'); const h3 = await hud();
  ok('freeze: running with player scores in HUD and turn title', /اللاعب/.test(h3[0]) && /اللاعب/.test(h3[1]) && (await c.ev(`!!__engine.state()`)), h3); await c.ev(`__engine.stopGame('exit')`);
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
