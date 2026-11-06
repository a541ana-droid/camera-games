// قياس الحِمل في Chrome headless (ليس الآيفون): لكل لعبة متوسط «المشغول» على الخيط الرئيسي وزمن التحليل والرسم ومعدّل التحليل،
// ثم: القائمة خاملة تمامًا (لا كاميرا ولا حلقة ولا مؤقّتات)، ثم: إبطاء التحليل صناعيًا (محاكاة سخونة) يخفض المعدّل درجةً درجة.
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome(); let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fail++; };
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await c.ev(`document.getElementById('synth').checked=true`);
  for (const g of ['games/color-hunt.js', 'games/freeze.js', 'games/mole-air.js', 'games/multi-lane.js', 'tests/games/draw-parity.js']) {
    const r = await c.ev(`(async()=>{const E=__engine; E.events.length=0; E.startGame('${g}'); await new Promise(x=>setTimeout(x,7000)); const p=E.events.filter(e=>e.n==='perf').map(e=>e.d); E.stopGame('exit'); return {g:'${g}', last:p[p.length-1], sum:E.lastSummary}})()`);
    console.log(JSON.stringify(r)); ok(r.sum && r.sum.busy < 30, r.g + ' مشغول < 30%'); await sleep(300);
  }
  // القائمة خاملة: نعدّ كل rAF وsetInterval وsetTimeout يُطلب خلال 3 ثوانٍ بعد الخروج
  const idle = await c.ev(`(async()=>{const E=__engine; E.startGame('games/color-hunt.js'); await new Promise(x=>setTimeout(x,2500)); E.stopGame('exit');
    let raf=0, iv=0, to=0; const R=window.requestAnimationFrame, I=window.setInterval, T=window.setTimeout;
    window.requestAnimationFrame=f=>{raf++;return R(f)}; window.setInterval=(f,t)=>{iv++;return I(f,t)}; window.setTimeout=(f,t)=>{to++;return T(f,t)};
    await new Promise(x=>T(x,3000)); window.requestAnimationFrame=R; window.setInterval=I; window.setTimeout=T;
    return {raf, iv, to, cam:E.cameraOpen(), state:!!E.state(), audio:!!E.audio(), workers:document.querySelectorAll('iframe').length}})()`);
  console.log(JSON.stringify(idle)); ok(!idle.raf && !idle.iv && !idle.to && !idle.cam && !idle.state && !idle.audio && !idle.workers, 'القائمة خاملة: لا حلقة ولا مؤقّت ولا كاميرا ولا صوت ولا حاضن');
  // سخونة محاكاة: بعد 4 ثوانٍ نجعل كل تحليل أبطأ بـ6 مللي ث فيجب أن ينخفض المعدّل
  const hot = await c.ev(`(async()=>{const E=__engine; E.events.length=0; E.startGame('games/color-hunt.js'); await new Promise(x=>setTimeout(x,5000));
    const C=Analyzer.capture; Analyzer.capture=function(){const t=performance.now(); while(performance.now()-t<6); return C.apply(this,arguments)};
    await new Promise(x=>setTimeout(x,9000)); Analyzer.capture=C; const hz=E.events.filter(e=>e.n==='hz').map(e=>e.d); const s=E.state(); const cur=s&&s.hz; E.stopGame('exit'); return {hz, cur}})()`);
  console.log(JSON.stringify(hot)); ok(hot.cur < 30 && hot.hz.length >= 1, 'السخونة المحاكاة خفّضت التحليل إلى ' + hot.cur + 'Hz');
  const cool = await c.ev(`(async()=>{const E=__engine; E.events.length=0; E.startGame('games/color-hunt.js'); await new Promise(x=>setTimeout(x,6000)); const s=E.state(); const cur=s&&s.hz; E.stopGame('exit'); return {cur, downs:E.events.filter(e=>e.n==='hz').length}})()`);
  console.log(JSON.stringify(cool)); ok(cool.cur === 30 && cool.downs === 0, 'بلا سخونة يبقى التحليل 30Hz');
} finally { c.close(); console.log(fail ? fail + ' FAIL' : 'ALL PASS'); process.exit(fail ? 1 : 0); }
