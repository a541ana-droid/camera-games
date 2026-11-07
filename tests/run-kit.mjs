// عُدّة الواجهة api.ui: (1) كل المساعدات ترسم بلا انتهاكات وضمن الميزانية وبلا أي قدرة، (2) فحوص الدوال الصغيرة من داخل Worker،
// (3) عمر العدّ التنازلي والنقاط الطافية والوميض والإلغاء، (4) ألعاب العُدّة وحدها تُرسَم متطابقة بين تشغيلين، (5) الألعاب الست تستعملها وبلا أخطاء.
// الاستعمال: BASE=http://127.0.0.1:8482 CDP_PORT=9382 node tests/run-kit.mjs
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome({ size: '430,880' }); let fails = 0;
const ok = (n, cond, i) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i)); };
const tap = async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(250); };
const open = async (g, wait = 1500) => { await c.ev(`__engine.stopGame('exit'); __engine.events.length=0`); await sleep(200); await c.ev(`__engine.startGame('${g}')`); await sleep(wait); };
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await c.ev(`document.getElementById('synth').checked=true`);
  // (1)+(2) لعبة بلا قدرات تستعمل كل شيء وتنهي بنتيجة
  await open('tests/games/kit-probe.js', 1200);
  let end = null; for (let i = 0; i < 40 && !end; i++) { await sleep(250); end = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`); }
  const r = end ? JSON.parse(end.text) : null;
  ok('probe (zero capabilities) finished via api.end', !!r, end);
  ok('self-checks (num/hit/row/frozen theme/accent from header/players)', r && Array.isArray(r.checks) && r.checks.length === 0, r && r.checks);
  ok('countdown 3 lasts ≈2.1s then onDone fires (counting false after)', r && r.cd > 1.9 && r.cd < 2.5 && r.counting === false, r);
  const KIT = JSON.parse(/const KIT = (\[[^\]]*\])/.exec(readFileSync(new URL('../tools/check-game.mjs', import.meta.url), 'utf8'))[1].replace(/'/g, '"'));
  ok('check-game.mjs knows exactly the real api.ui keys (no drift)', r && JSON.stringify([...KIT].sort()) === JSON.stringify(r.keys), { checker: [...KIT].sort(), real: r && r.keys });
  const chk = f => spawnSync('node', ['tools/check-game.mjs', f], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  ok('check-game.mjs: kit games pass with no false errors, a misspelled ui.* helper is an error', ['games/color-hunt.js', 'games/multi-lane.js', 'tests/games/kit-demo.js', 'tests/games/kit-probe.js', 'tests/games/kit-example.js'].every(f => chk(f).status === 0) && chk('tests/games/kit-typo.js').status === 1, null);
  { // 0.5.2: الشخصيات أُزيلت من العُدّة؛ لعبة قديمة تستدعيها يرفضها المحقّق باسم الدالة (الاسم مبنيّ هنا كي لا يبقى في المستودع)
    const { writeFileSync, mkdtempSync } = await import('node:fs'), { tmpdir } = await import('node:os'), old = 'mas' + 'cot', f = mkdtempSync(tmpdir() + '/kit-') + '/old.js';
    writeFileSync(f, "// @title old\n// @engine 0.5\n// @capabilities hud\nlet ui; defineGame({ init(a) { ui = a.ui; }, update() {}, render(c) { ui.background(c); ui." + old + "(c, 0, 50, 50, 40, {}); ui.draw(c); } });\n");
    const o = chk(f); ok('check-game.mjs: the removed character helper (ui.' + old + ') is an unknown-name error', o.status !== 0 && o.stdout.includes('ui.' + old), o.stdout.slice(0, 300)); }
  const hb = await c.ev(`(()=>{const h=__engine.events.filter(e=>e.n==='hb').map(e=>e.d); const s=__engine.state(); return {hb:h, viol:s?s.viol:'(ended)', errs:Draw.stats().errs, ev:__engine.events.filter(e=>/violation|error|cmd-overflow|over-budget|slow/.test(e.n)).map(e=>e.n+':'+JSON.stringify(e.d)).slice(0,5)}})()`);
  const worst = Math.max(0, ...hb.hb.map(h => h.max)), avg = hb.hb.length ? hb.hb.reduce((a, h) => a + h.avg, 0) / hb.hb.length : 99, cmds = Math.max(0, ...hb.hb.map(h => h.cmds)), over = hb.hb.reduce((a, h) => a + h.over, 0);
  ok('all helpers drawn every frame: no violations, no draw errors, no cmd overflow', hb.errs === 0 && !hb.ev.length && hb.hb.length > 0, hb);
  ok('frame budget: avg < 3ms, none over 8ms in avg, max < 16ms; commands < 3000 of 24000', avg < 3 && over === 0 && worst < 16 && cmds < 3000, { avg: +avg.toFixed(2), worst, over, cmds });
  // (3) عمر العدّ والنقاط والوميض: عدد الأوامر المرسومة في كل إطار يكشف وجود شيء طافٍ
  await open('tests/games/kit-life.js', 300);
  const tl = await c.ev(`new Promise(res=>{const out=[], t0=performance.now(); const f=()=>{const s=__engine.state(), now=performance.now(); out.push([now, s?s.cmdN:-1, (document.getElementById('hTitle').textContent||'').split('|')[1]]); if(now-t0>8000) res(out); else requestAnimationFrame(f)}; requestAnimationFrame(f)})`);
  // تُحوَّل السلسلة إلى مقاطع «شيء مرسوم / لا شيء»؛ الجدول: مضى 0.5 ث (فراغ) ← نقطة ≈0.95 ← وميض ≈0.25 ← عدّ ≈2.0 ← نقطة تُلغى بعد ≈0.2 ← فراغ
  const runs = []; for (const p of tl) { const on = p[1] > 0; if (!runs.length || runs[runs.length - 1].on !== on) runs.push({ on, t0: p[0], t1: p[0] }); runs[runs.length - 1].t1 = p[0]; }
  const dur = runs.filter(r => r.on).map(r => +((r.t1 - r.t0) / 1000).toFixed(2)), between = (v, a, b) => v >= a && v <= b;
  console.log('drawn segments (s):', JSON.stringify(dur), 'of', runs.length, 'runs');
  ok('idle first: ui.draw draws nothing before anything starts', !runs[0].on && (runs[1].t0 - runs[0].t0) > 100, runs.slice(0, 2));
  ok('exactly 4 floating things appeared: pop, flash, countdown, cancelled pop', dur.length === 4, dur);
  ok('pop lives ≈0.95s then vanishes', between(dur[0], 0.8, 1.15), dur[0]);
  ok('flash lives ≈0.25s', between(dur[1], 0.12, 0.45), dur[1]);
  ok('countdown(2) drawn ≈2s (2 steps of 0.7s + 0.6s «انطلق»)', between(dur[2], 1.8, 2.25), dur[2]);
  ok('cancel(): a pop cancelled after 0.2s disappears at once (not 0.95s)', between(dur[3], 0.05, 0.4), dur[3]);
  ok('countdown onDone fired exactly once', tl[tl.length - 1][2] === '1', tl[tl.length - 1]);
  // (3b) الشرح القصير قبل اللعب (0.5.1): أول عدّ في لعبة لها @howto يصير مشهدًا ≈3.5ث، والثاني أرقامًا عادية؛ onDone مرة واحدة لكلٍّ؛ الإعداد مطفأ ⇒ الأرقام القديمة
  const howRun = async () => {
    await open('tests/games/howto-probe.js', 0); const cm = [];
    for (let i = 0; i < 70; i++) { await sleep(100); const s = await c.ev(`(()=>{const s=__engine.state(); return s&&s.ready?s.cmdN:-1})()`); if (s >= 0) cm.push(s); if (cm.length === 12) break; }
    let end = null; for (let i = 0; i < 60 && !end; i++) { await sleep(200); end = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`); }
    const errs = await c.ev(`(()=>{const s=__engine.state(); return {viol:s?s.viol:0, draw:Draw.stats().errs, ev:__engine.events.filter(e=>/violation|error|cmd-overflow/.test(e.n)).map(e=>e.n)}})()`);
    return { r: end ? JSON.parse(end.text) : null, peak: Math.max(0, ...cm), errs };
  };
  const hw = await howRun();
  ok('howto: first countdown plays the explainer (≈3.5s) and onDone fires once at «انطلق!»', hw.r && hw.r.n1 === 1 && hw.r.d1 > 3.3 && hw.r.d1 < 3.9 && hw.r.mid === true, hw.r);
  ok('howto: the next countdown in the same run is the plain 3-2-1 (≈2.1s), onDone once', hw.r && hw.r.n2 === 1 && hw.r.d2 > 1.9 && hw.r.d2 < 2.5, hw.r);
  ok('howto: explainer is actually drawn (player shapes + hands + card: ≥100 commands/frame) with no violations, draw errors or overflow, within 3000', hw.peak >= 100 && hw.peak < 3000 && hw.errs.viol === 0 && hw.errs.draw === 0 && !hw.errs.ev.length, { peak: hw.peak, ...hw.errs });
  ok('settings panel has «شرح قصير قبل كل لعبة», on by default', await c.ev(`(()=>{const e=document.getElementById('howto'); return !!e && e.checked && /شرح قصير قبل كل لعبة/.test(e.parentElement.textContent)})()`));
  await c.ev(`(()=>{const e=document.getElementById('howto'); e.checked=false; e.dispatchEvent(new Event('change'))})()`);
  const hw0 = await howRun();
  ok('howto setting off ⇒ plain countdown (≈2.1s), onDone once, few commands', hw0.r && hw0.r.n1 === 1 && hw0.r.d1 > 1.9 && hw0.r.d1 < 2.5 && hw0.r.mid === false && hw0.peak < 120, { r: hw0.r, peak: hw0.peak });
  ok('howto setting persisted like the other settings (localStorage engine-howto)', await c.ev(`localStorage.getItem('engine-howto')`) === '0');
  await c.ev(`(()=>{const e=document.getElementById('howto'); e.checked=true; e.dispatchEvent(new Event('change'))})()`);
  const RTA = JSON.parse(/const ACTS = (\[[^\]]*\])/.exec(readFileSync(new URL('../runtime.js', import.meta.url), 'utf8'))[1].replace(/'/g, '"')), CHA = JSON.parse(/const HOWACTS = (\[[^\]]*\])/.exec(readFileSync(new URL('../tools/check-game.mjs', import.meta.url), 'utf8'))[1].replace(/'/g, '"'));
  const MD = readFileSync(new URL('../ENGINE.md', import.meta.url), 'utf8');
  ok('@howto-act: runtime ACTS = check-game HOWACTS = ENGINE.md table (no drift)', JSON.stringify([...RTA].sort()) === JSON.stringify([...CHA].sort()) && RTA.every(a => MD.includes('| `' + a + '` |')), { RTA, CHA });
  const idx = readFileSync(new URL('../games/index.txt', import.meta.url), 'utf8').split('\n').map(x => x.trim()).filter(x => x.endsWith('.js') && !x.startsWith('zz-'));
  const noHow = idx.filter(g => { const t = readFileSync(new URL('../games/' + g, import.meta.url), 'utf8'), h = /^\/\/ @howto (.+)$/m.exec(t), a = /^\/\/ @howto-act (\S+)$/m.exec(t); return !h || [...h[1].trim()].length > 40 || !a || !RTA.includes(a[1]) || !/countdown\s*\(/.test(t); });
  ok('every listed game has @howto (≤40 chars) + a known @howto-act and uses ui.countdown', idx.length >= 12 && !noHow.length, { games: idx.length, noHow });
  // (4) تطابق التشغيلين بكسلًا ببكسل في كل مشهد من العرض الساكن
  const grab = async () => { const out = []; await open('tests/games/kit-demo.js', 1500); for (let k = 0; k < 3; k++) { await sleep(350); out.push(await c.ev(`document.getElementById('cv').toDataURL('image/png')`)); await tap(215, 400); } return out; };
  const A = await grab(), B = await grab();
  ok('static kit game renders identical frames across two runs (widgets / title / results)', A.every((u, i) => u === B[i]) && new Set(A).size === 3 && A[0].length > 2000, { sizes: A.map(u => u.length), same: A.map((u, i) => u === B[i]) });
  // (4b) مثال ENGINE.md الكامل هو الملف المُختبَر نفسه ويُلعب فعلًا
  const ex = readFileSync(new URL('./games/kit-example.js', import.meta.url), 'utf8').trim();
  ok('ENGINE.md embeds the tested example verbatim (and the §7 template uses api.ui)', readFileSync(new URL('../ENGINE.md', import.meta.url), 'utf8').includes(ex) && /## 7\.[\s\S]*ui = a\.ui[\s\S]*ui\.countdown[\s\S]*ui\.draw\(ctx\)[\s\S]*## 8\./.test(readFileSync(new URL('../ENGINE.md', import.meta.url), 'utf8')), null);
  await open('tests/games/kit-example.js', 1500); const cv = await c.ev(`(()=>{const r=document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]})()`);
  await tap(215, 400); await sleep(3200); for (let i = 0; i < 4; i++) await tap(cv[0] + cv[2] / 2, cv[1] + cv[3] * 0.62 + 45);
  const sc = await c.ev(`document.getElementById('hScore').textContent`); ok('ENGINE.md example: title → countdown → play → taps score (HUD shows Western 0-9 digits)', /^[0-9]+$/.test(sc) && sc !== '0', sc);
  await c.ev(`__engine.stopGame('exit')`);
  // (5) الألعاب الست تحمّل الكاميرا/الحسّاس الاصطناعي وتبدأ وتعرض واجهة العُدّة بلا أخطاء
  await c.nav(BASE + '/index.html?debug=1&sensors=1'); await c.ev(`document.getElementById('synth').checked=true`);
  for (const g of ['color-hunt', 'freeze', 'mole-air', 'multi-lane', 'tilt-balance']) {
    await open('games/' + g + '.js', 1500); const a = await c.ev(`(()=>{const s=__engine.state(); return s?{ready:s.ready,viol:s.viol,frames:s.frames,cmdN:s.cmdN}:null})()`);
    await tap(215, 400); await sleep(700); const b = await c.ev(`(()=>{const s=__engine.state(); return s?{viol:s.viol,cmdN:s.cmdN,err:document.getElementById('ovT').textContent.slice(0,60)}:null})()`);
    ok(g + ': intro and start render with the kit, no violations', a && a.ready && a.viol === 0 && a.cmdN > 20 && b && b.viol === 0 && b.cmdN > 5, { a, b }); }
  ok('games use the kit instead of ad-hoc screens', ['color-hunt', 'freeze', 'mole-air', 'multi-lane', 'tilt-balance'].every(g => /api\.ui\b|ui = a\.ui/.test(readFileSync(new URL('../games/' + g + '.js', import.meta.url), 'utf8'))), null);
  // (6) سباق الحارات يُبلغ بنتيجة كل لاعب: داخل سلسلة من ٣ لاعبين تُحتسب النقاط (الفائز = لاعب الحارة الثالثة)
  await c.nav(BASE + '/index.html?debug=1'); await c.ev(`document.getElementById('synth').checked=true`);
  await c.ev(`DebugSynth.state.blobs=[{c:'#e5484d',x:.17,y:.5,r:.06},{c:'#4cc38a',x:.5,y:.5,r:.06},{c:'#3b82f6',x:.83,y:.5,r:.13,ax:.12,ay:.05,hz:3}]; Series.start({names:['أ','ب','ج'],games:['games/multi-lane.js'],rounds:1})`); await sleep(500);
  await c.ev(`[...document.querySelectorAll('#ser button')].find(b=>b.textContent.includes('ابدأ ▶')).click()`); await sleep(2500);
  const cr = await c.ev(`(()=>{const r=document.getElementById('cv').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]})()`); await tap(cr[0] + cr[2] / 2, cr[1] + cr[3] * 0.66 + 28);
  let ph = null; for (let i = 0; i < 80 && ph !== 'standings'; i++) { await sleep(500); ph = await c.ev('Series.phase()'); }
  const sr = await c.ev('Series.state()'), lg = sr.log && sr.log[0];
  ok('multi-lane in a 3-player series reports per-player results: lane-3 player wins 3 points, others fewer', ph === 'standings' && lg && lg.pts && lg.pts[2] === 3 && lg.pts[0] < 3 && lg.pts[1] < 3 && lg.scores[2] > lg.scores[0] && lg.scores[2] > lg.scores[1], lg);
  console.log(JSON.stringify({ pageErrors: c.log.filter(l => l.startsWith('exception')) }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
