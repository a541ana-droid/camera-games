// وضع التلفاز والأذرع عبر BroadcastChannel (?net=bc، بلا إنترنت): شاشة 1920×1080 + 2–4 جوالات 390×844 في تبويبات المتصفح نفسه.
// يختبر: الردهة والرمز وQR، الانضمام بالاسم واللون/الشكل، وصول العصا والأزرار إلى اللعبة داخل Worker، المغادرة وإعادة الانضمام إلى المقعد نفسه،
// نتيجة الفريقين، بدء القائد من جواله، الخروج إلى الردهة، فرق الدوري للاعبين المحليين، وأن الشبكة لا تصل اللعبة (المسبار لا يرى إلا الحقول المعلنة).
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chrome, BASE, sleep, exfilCount } from './lib.mjs';
const SHOTS = process.env.SHOTS || tmpdir(); mkdirSync(SHOTS, { recursive: true });
let fails = 0, total = 0;
const ok = (n, cond, i) => { total++; if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i === undefined ? '' : i).slice(0, 400)); };
const until = async (f, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await f(); if (v) return v; } catch { } await sleep(150); } return null; };
const shot = async (p, n) => { const s = await p.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${SHOTS}/pads-${n}.png`, Buffer.from(s.result.data, 'base64')); return `${SHOTS}/pads-${n}.png`; };
const c = await chrome({ port: 9480, size: '1920,1080' });
const Q = '?debug=1&net=bc&nosw=1';
const NAMES = ['سارة', 'حمد', 'ريم', 'يوسف'];
const pads = [];
const mouse = async (p, type, x, y) => p.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
const rect = async (p, sel) => p.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:"center"}); const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, r.width, r.height]})()`);
const tapEl = async (p, sel, n = 1) => { const r = await rect(p, sel); if (!r) throw new Error('no ' + sel); for (let i = 0; i < n; i++) { await mouse(p, 'mousePressed', r[0], r[1]); await sleep(40); await mouse(p, 'mouseReleased', r[0], r[1]); await sleep(60); } };
async function openPad(url, i) {
  const p = await c.tab('about:blank');
  await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await p.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await p.nav(url, 1500);
  await until(() => p.ev(`!!document.getElementById('padGo')`), 8000);
  await p.ev(`document.querySelector('.pname').value=${JSON.stringify(NAMES[i])}`);
  await tapEl(p, `.pch:nth-child(${(i % 4) + 1})`); await tapEl(p, '#padGo');
  return p;
}
const host = () => c.ev('Pads.state()');
const hostEvents = n => c.ev(`__engine.events.filter(e=>e.n===${JSON.stringify(n)}).map(e=>e.d)`);
try {
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await c.nav(BASE + '/index.html' + Q, 1500);
  const ex0 = await exfilCount();
  await c.ev(`document.getElementById('tvBtn').click()`); await sleep(800);
  let st = await host();
  ok('lobby opens with a 4-letter room code', st && /^[A-HJ-NP-Z]{4}$/.test(st.code) && st.phase === 'lobby', st && st.code);
  const qrUrl = await until(() => c.ev(`document.querySelector('#tv canvas.qr').dataset.url||''`), 5000);
  ok('QR (local generator) encodes the same site + #pad=CODE', qrUrl === st.url && qrUrl.endsWith('#pad=' + st.code) && qrUrl.startsWith(BASE + '/index.html'), qrUrl);
  ok('QR library loaded from this site only (vendor/qrcode.js)', await c.ev(`[...document.scripts].some(s=>s.src.endsWith('/vendor/qrcode.js')) && typeof qrcode==='function'`));
  const padGames = readFileSync(new URL('../games/index.txt', import.meta.url), 'utf8').split('\n').map(s => s.trim()).filter(n => /\.js$/.test(n) && /@capabilities[^\n]*players\.pads/.test(readFileSync(new URL('../games/' + n, import.meta.url), 'utf8'))).length;
  await until(async () => (await c.ev(`document.querySelectorAll('#tvGames .gcard').length`)) >= padGames, 6000);
  const games = await c.ev(`[...document.querySelectorAll('#tvGames .gcard b')].map(b=>b.textContent)`);
  ok('game picker lists only pad games (' + padGames + ' in index.txt)', games.length === padGames, games);
  // جوالان أولًا ثم اثنان
  for (let i = 0; i < 4; i++) pads.push(await openPad(st.url, i));
  await until(async () => (await host()).pads.filter(p => p.connected).length === 4, 8000);
  st = await host();
  ok('4 pads joined with name, colour/shape pick, colour, index', st.pads.length === 4 && st.pads.every((p, i) => p.name === NAMES[i] && p.colorIndex === i && p.index === i && /^#[0-9a-f]{6}$/.test(p.color)), st.pads);
  const pv = await Promise.all(pads.map(p => p.ev('PadApp.state()')));
  ok('every pad reached its lobby view; only the first is leader', pv.every(v => v.view === 'lobby') && (await pads[0].ev(`!!document.querySelector('.plead')`)) && !(await pads[1].ev(`!!document.querySelector('.plead')`)), pv.map(v => v.view));
  ok('TV lobby shows 4 player cards, each a plain colour shape (svg.psh, no canvas art)', (await c.ev(`[...document.querySelectorAll('#tvPlayers .pcard:not(.empty)')].map(e => e.querySelector('svg.psh') ? e.querySelector('svg.psh').dataset.shape : '-').join()`)) === 'circle,triangle,square,diamond' && (await c.ev(`document.querySelectorAll('#tv canvas:not(.qr)').length`)) === 0);
  await shot(c, 'tv-lobby'); await shot(pads[0], 'phone-lobby-leader'); await shot(pads[1], 'phone-lobby');
  // (1) المسبار: كلٌّ لنفسه
  await c.ev(`Pads._play('tests/games/pad-probe.js')`);
  ok('probe game ready in the worker', !!(await until(() => c.ev(`(()=>{const s=__engine.state(); return !!s&&s.ready&&s.frames>5})()`), 10000)));
  ok('pads switched to controller view', !!(await until(async () => (await Promise.all(pads.map(p => p.ev('PadApp.state().view')))).every(v => v === 'ctl'), 5000)));
  const btnLabel = await until(() => pads[0].ev(`(document.getElementById('padBtnB')||{}).textContent`), 4000);
  ok('game set the pad buttons via api.pads.controls', btnLabel === 'إنهاء', btnLabel);
  ok('game message reached pads (api.pads.say)', !!(await until(() => pads[2].ev(`/مرحبا|اللعبة/.test(document.getElementById('padSay').textContent)`), 3000)));
  await shot(pads[0], 'phone-controller');
  // العصا: سحب من مركز المنطقة إلى اليمين وإبقاؤها
  const sr = await rect(pads[0], '#padStick');
  await mouse(pads[0], 'mousePressed', sr[0], sr[1]); for (let k = 1; k <= 6; k++) { await mouse(pads[0], 'mouseMoved', sr[0] + k * 25, sr[1]); await sleep(30); }
  const hud = await until(async () => { const t = await c.ev(`document.getElementById('hScore').textContent`); return /^x0\.[89]|^x1\.00/.test(t) ? t : null; }, 4000);
  ok('joystick input reaches the game (hud echoes x≈+1)', !!hud, hud);
  await shot(c, 'tv-probe');
  await mouse(pads[0], 'mouseReleased', sr[0] + 150, sr[1]);
  ok('joystick release returns x to 0', !!(await until(async () => /^x0\.00/.test(await c.ev(`document.getElementById('hScore').textContent`)), 3000)));
  for (let i = 0; i < 4; i++) await tapEl(pads[i], '#padBtnA', i + 1);
  // المغادرة وإعادة الانضمام: يُغلق الجوال 4 تمامًا، ويُعاد تحميل الجوال 3 (المعرّف في sessionStorage ⇒ المقعد نفسه)
  await pads[3].close();
  ok('closed pad marked disconnected (leave)', !!(await until(async () => (await host()).pads[3].connected === false, 6000)));
  await pads[2].send('Page.reload'); await sleep(400);
  ok('reloaded pad left and came back to the same seat (index 2) mid-game', !!(await until(async () => { const j = await hostEvents('pad-join'); return j.filter(x => x.index === 2).length >= 2 && (await host()).pads[2].connected; }, 8000)), await hostEvents('pad-join'));
  ok('rejoined pad resumes the controller automatically', !!(await until(() => pads[2].ev(`PadApp.state()&&PadApp.state().view==='ctl'`), 6000)));
  await sleep(300); await tapEl(pads[2], '#padBtnA', 2);
  await sleep(400); await tapEl(pads[0], '#padBtnB');
  const end1 = await until(async () => (await host()).last, 6000);
  const d1 = (await hostEvents('end'))[0]; let probe = {}; try { probe = JSON.parse(d1.text); } catch { }
  ok('button taps counted per pad (edge counters, none lost)', probe.taps && probe.taps[0] === 1 && probe.taps[1] === 2 && probe.taps[2] === 5 && probe.taps[3] === 4, probe.taps);
  ok('join/leave events delivered to the game', probe.leaves >= 2 && probe.joins >= 1 && probe.maxX[0] > 0.8, { joins: probe.joins, leaves: probe.leaves, maxX: probe.maxX });
  ok('game sees only the declared pad fields (no peer ids, no network objects)', Array.isArray(probe.list) && probe.list.every(p => Object.keys(p).sort().join() === 'color,colorIndex,connected,index,name,team'), probe.list && probe.list[0]);
  ok('no character art in the kit (ui / ui.theme); free mode → api.teams off', probe.kitNoArt === true && probe.teamsOn === false && probe.mode === 'free', probe);
  ok('results screen ranks the pads (rank 1 = most taps)', end1 && !end1.team && end1.rows.find(r => r.index === 2).rank === 1, end1 && end1.rows);
  ok('pads show their result (winner cheers)', !!(await until(() => pads[2].ev(`PadApp.state().view==='result' && /فزت/.test(document.body.textContent)`), 4000)));
  await shot(c, 'tv-result-free'); await shot(pads[2], 'phone-result');
  // (2) فريقان: القائد يعود للردهة من جواله، ويختار «فريقان» من الشاشة
  await tapEl(pads[0], '.pbox button.big'); // «الردهة» على جوال القائد
  ok('leader pad brings everyone back to the lobby', !!(await until(async () => (await host()).phase === 'lobby', 4000)));
  await c.ev(`[...document.querySelectorAll('#tvModes button')].find(b=>b.querySelector('b').textContent==='فريقان').click()`); await sleep(300);
  st = await host();
  ok('teams mode assigns A/B alternately to connected pads', st.mode === 'teams' && st.pads.filter(p => p.connected).map(p => p.team).join() === '0,1,0', st.pads.map(p => [p.index, p.team, p.connected]));
  await c.ev(`Pads._play('tests/games/pad-probe.js')`);
  await until(async () => (await Promise.all([0, 1, 2].map(i => pads[i].ev('PadApp.state().view')))).every(v => v === 'ctl'), 6000);
  await until(async () => (await Promise.all([0, 1, 2].map(i => pads[i].ev(`!!document.getElementById('padBtnB')`)))).every(Boolean), 6000); await sleep(300); // أزرار اللعبة (controls) تصل بعد «play» بقليل؛ على جهاز مشغول قد تتأخر أكثر من 500ms
  await tapEl(pads[0], '#padBtnA', 2); await tapEl(pads[1], '#padBtnA', 1); await tapEl(pads[2], '#padBtnA', 3);
  await sleep(400); await tapEl(pads[0], '#padBtnB');
  const end2 = await until(async () => { const l = (await host()).last; return l && l.team ? l : null; }, 6000);
  const d2 = (await hostEvents('end')).pop(); let probe2 = {}; try { probe2 = JSON.parse(d2.text); } catch { }
  ok('api.teams.of(i) inside the game matches the lobby', JSON.stringify(probe2.teamOf) === JSON.stringify([0, 1, 0, -1]) || JSON.stringify(probe2.teamOf.slice(0, 3)) === '[0,1,0]', probe2.teamOf);
  ok('teamScores → TV team result (A 5 vs B 1, A wins)', end2 && end2.ts[0] === 5 && end2.ts[1] === 1 && end2.winT === 0 && /الفريق أ/.test(end2.title), end2 && { ts: end2.ts, title: end2.title });
  ok('pads of the winning team cheer, others not', !!(await until(async () => (await pads[0].ev(`/فزت/.test(document.body.textContent)`)) && !(await pads[1].ev(`/فزت/.test(document.body.textContent)`)), 4000)));
  await shot(c, 'tv-result-teams');
  // (3) القائد يبدأ لعبة حقيقية من جواله ثم الخروج بـ✕ يعيد الردهة
  await c.ev(`[...document.querySelectorAll('#tv .row button')].find(b=>b.textContent.includes('الردهة')).click()`); await sleep(300);
  await c.ev(`[...document.querySelectorAll('#tvModes button')].find(b=>b.querySelector('b').textContent==='كلٌّ لنفسه').click()`); await sleep(300);
  await until(() => pads[0].ev(`!!document.querySelector('.pstart')&&!document.querySelector('.pstart').disabled`), 4000);
  await tapEl(pads[0], '.pstart');
  ok('leader starts the selected game from the phone', !!(await until(() => c.ev(`(()=>{const s=__engine.state(); return !!s&&s.ready&&s.frames>10&&Pads.state().phase==='playing'})()`), 10000)), await host().then(s => s.game));
  { // الشرح القصير (0.5.1): يظهر على التلفاز (لا أرقام فقط) وتصل جملة @howto نفسها إلى كل جوال
    const g = await c.ev(`Pads.state().game`), src = readFileSync(new URL('../' + (g && g.src || g || 'games/pad-stars.js'), import.meta.url), 'utf8'), how = (/^\/\/ @howto (.+)$/m.exec(src) || [])[1] || '';
    await sleep(600); for (const i of [0, 1, 2]) await tapEl(pads[i], '#padBtnA'); // كلٌّ يضغط «جاهز» فتبدأ اللعبة عدّها ⇒ الشرح
    const seen = await until(() => pads[1].ev(`document.getElementById('padSay').textContent.includes(${JSON.stringify(how.trim())})`), 5000);
    ok('howto text of the started pad game reached the phones', how && !!seen, { game: g, how }); await shot(pads[1], 'phone-howto');
    await sleep(1200); await shot(c, 'tv-howto'); } // لقطة التلفاز منتصف الشرح (رسمه وحدوده يختبرها run-kit)
  const sr2 = await rect(pads[1], '#padStick'); if (sr2) { await mouse(pads[1], 'mousePressed', sr2[0], sr2[1]); await mouse(pads[1], 'mouseMoved', sr2[0], sr2[1] - 80); }
  await sleep(4500); await shot(c, 'tv-game-leader-start'); if (sr2) await mouse(pads[1], 'mouseReleased', sr2[0], sr2[1] - 80);
  await c.ev(`document.getElementById('exit').click()`);
  ok('✕ exit returns the TV to the lobby, pads to lobby view', !!(await until(async () => (await host()).phase === 'lobby' && (await pads[1].ev('PadApp.state().view')) === 'lobby', 4000)));
  // (3b) مثال ENGINE.md §3.4 هو الملف المُختبَر نفسه ويُلعب فعلًا: أول من يضغط عشر مرات يفوز
  { const ex = readFileSync(new URL('./games/pad-example.js', import.meta.url), 'utf8');
    ok('ENGINE.md §3.4 embeds the tested pads example verbatim', readFileSync(new URL('../ENGINE.md', import.meta.url), 'utf8').includes(ex.trim())); }
  await c.ev(`Pads._play('tests/games/pad-example.js')`);
  await until(async () => (await Promise.all([0, 1, 2].map(i => pads[i].ev('PadApp.state().view')))).every(v => v === 'ctl'), 6000); await sleep(500);
  ok('example set a single big button via api.pads.controls', !!(await until(() => pads[1].ev(`(document.getElementById('padBtnA')||{}).textContent==='اضغط!' && !document.getElementById('padBtnB') && !document.getElementById('padStick')`), 4000)));
  await tapEl(pads[0], '#padBtnA', 3); await tapEl(pads[1], '#padBtnA', 10);
  const end3 = await until(async () => { const l = (await host()).last; return l && /حمد/.test(l.title) ? l : null; }, 6000);
  ok('pads example plays to the end: first to 10 wins, scores by seat index', end3 && end3.rows.find(r => r.index === 1).score === 10 && end3.rows.find(r => r.index === 0).score === 3 && end3.rows.find(r => r.index === 1).rank === 1, end3 && end3.rows);
  await c.ev(`[...document.querySelectorAll('#tv .row button')].find(b=>b.textContent.includes('الردهة')).click()`); await sleep(300);
  // (4) الدوري بفريقين للاعبين المحليين (بلا جوالات): متوسط الدرجات، الفائز 2 والخاسر 1
  await c.ev(`Pads.close(); __engine.show('menu')`);
  await c.ev(`Series.start({names:['أ1','ب1','أ2','ب2'], teams:true, games:['tests/games/s-multi.js'], rounds:2})`); await sleep(500);
  for (let r = 0; r < 2; r++) { await c.ev(`[...document.querySelectorAll('#ser button')].find(b=>/^ابدأ/.test(b.textContent.trim())).click()`); await until(() => c.ev(`Series.phase()==='standings'`), 8000); await c.ev(`[...document.querySelectorAll('#ser button')].find(b=>/التالية|النهائية/.test(b.textContent)).click()`); await sleep(300); }
  const ss = await c.ev('Series.state()');
  // s-multi: درجات [5,9,1,1] ⇒ أ = (5+1)/2 = 3، ب = (9+1)/2 = 5 ⇒ ب يفوز كل جولة
  ok('series team mode: team = mean of members, winner 2 / loser 1 per game', ss && JSON.stringify(ss.tpts) === '[2,4]' && JSON.stringify(ss.teamRank) === '[2,1]' && JSON.stringify(ss.log[0].teamScores) === '[3,5]', ss && { tpts: ss.tpts, teamRank: ss.teamRank, ts: ss.log[0].teamScores });
  const tv = await c.ev(`(()=>{const s=__engine.state(); return true})()`);
  ok('no network reached from the probe game (exfil counter unchanged)', (await exfilCount()) === ex0);
  const errs = [...c.log, ...pads.flatMap(p => p.log)].filter(l => l.startsWith('exception'));
  ok('no page exceptions on TV or phones', errs.length === 0, errs.slice(0, 3));
  ok('no violations/game errors on the host', !(await c.ev(`__engine.events.some(e=>e.n==='violation'||e.n==='game-error')`)), await c.ev(`__engine.events.filter(e=>e.n==='violation'||e.n==='game-error').map(e=>e.d)`));
} catch (e) { fails++; total++; console.log('FAIL ERR', e.stack || e.message); }
finally { c.close(); console.log(`\n${total - fails}/${total} passed`); process.exit(fails ? 1 : 0); }
