// «طريق الأشكال» (games/shape-road.js) في وضع التلفاز عبر BroadcastChannel (?net=bc): تلفاز 1920×1080 وثلاثة جوالات 390×844.
// كلٌّ لنفسه ثم فريقان: «جاهز» من كل جوال يبدأ السباق، العصا توجّه والزرّ يسرّع، تصل النتيجة بدرجات مفهرسة بالمقعد (وteamScores في الفريقين)،
// ولقطات منتصف السباق. مدة الجولة «قصيرة» (roundScale 0.6 ⇒ 72 ث) ليقصر الاختبار. SHOTS=<مجلد> لحفظ اللقطات.
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chrome, BASE, sleep } from './lib.mjs';
const SHOTS = process.env.SHOTS || tmpdir(); mkdirSync(SHOTS, { recursive: true });
let fails = 0, total = 0;
const ok = (n, cond, i) => { total++; if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i === undefined ? '' : i).slice(0, 400)); };
const until = async (f, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await f(); if (v) return v; } catch { } await sleep(150); } return null; };
const shot = async (p, n) => { const s = await p.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SHOTS}/shape-road-${n}.png`, Buffer.from(s.result.data, 'base64')); return `${SHOTS}/shape-road-${n}.png`; };
const c = await chrome({ port: 9490, size: '1920,1080' });
const Q = '?debug=1&net=bc&nosw=1', NAMES = ['سارة', 'حمد', 'ريم'], pads = [];
const mouse = async (p, type, x, y) => p.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const rect = async (p, sel) => p.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()`);
const tapEl = async (p, sel) => { const r = await rect(p, sel); if (!r) throw new Error('no ' + sel); await mouse(p, 'mousePressed', r[0], r[1]); await sleep(40); await mouse(p, 'mouseReleased', r[0], r[1]); await sleep(60); };
async function openPad(url, i) {
  const p = await c.tab('about:blank');
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await p.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await p.nav(url, 1500); await until(() => p.ev(`!!document.getElementById('padGo')`), 8000);
  await p.ev(`document.querySelector('.pname').value=${JSON.stringify(NAMES[i])}`); await tapEl(p, `.pch:nth-child(${i + 1})`); await tapEl(p, '#padGo');
  return p;
}
const host = () => c.ev('Pads.state()');
async function race(tag) {
  await c.ev(`__engine.events.length=0; Pads._play('games/shape-road.js')`);
  ok(tag + ': game ready, pads switch to controller', !!(await until(async () => (await c.ev(`(()=>{const s=__engine.state(); return !!s&&s.ready})()`)) && (await Promise.all(pads.map(p => p.ev('PadApp.state().view')))).every(v => v === 'ctl'), 12000)));
  ok(tag + ': ready button labelled «جاهز»', (await until(() => pads[0].ev(`(document.getElementById('padBtnA')||{}).textContent`), 4000)) === 'جاهز');
  await shot(c, tag + '-tv-ready');
  for (const p of pads) await tapEl(p, '#padBtnA');
  ok(tag + ': all ready ⇒ race starts, buttons relabelled «أسرع»', !!(await until(() => pads[1].ev(`(document.getElementById('padBtnA')||{}).textContent==='أسرع'`), 6000)));
  await sleep(5000); // الشرح القصير / العدّ
  // جوال 0: العصا يمينًا ثم يسارًا ذهابًا وإيابًا · جوال 1: يمسك «أسرع» · جوال 2: ساكن
  const sr = await rect(pads[0], '#padStick'), br = await rect(pads[1], '#padBtnA');
  await mouse(pads[1], 'mousePressed', br[0], br[1]); await mouse(pads[0], 'mousePressed', sr[0], sr[1]);
  let end = null, shotDone = false, hud = new Set(); const t0 = Date.now();
  while (!end && Date.now() - t0 < 110000) {
    const k = Math.floor((Date.now() - t0) / 1500) % 2; await mouse(pads[0], 'mouseMoved', sr[0] + (k ? -90 : 90), sr[1]); await sleep(500);
    hud.add(await c.ev(`document.getElementById('hTime').textContent+'|'+document.getElementById('hScore').textContent`).catch(() => ''));
    if (!shotDone && Date.now() - t0 > 20000) { shotDone = true; await shot(c, tag + '-tv-play'); await shot(pads[0], tag + '-phone'); }
    end = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`);
  }
  await mouse(pads[0], 'mouseReleased', sr[0], sr[1]); await mouse(pads[1], 'mouseReleased', br[0], br[1]);
  ok(tag + ': race reached api.end', !!end, end && { scores: end.scores, teamScores: end.teamScores, text: end.text, s: Math.round((Date.now() - t0) / 1000) });
  ok(tag + ': HUD time counts down', hud.size > 5, [...hud].slice(0, 4));
  ok(tag + ': mid-race screenshots saved', shotDone);
  return end;
}
try {
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await c.nav(BASE + '/index.html' + Q, 1500);
  await c.ev(`localStorage.setItem('engine-prefs', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('engine-prefs')||'{}'), {round:0})))`);
  await c.nav(BASE + '/index.html' + Q, 1500);
  await c.ev(`document.getElementById('tvBtn').click()`); await sleep(800);
  const st = await host();
  ok('shape-road is listed among the TV pad games', !!(await until(() => c.ev(`[...document.querySelectorAll('#tvGames .gcard b')].some(b=>b.textContent.includes('طريق الأشكال'))`), 6000)));
  for (let i = 0; i < 3; i++) pads.push(await openPad(st.url, i));
  ok('3 pads joined', !!(await until(async () => (await host()).pads.filter(p => p.connected).length === 3, 8000)));
  const e1 = await race('free');
  if (e1) {
    ok('free: scores indexed by seat, finite, stick/boost players collected shapes', Array.isArray(e1.scores) && [0, 1, 2].every(i => Number.isFinite(e1.scores[i])) && e1.scores[0] + e1.scores[1] > 0, e1.scores);
    ok('free: no teamScores in free mode', e1.teamScores == null, e1.teamScores);
  }
  await c.ev(`[...document.querySelectorAll('#tv .row button')].find(b=>b.textContent.includes('الردهة')).click()`); await sleep(400);
  await c.ev(`[...document.querySelectorAll('#tvModes button')].find(b=>b.querySelector('b').textContent==='فريقان').click()`); await sleep(300);
  const e2 = await race('teams');
  if (e2) ok('teams: teamScores [A,B] finite (mean of members)', Array.isArray(e2.teamScores) && e2.teamScores.length === 2 && e2.teamScores.every(Number.isFinite), e2.teamScores);
  const errs = [...c.log, ...pads.flatMap(p => p.log)].filter(l => l.startsWith('exception'));
  ok('no page exceptions on TV or phones', errs.length === 0, errs.slice(0, 3));
  ok('no violations/game errors on the host', !(await c.ev(`__engine.events.some(e=>e.n==='violation'||e.n==='game-error')`)), await c.ev(`__engine.events.filter(e=>e.n==='violation'||e.n==='game-error').map(e=>e.d)`));
} catch (e) { fails++; total++; console.log('FAIL ERR', e.stack || e.message); }
finally { c.close(); console.log(`\n${total - fails}/${total} passed`); process.exit(fails ? 1 : 0); }
