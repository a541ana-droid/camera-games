// دورة الحياة بلا إعادة تحميل: (1) إطارات مزوّرة تُرسل مباشرة إلى معالج المضيف، (2) لعبة معلّقة ← رسالة مقروءة ← زرّا «إعادة» و«القائمة» يعملان والصفحة نفسها (علامة window تبقى) ودورات متتالية،
// (3) تأخّر حلقة أحداث المضيف أثناء التعليق، (4) zz-loop-test تُنهى بنظافة.
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome(); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
const click = async sel => { const r = await c.ev(`(()=>{const b=document.querySelector('${sel}').getBoundingClientRect(); return [b.x+b.width/2, b.y+b.height/2]})()`); for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: r[0], y: r[1], button: 'left', clickCount: 1 }); await sleep(200); };
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await c.ev(`document.getElementById('synth').checked=true; window.__marker='same-page-'+Math.random()`);
  const marker = await c.ev('window.__marker');
  // (1) إطارات مزوّرة
  await c.ev(`__engine.startGame('tests/games/idle.js')`); await sleep(1500);
  const OP = await c.ev(`Object.fromEntries(Draw.spec().map((x,i)=>[x[0],i]))`);
  const forge = async (msg, inflight) => c.ev(`(()=>{const s=__engine.state(); s.inflight=${inflight}; const v0=s.viol; s.port.onmessage({data:${JSON.stringify(msg)}}); return {viol:s.viol-v0, running:!!__engine.state()}})()`);
  const cases = [['bad opcode', { t: 'frame', b: [9999, 1, 2] }, true], ['string in number slot', { t: 'frame', b: [0, 'x', 0, 0, 0] }, true], ['NaN as number', { t: 'frame', b: [0, 0, 0, null, 5] }, true], ['truncated args', { t: 'frame', b: [0, 1, 2] }, true],
    ['too many elements', { t: 'frame', b: new Array(30000).fill(0) }, true], ['not an array', { t: 'frame', b: 'abc' }, true], ['unsolicited (no tick in flight)', { t: 'frame', b: [] }, false],
    ['save depth 100', { t: 'frame', b: Array.from({ length: 100 }, () => OP.save) }, true]];
  for (const [name, msg, inf] of cases) { const r = await forge(msg, inf); ok('forged frame: ' + name + ' → violation counted, host alive', r.viol >= 1 && r.running, r); await c.ev(`(()=>{const s=__engine.state(); if(s){s.viol=0; s.inflight=false}})()`); }
  const mal = await forge({ t: 'frame', b: [OP.fillRect, 1, 1, 1, 1, OP.moveTo, 7, 7] }, true); // fillRect صالحة: لا انتهاك
  ok('forged-but-valid frame is just drawn', mal.viol === 0, mal);
  const okMsgs = [{ t: 'hud', score: 'x'.repeat(5000) }, { t: 'track.start', id: 'k1', kind: 'lanes', opts: { count: 2 } }, { t: 'track.start', id: 'k2', kind: 'nope' }, { t: 'audio.tone', f: 440 }];
  const before = await c.ev(`__engine.state().viol`); for (const m of okMsgs) await c.ev(`__engine.state() && __engine.state().port.onmessage({data:${JSON.stringify(m)}})`);
  const after = await c.ev(`__engine.state() ? __engine.state().viol : 'stopped'`); ok('other forged messages: cap/kind/undeclared-cap violations counted; oversize HUD text truncated', typeof after === 'number' && after >= before + 3, { before, after });
  await c.ev(`__engine.stopGame('exit')`); await sleep(300);
  // (2)+(3) تعليق ثم أزرار بلا reload، 3 دورات
  for (let i = 1; i <= 3; i++) {
    await c.ev(`window.__lag=0; window.__l0=performance.now(); clearInterval(window.__li); window.__li=setInterval(()=>{const n=performance.now(); window.__lag=Math.max(window.__lag, n-window.__l0-50); window.__l0=n;},50); __engine.events.length=0; __engine.startGame('games/zz-loop-test.js')`);
    let ov = null; for (let k = 0; k < 40 && !ov; k++) { await sleep(250); ov = await c.ev(`(()=>{const o=document.getElementById('ov'); return !o.hidden && o.className==='err' ? document.getElementById('ovT').textContent : null})()`); }
    const stop = await c.ev(`(__engine.events.find(e=>e.n==='stop'&&e.d!=='replace')||{}).d`), lag = await c.ev('window.__lag');
    const ts = await c.ev(`(()=>{const a=__engine.events.find(e=>e.n==='ready'), b=__engine.events.find(e=>e.n==='stop'&&e.d!=='replace'); return a&&b? b.at-a.at : null})()`);
    ok(`cycle ${i}: hang reported with readable reason`, stop === 'no-heartbeat' && /علقت/.test(ov || ''), { stop, ov: (ov || '').slice(0, 70), msFromReadyToKill: ts });
    ok(`cycle ${i}: host event-loop lag during hang small`, lag < 150, { lagMs: Math.round(lag) });
    ok(`cycle ${i}: clean state (no state, launcher/worker gone, camera closed)`, await c.ev(`!__engine.state() && !document.getElementById('launcher') && !__engine.cameraOpen()`), null);
    ok(`cycle ${i}: same page (no reload)`, (await c.ev('window.__marker')) === marker, null);
    if (i < 3) { await click('#ovA'); await sleep(600); ok(`cycle ${i}: «إعادة» restarted the game without reload`, await c.ev(`!!__engine.state()`), null); }
    else { await click('#ovB'); await sleep(300); ok('«القائمة» shows the menu without reload', await c.ev(`!document.getElementById('menu').hidden && document.getElementById('stage').hidden`) && (await c.ev('window.__marker')) === marker, null); }
  }
  // (4) لعبة سليمة تعمل بعد التعليقات في الصفحة نفسها
  await c.ev(`__engine.startGame('games/mole-air.js')`); await sleep(2000);
  ok('healthy game runs after hangs, same page', await c.ev(`(()=>{const s=__engine.state(); return !!s && s.ready && s.frames>30})()`), await c.ev(`(()=>{const s=__engine.state(); return s&&{frames:s.frames, mode:s.mode}})()`));
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
