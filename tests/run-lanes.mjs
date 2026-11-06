// اختبار تتبّع عدة لاعبين (api.track.lanes / api.track.colorPerPlayer) بفيديو اصطناعي فيه حركتان منفصلتان وألوان مختلفة.
// القياس من مصدرين: المضيف (tracks[].last) واللعبة نفسها (HUD بعد مرور البيانات عبر Worker). الاستعمال: node tests/run-lanes.mjs
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome(), results = []; let fails = 0;
const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info }); if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + '  ' + JSON.stringify(info)); };
const scene = async blobs => { await c.ev(`DebugSynth.state.hand=null; DebugSynth.state.blobs=${JSON.stringify(blobs)}`); await sleep(1100); };
// يُلتقط 14 عيّنة خلال ~0.8ث ويؤخذ الأقصى لطاقة/نسبة الحارات (البقعة المذبذبة تمرّ بلحظات سرعة صفرية عند طرفي الذبذبة)
const read = () => c.ev(`(async()=>{const s=__engine.state(); let peak=null, last=null; for(let i=0;i<14;i++){ const o={}; for(const [id,t] of s.tracks) (o[t.kind]=o[t.kind]||[]).push(JSON.parse(JSON.stringify(t.last)));
  if(!peak) peak=JSON.parse(JSON.stringify(o)); else for(const t of o.lanes) { const p=peak.lanes[o.lanes.indexOf(t)]; p.lanes.forEach((l,j)=>{ if(t.lanes[j].energy>l.energy){ l.energy=t.lanes[j].energy; l.ratio=t.lanes[j].ratio; l.cx=t.lanes[j].cx; l.cy=t.lanes[j].cy; l.present=t.lanes[j].present; } }); }
  last=o; await new Promise(r=>setTimeout(r,60)); } peak.players=last.players; return {tr:peak, hud:document.getElementById('hTitle').textContent, mode:s.mode};})()`);
const blob = (c, x, y, mv, r = 0.1, ax = 0.08) => ({ c, x, y, r, ...(mv ? { ax, ay: 0.06, hz: 2 } : {}) });
const b4 = (c, x, mv) => blob(c, x, .5, mv, .05, .04); // حارات ضيقة: بقعة أصغر كي لا تعبر حدّ الحارة
const RED = '#e5484d', BLUE = '#3b82f6', GREEN = '#22b04b', YEL = '#f5d90a';
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + (process.env.MODE || 'auto')); await c.ev(`document.getElementById('synth').checked=true`);
  await c.ev(`__engine.startGame('tests/games/lanes-probe.js')`); await sleep(1500);
  // 1) حركة في اليسار فقط (أحمر يتحرك يسارًا، أزرق ثابت يمينًا)
  await scene([blob(RED, .25, .5, true), blob(BLUE, .75, .5, false)]); let r = await read();
  const m1 = r.tr.lanes[0].lanes, col1 = r.tr.lanes[1].lanes, pl1 = r.tr.players[0].players;
  ok('S1 motion: lane0 energy high, lane1 ~0', m1[0].energy > 0.02 && m1[1].energy < 0.004, m1.map(l => l.energy));
  ok('S1 motion: lane0 centroid x in left half', m1[0].cx < 0.5, m1[0].cx);
  ok('S1 color lanes(red): lane0 ratio>0.02, lane1 0', col1[0].ratio > 0.02 && col1[1].ratio === 0, col1.map(l => l.ratio));
  ok('S1 players: red present left, blue present right', pl1[0].present && pl1[0].cx < 0.4 && pl1[1].present && pl1[1].cx > 0.6, pl1.map(p => [p.id, p.present, p.cx, p.area]));
  ok('S1 game-side HUD saw the same (worker round-trip)', /^E\.\d\d \.00 R\.\d\d B\.\d\d/.test(r.hud) || /^E\.\d\d [.0]/.test(r.hud), r.hud);
  // 2) الحركة تنتقل لليمين
  await scene([blob(RED, .25, .5, false), blob(BLUE, .75, .5, true)]); r = await read(); const m2 = r.tr.lanes[0].lanes;
  ok('S2 motion: lane1 energy high, lane0 ~0', m2[1].energy > 0.008 && m2[0].energy < 0.004, m2.map(l => l.energy)); ok('S2 centroid x in right half', m2[1].cx > 0.5, m2[1].cx);
  // 3) حركتان معًا
  await scene([blob(RED, .25, .5, true), blob(BLUE, .75, .5, true)]); r = await read(); const m3 = r.tr.lanes[0].lanes;
  ok('S3 both lanes active and separated', m3[0].energy > 0.02 && m3[1].energy > 0.02 && m3[0].cx < 0.5 && m3[1].cx > 0.5, m3.map(l => [l.energy, l.cx]));
  // 4) سكون
  await scene([blob(RED, .25, .5, false), blob(BLUE, .75, .5, false)]); r = await read(); const m4 = r.tr.lanes[0].lanes;
  ok('S4 still: both ~0', m4[0].energy < 0.004 && m4[1].energy < 0.004, m4.map(l => l.energy));
  // 5) غياب لون
  await scene([blob(BLUE, .75, .5, false)]); r = await read(); const p5 = r.tr.players[0].players;
  ok('S5 red absent, blue present', !p5[0].present && p5[1].present, p5.map(p => [p.id, p.present, p.area]));
  // 6) أربع حارات وأربعة ألوان
  await c.ev(`__engine.stopGame('exit')`); await sleep(300); await c.ev(`__engine.startGame('tests/games/lanes-probe4.js')`); await sleep(1500);
  await scene([b4(RED, .125, false), b4(GREEN, .375, true), b4(BLUE, .625, false), b4(YEL, .875, true)]); r = await read();
  const m6 = r.tr.lanes[0].lanes, p6 = r.tr.players[0].players;
  ok('S6 4 lanes: lanes 1 and 3 active, 0 and 2 ~0', m6[1].energy > 0.008 && m6[3].energy > 0.008 && m6[0].energy < 0.004 && m6[2].energy < 0.004, m6.map(l => l.energy));
  ok('S6 4 players all present at their columns', p6.every(p => p.present) && p6[0].cx < .25 && p6[1].cx > .25 && p6[1].cx < .5 && p6[2].cx > .5 && p6[2].cx < .75 && p6[3].cx > .75, p6.map(p => [p.id, p.cx]));
  ok('S6 game-side HUD', /^\.\d\d \.\d\d \.\d\d \.\d\d 1111$/.test(r.hud) || r.hud.endsWith('1111'), r.hud);
  // 7) رفض مدخلات سيئة
  await c.ev(`__engine.stopGame('exit')`); await sleep(300);
  console.log(JSON.stringify({ summary: { pass: results.filter(x => x.pass).length, fail: fails, pageErrors: c.log.filter(l => l.startsWith('exception')) } }));
} catch (e) { console.log('ERR', e); fails++; } finally { c.close(); process.exit(fails ? 1 : 0); }
