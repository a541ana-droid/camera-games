// 0.6: شاشات الجوال (اختيار + لمس/مصباح) وبيانات الفلاتر في رؤوس الألعاب. عبر BroadcastChannel (?net=bc، بلا إنترنت): تلفاز 1920×1080 + جوالان 390×844.
// يختبر: أزرار الاختيار تظهر كبيرة وبالعربية وبأرقام 0-9، تُقفل بعد أول لمسة، يصل الاختيار وزمنه إلى اللعبة مرة واحدة، الجوال العائد يستعيد شاشته،
// اللعبة تمسح الشاشة فيعود الذراع، المصباح في الظلام: الإصبع يصل إلى اللعبة ≤30/ث والعثور مرة لكل عنصر، مثال ENGINE.md §3.4.1 يُلعب حتى النهاية،
// @players/@minutes/@age/@play/@style تُقرأ لكل لعبة في القائمة، وcheck-game يتحقّق منها. ولا شبكة تصل اللعبة.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { chrome, BASE, sleep, exfilCount } from './lib.mjs';
const SHOTS = process.env.SHOTS || tmpdir(); mkdirSync(SHOTS, { recursive: true });
let fails = 0, total = 0;
const ok = (n, cond, i) => { total++; if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i === undefined ? '' : i).slice(0, 400)); };
const until = async (f, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await f(); if (v) return v; } catch { } await sleep(100); } return null; };
const shot = async (p, n) => { const s = await p.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SHOTS}/choice-${n}.png`, Buffer.from(s.result.data, 'base64')); };
const c = await chrome({ port: 9482, size: '1920,1080' });
const Q = '?debug=1&net=bc&nosw=1', NAMES = ['سارة', 'حمد'], pads = [];
const mouse = async (p, type, x, y) => p.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const rect = async (p, sel) => p.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, r.width, r.height, r.x, r.y]})()`);
const tapEl = async (p, sel) => { const r = await rect(p, sel); if (!r) throw new Error('no ' + sel); await mouse(p, 'mousePressed', r[0], r[1]); await sleep(40); await mouse(p, 'mouseReleased', r[0], r[1]); await sleep(80); };
async function openPad(url, i) {
  const p = await c.tab('about:blank');
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await p.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await p.nav(url, 1500);
  await until(() => p.ev(`!!document.getElementById('padGo')`), 8000);
  await p.ev(`document.querySelector('.pname').value=${JSON.stringify(NAMES[i])}`);
  await tapEl(p, `.pch:nth-child(${i + 1})`); await tapEl(p, '#padGo');
  return p;
}
const host = () => c.ev('Pads.state()');
const ps = (p) => p.ev('PadApp.state()');
const endText = async () => { const d = (await c.ev(`__engine.events.filter(e=>e.n==='end').map(e=>e.d)`)).pop(); try { return JSON.parse(d.text); } catch { return null; } };
try {
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await c.nav(BASE + '/index.html' + Q, 1500);
  const ex0 = await exfilCount();
  // ---------- (أ) بيانات الفلاتر ----------
  await until(() => c.ev(`(__engine.menuGames||[]).length>=10`), 8000);
  const idx = readFileSync(new URL('../games/index.txt', import.meta.url), 'utf8').split('\n').map(s => s.trim()).filter(s => /^[\w.-]+\.js$/.test(s) && !s.startsWith('zz-'));
  const heads = idx.map(n => ({ n, h: Object.fromEntries(readFileSync(new URL('../games/' + n, import.meta.url), 'utf8').split('\n', 40).map(l => /^\/\/\s*@([\w-]+)\s*(.*)$/.exec(l.trim())).filter(Boolean).map(m => [m[1], m[2].trim()])) }));
  const missing = heads.filter(x => !['players', 'minutes', 'age', 'play', 'style'].every(k => x.h[k])).map(x => x.n);
  ok('every listed game declares @players @minutes @age @play @style', missing.length === 0, missing);
  const mg = await c.ev(`__engine.menuGames`);
  const bad = mg.filter(g => !g.src.includes('/zz-') && !(g.meta.players && g.meta.minutes && g.meta.age && ['camera', 'pads', 'device'].includes(g.meta.play) && g.meta.style.length));
  ok('engine parses the metadata of every menu game (E.menuGames)', mg.length >= idx.length && bad.length === 0, bad.map(g => g.src));
  const padSrc = heads.filter(x => /players\.pads/.test(x.h.capabilities)).map(x => 'games/' + x.n);
  ok('@play matches capabilities (pad games → pads, camera games → camera)', mg.every(g => (g.meta.play === 'pads') === padSrc.includes(g.src)) && mg.filter(g => g.meta.play === 'camera').every(g => /camera\./.test(heads.find(x => 'games/' + x.n === g.src).h.capabilities)), mg.map(g => g.src + ':' + g.meta.play));
  const ds = await c.ev(`[...document.querySelectorAll('#list .card[data-play]:not([data-src*="/zz-"])')].map(b=>[b.dataset.play,b.dataset.players,b.dataset.minutes,b.dataset.age,b.dataset.style])`);
  ok('menu cards carry data-play/players/minutes/age/style for filters', ds.length >= idx.length && ds.every(d => d[0] && /^\d+-\d+$/.test(d[1]) && /^\d+$/.test(d[2]) && /^\d+$/.test(d[3]) && d[4]), ds.slice(0, 3));
  const mm = await c.ev(`(()=>{const P=t=>__engine.meta(__engine.parseHeader(t));
    return [P('// @players 2-4\\n// @minutes 3\\n// @age 5\\n// @play camera\\n// @style coop calm'), P('// @capabilities players.pads\\n// @pads 2-6 free'), P('// @capabilities camera.motion\\n// @players 0-99\\n// @age x\\n// @style loud versus'), P('// @capabilities motion.device\\n// @play tv')]})()`);
  ok('meta(): explicit values, derived @play/@players, invalid → null or dropped', JSON.stringify(mm) === JSON.stringify([
    { players: [2, 4], minutes: 3, age: 5, play: 'camera', style: ['coop', 'calm'] }, { players: [2, 6], minutes: null, age: null, play: 'pads', style: [] },
    { players: null, minutes: null, age: null, play: 'camera', style: ['versus'] }, { players: null, minutes: null, age: null, play: 'device', style: [] }]), mm);
  { let out = ''; try { out = execFileSync('node', ['tools/check-game.mjs', ...idx.map(n => 'games/' + n)], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }); } catch (e) { out = e.stdout + ''; }
    ok('check-game: no metadata warnings or errors on listed games', !/@(players|minutes|age|play|style)/.test(out), out.split('\n').filter(l => /@(players|minutes|age|play|style)/.test(l)).slice(0, 4));
    let o2 = ''; writeFileSync(`${tmpdir()}/cg-meta.js`, '// @title t\n// @capabilities hud\n// @play tv\n// @style loud\n// @players 5-2\ndefineGame({init(a){a.ui;}});\n');
    try { o2 = execFileSync('node', ['tools/check-game.mjs', `${tmpdir()}/cg-meta.js`], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }); } catch (e) { o2 = e.stdout + ''; }
    ok('check-game: rejects unknown @play/@style and bad @players, warns missing @minutes/@age', /خطأ.*@play/.test(o2) && /خطأ.*@style/.test(o2) && /خطأ.*@players/.test(o2) && /تنبيه.*@minutes/.test(o2) && /تنبيه.*@age/.test(o2), o2.split('\n').slice(0, 8)); }
  // ---------- (ب) شاشة الاختيار ----------
  await c.ev(`document.getElementById('tvBtn').click()`); await sleep(800);
  let st = await host();
  for (let i = 0; i < 2; i++) pads.push(await openPad(st.url, i));
  await until(async () => (await host()).pads.filter(p => p.connected).length === 2, 8000);
  await c.ev(`Pads._play('tests/games/pad-choice-probe.js')`);
  ok('probe ready', !!(await until(() => c.ev(`(()=>{const s=__engine.state(); return !!s&&s.ready&&s.frames>5})()`), 10000)));
  ok('both phones show 4 choice buttons', !!(await until(async () => (await Promise.all(pads.map(p => p.ev(`document.querySelectorAll('.pchc').length`)))).every(n => n === 4), 5000)));
  const look = await pads[0].ev(`(()=>{const b=[...document.querySelectorAll('.pchc')].map(e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e); return {w:r.width,h:r.height,fs:parseFloat(cs.fontSize),t:e.textContent,svg:!!e.querySelector('svg.pchs')}});
    return {b, q:(document.querySelector('.pchq')||{}).textContent, dir:getComputedStyle(document.querySelector('.pchq')).direction, over:document.documentElement.scrollWidth>innerWidth}})()`);
  ok('choice buttons ≥48px targets, text ≥24px, prompt shown RTL, no horizontal overflow', look.b.every(b => b.w >= 48 && b.h >= 48 && b.fs >= 24) && look.q === '7 × 6 = ؟' && look.dir === 'rtl' && !look.over, look);
  ok('text with Western digits and emoji kept as given; shape drawn when asked', look.b.map(b => b.t).join() === '42,36,48,🍎' && look.b.slice(0, 3).every(b => b.svg) && !look.b[3].svg, look.b.map(b => b.t));
  await shot(pads[0], 'phone-choices');
  await tapEl(pads[0], '#padCh0'); await tapEl(pads[0], '#padCh1'); // الثانية تُتجاهل: الشاشة مقفلة
  const lk = await pads[0].ev(`[...document.querySelectorAll('.pchc')].map(e=>e.className.includes(' on')?'on':e.className.includes(' off')?'off':'-').join()`);
  ok('choice locks after the first tap (chosen highlighted, others dimmed)', lk === 'on,off,off,off' && (await ps(pads[0])).screen.picked === 0, lk);
  await shot(pads[0], 'phone-choice-locked');
  await pads[1].send('Page.reload'); await sleep(300);
  ok('reloaded phone comes back to the same choice screen (unlocked)', !!(await until(async () => { const s = await ps(pads[1]); return s && s.view === 'ctl' && s.screen && s.screen.k === 'choice' && s.screen.picked === -1 && (await pads[1].ev(`document.querySelectorAll('.pchc').length`)) === 4; }, 8000)));
  await sleep(200); await tapEl(pads[1], '#padCh2');
  // ---------- (ج) اللمس والمصباح ----------
  ok('game cleared phone 1 → joystick/buttons again', !!(await until(() => pads[1].ev(`!!document.getElementById('padBtnA') && !document.querySelector('.pchc')`), 5000)));
  ok('phone 0 switched to the dark flashlight screen', !!(await until(() => pads[0].ev(`!!document.querySelector('#padTouch.dark canvas')`), 5000)));
  const z = await rect(pads[0], '#padTouch'); const P = (fx, fy) => [z[4] + fx * z[2], z[5] + fy * z[3]];
  let [x, y] = P(0.2, 0.5); await mouse(pads[0], 'mousePressed', x, y); await sleep(60);
  const t0 = Date.now(); [x, y] = P(0.45, 0.55); await mouse(pads[0], 'mouseMoved', x, y);
  const seen = await until(async () => /^fd0\.4[3-7],0\.5[3-7]$/.test(await c.ev(`document.getElementById('hScore').textContent`)), 3000); const lat = Date.now() - t0;
  ok('finger position reaches the game (normalised x,y, finger down)', !!seen, { hud: await c.ev(`document.getElementById('hScore').textContent`), ms: lat });
  console.log('     finger → game latency over BroadcastChannel ≈ ' + lat + ' ms (includes test polling 100ms)');
  await shot(pads[0], 'phone-flashlight'); await shot(c, 'tv-flashlight');
  // سحب سريع: 40 حركة في ~0.4ث — يجب ألا يتجاوز الإرسال ≈30/ث
  await pads[0].ev(`(()=>{ if(!window.__nIn){ const o=BroadcastChannel.prototype.postMessage; BroadcastChannel.prototype.postMessage=function(d){ if(d&&d.d&&d.d.t==='in') window.__nIn++; return o.call(this,d); }; } window.__nIn=0; window.__t0=performance.now(); })()`);
  for (let k = 0; k < 40; k++) { [x, y] = P(0.45 + k * 0.005, 0.55 - k * 0.006); await mouse(pads[0], 'mouseMoved', x, y); }
  const rate = await pads[0].ev(`({n:window.__nIn, ms:performance.now()-window.__t0})`);
  ok('finger stream is rate-limited (≈30/s at most) during a fast drag', rate.n >= 2 && rate.n <= Math.ceil(rate.ms / 30) + 2, rate);
  await mouse(pads[0], 'mouseReleased', x, y);
  ok('finger up reaches the game', !!(await until(async () => /^fu/.test(await c.ev(`document.getElementById('hScore').textContent`)), 3000)));
  // العثور: الإصبع على النجمة (0.8، 0.25)
  [x, y] = P(0.3, 0.3); await mouse(pads[0], 'mousePressed', x, y); for (let k = 1; k <= 8; k++) { [x, y] = P(0.3 + k * 0.0625, 0.3 - k * 0.00625); await mouse(pads[0], 'mouseMoved', x, y); await sleep(35); }
  await sleep(150); await mouse(pads[0], 'mouseReleased', x, y);
  const end = await until(async () => (await host()).last, 6000), pr = await endText();
  ok('game got each choice once, with id and the phone-measured time', pr && pr.picks.length === 2 && pr.picks[0].index === 0 && pr.picks[0].choice === 0 && pr.picks[0].id === 11 && pr.picks[0].ms > 0 && pr.picks[1].index === 1 && pr.picks[1].choice === 2, pr && pr.picks);
  ok('api.pads.input(i).choice holds the locked choice', pr && pr.choiceIn[0] === 0 && pr.choiceIn[1] === 2, pr && pr.choiceIn);
  ok('flashlight find reported once (goal item only) with the touch screen id', pr && pr.finds.length === 1 && pr.finds[0].item === 0 && pr.finds[0].index === 0 && pr.finds[0].id === 21, pr && pr.finds);
  ok('input(i) exposes choice/choiceMs/finger/fx/fy beside the old fields', pr && pr.keys === 'a,aDown,aTaps,b,bDown,bTaps,choice,choiceMs,connected,finger,fx,fy,tx,ty,x,y', pr && pr.keys);
  ok('finger strokes counted (down/up) and x tracked', pr && pr.downs >= 2 && pr.maxFx > 0.7, pr && { downs: pr.downs, maxFx: pr.maxFx });
  ok('choices()/touch() return the screen id', pr && JSON.stringify(pr.ids) === '[11,21]', pr && pr.ids);
  ok('result reached the phones', !!(await until(() => pads[0].ev(`PadApp.state().view==='result'`), 4000)));
  // ---------- (د) مثال ENGINE.md §3.4.1 ----------
  { const ex = readFileSync(new URL('./games/pad-choice-example.js', import.meta.url), 'utf8');
    ok('ENGINE.md §3.4.1 embeds the tested choice example verbatim', readFileSync(new URL('../ENGINE.md', import.meta.url), 'utf8').includes(ex.trim())); }
  await c.ev(`Pads._play('tests/games/pad-choice-example.js')`);
  const ans = [[1, 0], [0, 1], [2, 0]]; // [صحيح، خطأ]
  for (let r = 0; r < 3; r++) {
    await until(async () => (await Promise.all(pads.map(p => p.ev(`(PadApp.state().screen||{}).picked===-1 && document.querySelectorAll('.pchc').length===3 && document.querySelector('.pchc').textContent===${JSON.stringify(String([[3, 8, 5], [9, 2, 4], [1, 6, 7]][r][0]))}`)))).every(Boolean), 5000);
    await tapEl(pads[1], '#padCh' + ans[r][1]); await sleep(60); await tapEl(pads[0], '#padCh' + ans[r][0]);
  }
  const e3 = await until(async () => { const l = (await host()).last; return l && l.rows.length === 2 ? l : null; }, 6000);
  ok('choice example plays 3 rounds: right answers score, wrong ones do not', e3 && e3.rows.find(r => r.index === 0).score === 3 && e3.rows.find(r => r.index === 1).score === 0, e3 && e3.rows);
  ok('no network reached from the games (exfil counter unchanged)', (await exfilCount()) === ex0);
  const errs = [...c.log, ...pads.flatMap(p => p.log)].filter(l => l.startsWith('exception'));
  ok('no page exceptions on TV or phones', errs.length === 0, errs.slice(0, 3));
  ok('no violations/game errors on the host', !(await c.ev(`__engine.events.some(e=>e.n==='violation'||e.n==='game-error')`)), await c.ev(`__engine.events.filter(e=>e.n==='violation'||e.n==='game-error').map(e=>e.d)`));
} catch (e) { fails++; total++; console.log('FAIL ERR', e.stack || e.message); }
finally { c.close(); console.log(`\n${total - fails}/${total} passed`); process.exit(fails ? 1 : 0); }
