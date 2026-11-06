// سلسلة الألعاب: النقاط، الأدوار، التعطل/الخروج، التحقق المضيفي من نتائج اللعبة، وواجهة الإعداد. فيديو اصطناعي (?debug=1) وألعاب صغيرة من tests/games.
import { writeFileSync, mkdirSync } from 'node:fs';
import { chrome, BASE, sleep } from './lib.mjs';
const SHOTS = process.env.SHOTS || new URL('./shots', import.meta.url).pathname; mkdirSync(SHOTS, { recursive: true });
const c = await chrome(); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
const raw = (type, x, y) => c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
const clickAt = async (x, y) => { await raw('mousePressed', x, y); await raw('mouseReleased', x, y); await sleep(120); };
const clickTxt = async t => { const p = await c.ev(`(()=>{const b=[...document.querySelectorAll('#menu button, #ser button, #stage button')].filter(b=>b.offsetParent&&b.textContent.includes(${JSON.stringify(t)}))[0]; if(!b) return null; b.scrollIntoView(); const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()`); if (!p) throw new Error('no button ' + t); await clickAt(...p); };
const phase = () => c.ev('Series.phase()'), S = () => c.ev('Series.state()');
const waitPh = async (p, ms = 15000) => { for (let i = 0; i < ms / 100; i++) { if ((await phase()) === p) return true; await sleep(100); } return false; };
const shot = async n => writeFileSync(SHOTS + '/series-' + n + '.jpg', Buffer.from((await c.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 })).result.data, 'base64'));
const ready = async () => { for (let i = 0; i < 100; i++) { if (await c.ev(`(()=>{const s=__engine.state(); return !!s&&s.ready&&s.frames>3})()`)) return true; await sleep(100); } return false; };
const T = 'tests/games/';
const run = async cfg => { await c.ev(`Series.start(${JSON.stringify(cfg)})`); await sleep(400); };
const playAuto = async () => { await clickTxt('ابدأ ▶'); await waitPh('playing', 3000); };
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await c.ev(`document.getElementById('synth').checked=true`);
  // (1) الوحدات: التنقية والنقاط
  const u = await c.ev(`(()=>{const C=Series._clean, P=Series._points; return {
    p3:P([5,9,1]), tie:P([5,5,1]), none:P([null,4,null]), solo:P([7]), solo0:P([null]),
    clean1:C({scores:[1e30,'a',null,{},5]},3), clean2:C({ranks:[0,99,1.5],scores:[2,1]},3), clean3:C({ranks:[2,1]},3), clean4:C({},2), clean5:C(null,2), clean6:C({scores:'abc',ranks:{}},2), clean7:C({scores:[NaN,Infinity,-Infinity]},3)}})()`);
  ok('points: 3 players → 2/3/1', JSON.stringify(u.p3) === '[2,3,1]', u.p3);
  ok('points: ties share the better placement', JSON.stringify(u.tie) === '[3,3,1]', u.tie);
  ok('points: player without result gets 0; solo gets 1 per finished game', JSON.stringify(u.none) === '[0,3,0]' && JSON.stringify(u.solo) === '[1]' && JSON.stringify(u.solo0) === '[0]', [u.none, u.solo, u.solo0]);
  ok('clean: huge/string/object values sanitised (clamped or dropped)', JSON.stringify(u.clean1) === '[1000000000,null,null]', u.clean1);
  ok('clean: invalid ranks fall back to scores', JSON.stringify(u.clean2) === '[2,1,null]', u.clean2);
  ok('clean: ranks become negative scores, short arrays padded', JSON.stringify(u.clean3) === '[-2,-1,null]', u.clean3);
  ok('clean: nothing / non-arrays / non-finite → null (no result)', u.clean4 === null && u.clean5 === null && u.clean6 === null && u.clean7 === null, [u.clean4, u.clean5, u.clean6, u.clean7]);
  let bad = await c.ev(`Promise.all([{names:[],games:['a.js'],rounds:3},{names:['a'],games:['../x.js'],rounds:3},{names:['a'],games:['games/a.js'],rounds:99},{names:['a','b','c','d','e'],games:['a.js'],rounds:2},null].map(x=>Series.start(x).then(()=>'started',e=>'rejected')))`);
  ok('start() rejects invalid definitions (players, path traversal, rounds, null)', bad.every(x => x === 'rejected'), bad);

  // (2) واجهة الإعداد
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await c.ev(`document.getElementById('synth').checked=true`);
  await clickTxt('دوري'); await waitPh('setup', 5000); await sleep(600);
  const ui = await c.ev(`({games:[...document.querySelectorAll('#ser .card')].map(b=>b.textContent), inputs:document.querySelectorAll('#ser input').length, minBtn:Math.min(...[...document.querySelectorAll('#ser button')].map(b=>b.getBoundingClientRect().height)), rtl:getComputedStyle(document.getElementById('ser')).direction})`);
  ok('setup lists suitable games (test-loop game excluded), RTL, touch targets ≥48px', ui.games.length >= 3 && !ui.games.some(t => t.includes('حلقة')) && ui.rtl === 'rtl' && ui.minBtn >= 48, ui);
  await shot('setup');
  await clickTxt('٣'); await sleep(200); // مبدئيًا أول «٣» في شريط اللاعبين
  ok('choosing 3 players shows 3 name inputs', (await c.ev(`document.querySelectorAll('#ser input').length`)) === 3, null);
  // اترك لعبة واحدة فقط (الأولى): ألغِ الباقي
  const n0 = ui.games.length; for (let i = 1; i < n0; i++) { await c.ev(`document.querySelectorAll('#ser .card')[${i}].click()`); await sleep(60); }
  await c.ev(`(()=>{const i=document.querySelectorAll('#ser input'); i[0].value='سالم'; i[0].dispatchEvent(new Event('input'))})()`);
  await clickTxt('ابدأ السلسلة'); await waitPh('prep', 5000); await sleep(300);
  const st0 = await S();
  ok('UI start → first game prep with custom name, 5 rounds default', st0 && st0.names[0] === 'سالم' && st0.names.length === 3 && st0.n === 5, st0);
  await playAuto(); await ready(); await clickTxt('خروج');
  ok('exit mid-game: series continues (not back to menu), next prep shows reason', await waitPh('prep', 3000) && /خرجتَ/.test(await c.ev(`document.getElementById('ser').textContent`)), await c.ev(`document.getElementById('ser').textContent.slice(0,200)`));
  await shot('prep-after-exit');
  await clickTxt('إنهاء السلسلة'); ok('«end series» → final ranking screen with zero points', (await waitPh('final', 2000)) && (await S()).pts.every(p => p === 0), await S());
  await clickTxt('القائمة'); ok('«menu» returns to the menu', await c.ev(`!document.getElementById('menu').hidden && document.getElementById('ser').hidden`), null);

  // (3) ألعاب جماعية: درجات، رتب، نتيجة قديمة، انهيار
  await run({ names: ['أحمد', 'بدر', 'جاسم'], games: [T + 's-multi.js', T + 's-ranks.js', T + 's-old.js', T + 's-mcrash.js'], rounds: 4 });
  const ends = [];
  for (let g = 0; g < 4; g++) { await playAuto(); if (g === 0) { await ready(); } ok('multi game ' + (g + 1) + ' reaches standings', await waitPh('standings', 8000), await phase()); if (g === 0) { await shot('standings'); ok('no stray "null" text on standings', !(await c.ev(`document.getElementById('ser').textContent`)).includes('null'), null); } if (g < 3) await clickTxt('اللعبة التالية'); }
  const m = await S(); const ev = await c.ev(`__engine.events.filter(e=>e.n==='end').map(e=>e.d.text)`);
  ok('series names override players.local names inside the game', ev[0] === 'names=أحمد,بدر,جاسم', ev);
  ok('game1 scores [5,9,1] → pts [2,3,1]', JSON.stringify(m.log[0].pts) === '[2,3,1]', m.log[0]);
  ok('game2 ranks [3,1,2] → pts [1,3,2]', JSON.stringify(m.log[1].pts) === '[1,3,2]', m.log[1]);
  ok('game3 old-style end (no per-player result) → 0 for all + visible note', JSON.stringify(m.log[2].pts) === '[0,0,0]' && /لم ترسل/.test(m.log[2].note), m.log[2]);
  ok('game4 crash in multi game → 0 for all + reason (boom-multi) shown', JSON.stringify(m.log[3].pts) === '[0,0,0]' && /boom-multi/.test(m.log[3].note) && /boom-multi/.test(await c.ev(`document.getElementById('ser').textContent`)), m.log[3].note);
  ok('cumulative points [3,6,3], series continued after the crash', JSON.stringify(m.pts) === '[3,6,3]', m.pts);
  await clickTxt('النتيجة النهائية'); await waitPh('final', 2000); const f = await S();
  ok('final ranking: بدر, أحمد (higher raw score breaks tie), جاسم', JSON.stringify(f.rank.map(r => f.names[r.i])) === JSON.stringify(['بدر', 'أحمد', 'جاسم']) && JSON.stringify(f.rank.map(r => r.rank)) === '[1,2,3]', f.rank);
  ok('no stray "null" text on final screen', !(await c.ev(`document.getElementById('ser').textContent`)).includes('null'), null);
  await shot('final');

  // (4) لعبة فردية بالتناوب + انهيار دور
  const tapGame = async k => { await ready(); for (let i = 0; i < k; i++) await clickAt(200, 300); };
  await run({ names: ['س', 'ص'], games: [T + 's-solo.js'], rounds: 2 });
  const sc = [[1, 3], [4, 0]];
  for (let g = 0; g < 2; g++) for (let p = 0; p < 2; p++) {
    ok(`turn mode: prep names the current player (game ${g + 1}, ${['س', 'ص'][p]})`, (await c.ev(`document.getElementById('ser').textContent`)).includes('الدور: ' + ['س', 'ص'][p]), null);
    await playAuto(); await tapGame(sc[g][p]); if (p === 0) await waitPh('prep', 8000); else { await waitPh('standings', 8000); if (g === 0) await clickTxt('اللعبة التالية'); }
  }
  const s4 = await S();
  ok('solo-style game: each player plays a turn; scores [[1,3],[4,0]] → pts [3,3]', JSON.stringify(s4.log.map(l => l.scores)) === '[[1,3],[4,0]]' && JSON.stringify(s4.pts) === '[3,3]', s4);
  await clickTxt('النتيجة النهائية'); await waitPh('final', 2000);
  ok('tie on points broken by total raw score (س 5 > ص 3)', (await S()).rank.map(r => r.i).join() === '0,1', (await S()).rank);

  await run({ names: ['س', 'ص'], games: [T + 's-crash.js'], rounds: 1 });
  await playAuto(); await waitPh('prep', 8000); // الأول ينهار بلا لمس
  ok('turn crash: next prep shows the crashed player + reason', /س: توقفت.*boom-solo/.test(await c.ev(`document.getElementById('ser').textContent`)), await c.ev(`document.getElementById('ser').textContent.slice(0,160)`));
  await playAuto(); await tapGame(2); await waitPh('standings', 8000); const s5 = await S();
  ok('crashed turn scores 0 points, the other finisher gets 2', JSON.stringify(s5.log[0].scores) === '[null,2]' && JSON.stringify(s5.pts) === '[0,2]', s5.log[0]);

  // (5) خروج المستخدم وتزوير نتيجة خبيثة
  await run({ names: ['أ', 'ب', 'ج'], games: [T + 's-hold.js'], rounds: 2 });
  await playAuto(); await ready(); await clickTxt('خروج'); ok('user exit in multi game → 0 points, standings with reason', (await waitPh('standings', 3000)) && /خرجتَ/.test((await S()).log[0].note), (await S()).log[0]);
  await clickTxt('اللعبة التالية'); await playAuto(); await ready();
  await c.ev(`__engine.state().port.onmessage({data:{t:'end',score:1e30,scores:[1e30,'a',null,{},5,5,5,5,5],ranks:[0,99,1.5],text:'x'.repeat(3000)}})`);
  await waitPh('standings', 3000); const s6 = await S();
  ok('forged end message: sanitised host-side (1e9 clamp, junk dropped), no crash, others 0', JSON.stringify(s6.log[1].scores) === '[1000000000,null,null]' && JSON.stringify(s6.log[1].pts) === '[3,0,0]', s6.log[1]);
  await clickTxt('النتيجة النهائية'); await waitPh('final', 2000);
  ok('quiet in menu: no timers/raf after leaving series', await (async () => { await clickTxt('القائمة'); await sleep(300); return c.ev(`!__engine.state() && !__engine.cameraOpen() && Series.phase()==='idle'`); })(), null);
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e.stack || e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
