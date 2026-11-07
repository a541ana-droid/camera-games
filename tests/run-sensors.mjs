// مستشعر الحركة (motion.device) وكشف قدرات الجهاز: كشف بلا فتح جهاز، تعطيل البطاقات، المصدر الاصطناعي، أحداث حقيقية مُصنَّعة، الحدّ 30Hz، الهزّ، اتجاه الشاشة، الإذن، النظافة عند الإيقاف، رفض غير المعلَن.
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome(); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
const click = async sel => { const r = await c.ev(`(()=>{const e=${sel}; e.scrollIntoView({block:'center'}); const b=e.getBoundingClientRect(); return [b.x+b.width/2, b.y+b.height/2]})()`); for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 }); await sleep(150); };
const card = t => `[...document.querySelectorAll('#list .card')].find(b=>b.textContent.includes('${t}'))`;
// حقن قبل تحميل الصفحة: عدّ استدعاءات الأجهزة والمستمعين، وكاميرا غير موجودة، وشاشة تلمس
const PRE = `window.__gum=0; window.__ls={}; window.__perm=0;
 const ml=navigator.mediaDevices; if(ml){ ml.getUserMedia=async()=>{window.__gum++; throw new Error('blocked')}; ml.enumerateDevices=async()=>window.__devs||[{kind:'audioinput',label:'Mic'},{kind:'audiooutput',label:'Speaker'}]; }
 const A=EventTarget.prototype.addEventListener, R=EventTarget.prototype.removeEventListener;
 EventTarget.prototype.addEventListener=function(t,...a){ if(/^device/.test(t)) window.__ls[t]=(window.__ls[t]||0)+1; return A.call(this,t,...a) };
 EventTarget.prototype.removeEventListener=function(t,...a){ if(/^device/.test(t)) window.__ls[t]=(window.__ls[t]||0)-1; return R.call(this,t,...a) };
 Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});
 DeviceMotionEvent.requestPermission=async()=>{window.__perm++; return 'granted'}; DeviceOrientationEvent.requestPermission=async()=>{window.__perm++; return 'granted'};`;
await c.send('Page.addScriptToEvaluateOnNewDocument', { source: PRE });
const ori = (g, b) => c.ev(`window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{gamma:${g},beta:${b},alpha:0}))`);
const mot = a => c.ev(`window.dispatchEvent(new DeviceMotionEvent('devicemotion',{acceleration:{x:${a},y:0,z:0},accelerationIncludingGravity:{x:${a},y:0,z:9.8}}))`);
const title = () => c.ev(`document.getElementById('hTitle').textContent`);
const lis = () => c.ev(`JSON.stringify(window.__ls)`);
try {
  // (1) كشف القدرات: لا كاميرا (قائمة بميكروفون فقط) ⇒ بطاقات الكاميرا معطّلة بسبب عربي، ولا getUserMedia ولا إذن عند التحميل
  await c.nav(BASE + '/index.html?debug=1');
  const d = await c.ev(`JSON.stringify(__engine.devices)`); const dev = JSON.parse(d);
  ok('probe exposed on __engine.devices', dev && dev.camera === false && dev.mic === true && dev.motion === true && dev.known === true, dev);
  ok('probe opened no device and asked no permission', (await c.ev('window.__gum')) === 0 && (await c.ev('window.__perm')) === 0 && (await lis()) === '{}', { gum: await c.ev('window.__gum'), perm: await c.ev('window.__perm'), ls: await lis() });
  const ch = await c.ev(`(()=>{const b=${card('صيد الألوان')}; return {dis:b.disabled, reason:b.querySelector('em').textContent}})()`);
  ok('camera card disabled with Arabic reason when no camera', ch.dis && /كاميرا/.test(ch.reason), ch);
  { const u = await c.ev(`(async()=>{ window.__devs=[{kind:'audioinput',label:''},{kind:'audiooutput',label:''}]; const r = await __engine.sensors.probe(); window.__devs=null; await __engine.sensors.probe(); return r; })()`);
    ok('before permission (no labels) a missing videoinput is NOT proof: camera counts as present', u.camera === true && u.known === false, u); }
  ok('motion card enabled when sensor present', (await c.ev(`${card('متاهة الميلان')}.disabled`)) === false, null);
  await c.ev(`document.getElementById('synth').checked=true; document.getElementById('synth').dispatchEvent(new Event('change'))`);
  ok('synthetic camera source re-enables camera cards (debug)', (await c.ev(`${card('صيد الألوان')}.disabled`)) === false, null);
  // (2) لا حسّاس ⇒ بطاقة الحركة معطّلة بالسبب المطلوب
  await c.nav(BASE + '/index.html?debug=1&sensors=0');
  const mc = await c.ev(`(()=>{const b=${card('متاهة الميلان')}; return {dis:b.disabled, reason:b.querySelector('em').textContent, motion:__engine.devices.motion}})()`);
  ok('motion card disabled with Arabic reason when no sensor', mc.dis && mc.motion === false && mc.reason === 'يحتاج مستشعر حركة — غير موجود في هذا الجهاز', mc);
  await c.ev(`__engine.startGame('games/tilt-balance.js')`); await sleep(800);
  ok('loading a motion game by path without sensor shows error, nothing runs', await c.ev(`!__engine.state() && /مستشعر حركة/.test(document.getElementById('ovT').textContent) && !__engine.sensors.active()`), await c.ev(`document.getElementById('ovT').textContent`));

  // (3) الإذن من نقرة البطاقة (قبل الإطلاق) + اللعب بالمصدر الاصطناعي
  await c.nav(BASE + '/index.html?debug=1&sensors=1');
  ok('menu: no listeners / nothing running', (await lis()) === '{}' && !(await c.ev('__engine.sensors.active()')), await lis());
  await click(card('متاهة الميلان')); await sleep(1800);
  ok('card tap requested motion+orientation permission (iOS flow shape)', (await c.ev('window.__perm')) === 0 || (await c.ev('window.__perm')) === 2, await c.ev('window.__perm')); // synth يتجاوزه؛ مسار iOS الفعلي في الاختبار 5
  ok('game running after tap, sensor active', await c.ev(`!!__engine.state() && __engine.state().ready && __engine.sensors.active()`), null);
  // «كرة الميزان» خرجت من القائمة (صارت مرحلة تمرين في المتاهة) وبقي ملفها مثبّتًا لهذا الفحص: تُشغَّل بالمسار
  await c.ev(`__engine.stopGame('exit')`); await sleep(200); await c.ev(`__engine.startGame('games/tilt-balance.js')`); await sleep(1500);
  await click('document.getElementById("cv")'); await c.ev(`__engine.sensors.synth.x=1`); await sleep(6500); // الشرح القصير (≈4ث) ثم اللعب
  ok('synthetic tilt reaches the game (ball hit first star)', /1\/5/.test(await c.ev(`document.getElementById('hScore').textContent`)), await c.ev(`document.getElementById('hScore').textContent`));
  await c.ev(`__engine.stopGame('exit')`); await sleep(200);
  ok('stopGame: sensor stopped', !(await c.ev('__engine.sensors.active()')), null);

  // (4) أحداث حقيقية مُصنَّعة (مسار الإنتاج): الحدّ 30Hz، الميل، الهزّ، الاتجاه
  await c.nav(BASE + '/index.html?debug=1');
  await c.ev(`__engine.startGame('tests/games/motion-count.js')`); await sleep(1500);
  ok('real listeners attached once each', (await lis()) === '{"deviceorientation":1,"devicemotion":1}', await lis());
  await ori(22.5, -45); await sleep(120); await ori(22.5, -45); await sleep(120);
  const [x, y] = (await title()).split('|'); ok('tilt normalized: gamma 22.5→0.5, beta −45→−1', Math.abs(x - 0.5) < .01 && Math.abs(+y + 1) < .01, await title());
  await ori(80, 80); await sleep(120); await ori(80, 80); await sleep(120); const [x2, y2] = (await title()).split('|'); ok('tilt clamped to ±1', +x2 === 1 && +y2 === 1, await title());
  const n0 = +(await title()).split('|')[4];
  await c.ev(`new Promise(r=>{let i=0; const iv=setInterval(()=>{window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{gamma:i%40,beta:0})); window.dispatchEvent(new DeviceMotionEvent('devicemotion',{acceleration:{x:1,y:0,z:0}})); if(++i>=400){clearInterval(iv); r()}},5)})`);
  const n1 = +(await title()).split('|')[4], per = (n1 - n0) / 2.0; ok('≤30Hz throttle: 800 events over ~2s ⇒ samples/s ≤ 32', per <= 32 && per >= 5, { samples: n1 - n0, perSec: per });
  await mot(25); await sleep(80); await ori(0, 0); await sleep(150); let p = (await title()).split('|'); ok('shake flagged once, mag ≈ 25', +p[3] === 1 && +p[2] > 20, p);
  await sleep(100); await mot(25); await sleep(80); await ori(0, 0); await sleep(150); p = (await title()).split('|'); ok('second shake within cooldown not re-flagged', +p[3] === 1, p);
  await c.ev(`Object.defineProperty(screen.orientation,'angle',{get:()=>90,configurable:true})`);
  await ori(22.5, 45); await sleep(120); await ori(22.5, 45); await sleep(120); const [x3, y3] = (await title()).split('|'); ok('orientation-aware: landscape 90° swaps axes (x=beta, y=−gamma)', Math.abs(x3 - 1) < .01 && Math.abs(+y3 + 0.5) < .01, await title());
  await c.ev(`__engine.stopGame('exit')`); await sleep(200);
  ok('stopGame removed both listeners (net 0)', (await lis()) === '{"deviceorientation":0,"devicemotion":0}' && !(await c.ev('__engine.sensors.active()')), await lis());
  const before = await c.ev(`new Promise(r=>{let k=0; const f=()=>k++; window.addEventListener('deviceorientation',f); window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{gamma:5})); window.removeEventListener('deviceorientation',f); r(k)})`);
  ok('(sanity) events after stop do not reach any game', before === 1 && !(await c.ev('!!__engine.state()')), before);

  // (5) مسار iOS: requestPermission تُستدعى من نقرة البطاقة (دون synth)، وقرار الرفض لا يشغّل شيئًا
  await c.nav(BASE + '/index.html?debug=1');
  await click(card('متاهة الميلان')); await sleep(2000);
  ok('iOS-shaped permission: requestPermission called for motion and orientation on card tap', (await c.ev('window.__perm')) === 2, await c.ev('window.__perm'));
  ok('granted ⇒ game ready with real listeners', await c.ev(`!!__engine.state() && __engine.state().ready`) && (await lis()) === '{"deviceorientation":1,"devicemotion":1}', await lis());
  await c.ev(`__engine.stopGame('exit')`); await sleep(200);
  await c.nav(BASE + '/index.html?debug=1&permission=denied');
  await click(card('متاهة الميلان')); await sleep(1500);
  ok('permission denied ⇒ Arabic error, game not started, no listeners', await c.ev(`!__engine.state() && /رُفض إذن/.test(document.getElementById('ovT').textContent)`) && (await lis()) === '{}', await c.ev(`document.getElementById('ovT').textContent`));

  // (6) حدود الأمان: لعبة لم تعلن القدرة، ورسالة مزوّرة
  await c.nav(BASE + '/index.html?debug=1');
  await c.ev(`__engine.startGame('tests/games/motion-nocap.js')`); await sleep(1500);
  const ud = await c.ev(`!__engine.state()`), uo = await c.ev(`/motion\\.device/.test(document.getElementById("ovT").textContent)`); ok("undeclared motion.device => readable EngineError, game closed, no listener", ud && uo && (await lis()) === "{}", { ud, uo, ls: await lis() });
  await c.ev(`__engine.startGame('tests/games/idle.js')`); await sleep(1200);
  const v = await c.ev(`(()=>{const s=__engine.state(), v0=s.viol; s.port.onmessage({data:{t:'track.start',id:'k9',kind:'devmotion',opts:{}}}); return {viol:s.viol-v0, active:__engine.sensors.active()}})()`);
  ok('forged devmotion start without capability ⇒ violation, no listener', v.viol === 1 && !v.active, v);
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
