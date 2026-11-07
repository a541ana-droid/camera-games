// «المصباح الخفي» (games/flashlight.js): تلفاز + جوالان عبر ?net=bc. «جاهز» بالزرّ، ثم شاشة مظلمة على كل جوال: الإصبع مصباح، والنجوم تُبلَّغ مرة لكل واحدة،
// والأشكال الخافتة لا تُحسب، والاهتزاز «حار/بارد» يعمل، ومن يجدها كلها أولًا +3 (الثاني +2)، وكشف في آخر الجولة. ثم فريقان. «قصيرة» ⇒ جولتان، 4 نجوم.
import { padSuite, sleep } from './padgame-lib.mjs';
const S = await padSuite(9603, ['سارة', 'حمد']), { c, pads, ok, until, shot, mouse, rect, tapEl, ps, endEv, scrOf } = S;
async function ready() {
  for (const p of pads) await until(async () => { if ((await p.ev(`(document.getElementById('padBtnA')||{}).textContent`)) !== 'جاهز') return false; await tapEl(p, '#padBtnA'); return true; }, 8000);
}
const dark = i => until(async () => { const s = await scrOf(pads[i]); return s && s.k === 'touch' && s.dark && s.found.length === 0 ? s : null; }, 12000);
async function sweep(i, sc, opts = {}) { // يضع الإصبع على شكل خافت أولًا، ثم يمرّ على النجوم واحدة واحدة
  const z = await rect(pads[i], '#padTouch'), P = (fx, fy) => [z[4] + fx * z[2], z[5] + fy * z[3]];
  const goals = sc.items.map((it, k) => [it, k]).filter(([it]) => it.goal), decoy = sc.items.find(it => !it.goal);
  let [x, y] = P(decoy.x, decoy.y); await mouse(pads[i], 'mousePressed', x, y); await sleep(250);
  const afterDecoy = (await ps(pads[i])).screen.found.length;
  for (const [it] of goals) { const [tx, ty] = P(it.x, it.y);
    for (let s = 1; s <= 8; s++) { await mouse(pads[i], 'mouseMoved', x + (tx - x) * s / 8, y + (ty - y) * s / 8); await sleep(opts.slow || 30); }
    x = tx; y = ty; if (opts.onFirst) { await opts.onFirst(); opts.onFirst = null; } }
  await sleep(150); await mouse(pads[i], 'mouseReleased', x, y);
  return { afterDecoy, found: (await ps(pads[i])).screen.found.slice(), goals: goals.map(g => g[1]) };
}
async function game(tag) {
  ok(tag + ': game ready', await S.play('games/flashlight.js'));
  if (tag === 'free') await shot(c, 'flashlight-tv-ready');
  await ready();
  const res = [];
  for (let r = 0; r < 2; r++) {
    const s0 = await dark(0), s1 = await dark(1);
    ok(tag + ': round ' + (r + 1) + ': both phones go dark with 4 hidden stars among dim shapes', s0 && s1 && [s0, s1].every(s => s.items.filter(i => i.goal).length === 4 && s.items.length > 4 && s.hint), s0 && { n: s0.items.length, light: s0.light });
    if (!s0 || !s1) break;
    if (r === 0 && tag === 'free') await pads[0].ev(`(()=>{ window.__vib=0; const o=navigator.vibrate&&navigator.vibrate.bind(navigator); navigator.vibrate=function(p){ window.__vib++; return o?o(p):true; }; })()`);
    const a = await sweep(0, s0, { slow: r === 0 && tag === 'free' ? 70 : 30 });
    const b = await sweep(1, s1, { slow: 60, onFirst: r === 0 && tag === 'free' ? async () => { await sleep(200); await shot(c, 'flashlight-tv-search'); await shot(pads[1], 'flashlight-phone-dark'); } : null });
    res.push([a, b]);
    if (r === 0 && tag === 'free') {
      ok('free: a dim shape is never reported as found', a.afterDecoy === 0 && b.afterDecoy === 0, [a.afterDecoy, b.afterDecoy]);
      ok('free: every star found once on the phone (the last finder ends the round at once ⇒ reveal)', a.found.length === 4 && a.found.every((k, j) => a.found.indexOf(k) === j), [a.found, b.found]);
      const vib = await pads[0].ev('window.__vib'); ok('free: hot/cold vibration fires while the finger nears a star', vib >= 3, vib);
    }
    const rv = await until(async () => { const s = await scrOf(pads[0]); return s && s.k === 'touch' && !s.dark ? s : null; }, 6000);
    ok(tag + ': round ' + (r + 1) + ': reveal shows the board lit on the phone', !!rv && rv.items.length === s0.items.length);
    if (r === 0 && tag === 'free') { await sleep(400); await shot(c, 'flashlight-tv-reveal'); await shot(pads[0], 'flashlight-phone-reveal'); }
  }
  return until(endEv, 15000);
}
try {
  ok('2 pads joined', await S.boot(0));
  const e = await game('free');
  ok('free: game ended after 2 rounds', !!e, e && e.text);
  if (e) { ok('free: stars + finish bonus (first +3, second +2): 14 vs 12', e.scores[0] === 14 && e.scores[1] === 12, e.scores);
    ok('free: first finder ranks 1', e.ranks[0] === 1 && e.ranks[1] === 2, e.ranks); ok('free: no teamScores', e.teamScores == null); }
  await S.toLobby('فريقان');
  const e2 = await game('teams');
  ok('teams: ended with teamScores [A,B] finite', e2 && Array.isArray(e2.teamScores) && e2.teamScores.length === 2 && e2.teamScores.every(Number.isFinite), e2 && e2.teamScores);
  await S.finishChecks();
} catch (e) { S.fail(e); }
finally { S.done(); }
