// «سباق الحل» (games/math-race.js): تلفاز + ثلاثة جوالات عبر ?net=bc. كل جوال يختار عمره (10+ / 4-6 / 7-9) فتأتيه مسائله على أزرار،
// والاختبار يحلّها من نصّ المسألة: الصحيح يقدّم، والخطأ تأخير قصير. ثم فريقان. «قصيرة» (roundScale 0.6) ⇒ خط النهاية بعد 6 أجوبة صحيحة.
import { padSuite, sleep } from './padgame-lib.mjs';
const S = await padSuite(9602, ['سارة', 'حمد', 'ريم']), { c, pads, ok, until, shot, tapEl, endEv, scrOf } = S;
const AGE = 'كم عمرك؟', seg = new Intl.Segmenter();
function solve(prompt) { // ⇒ {v, kind}
  const e = prompt.replace(/\s*=\s*؟\s*$/, ''), m = /^(\d+) ([+−×÷]) (\d+)$/.exec(e);
  if (m) { const a = +m[1], b = +m[3]; return { kind: m[2], a, b, v: m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b }; }
  const [x, y] = e.split(' + ').map(s => [...seg.segment(s)].length); return { kind: 'dots', a: x, b: y, v: x + y };
}
async function pickAge(ch) {
  for (let i = 0; i < pads.length; i++) await until(async () => { const s = await scrOf(pads[i]); if (!s || s.prompt !== AGE) return false; if (s.picked >= 0) return true; await tapEl(pads[i], '#padCh' + ch[i]); return false; }, 8000);
}
async function race(tag, ages, plan) { // plan(pad, n) ⇒ {wrong, delay}
  ok(tag + ': game ready', await S.play('games/math-race.js'));
  const a0 = await until(async () => { const s = await scrOf(pads[0]); return s && s.prompt === AGE ? s : null; }, 5000);
  ok(tag + ': ready screen asks each phone its age (3 buttons)', a0 && a0.items.map(i => i.text).join() === '4-6,7-9,10+', a0 && a0.items);
  if (tag === 'free') { await shot(c, 'math-race-tv-ready'); await shot(pads[0], 'math-race-phone-age'); }
  await pickAge(ages);
  const last = [], seen = pads.map(() => []), due = [], wrongAt = [], gaps = []; let end = null, shots = false; const t0 = Date.now();
  while (!(end = await endEv()) && Date.now() - t0 < 120000) {
    for (let i = 0; i < pads.length; i++) {
      const s = await scrOf(pads[i]); if (!s || s.k !== 'choice' || s.prompt === AGE || s.picked !== -1 || s.s === last[i]) continue;
      if (wrongAt[i]) { gaps.push(Date.now() - wrongAt[i]); wrongAt[i] = 0; }
      const n = seen[i].length, pl = plan(i, n); if (!due[i]) { due[i] = Date.now() + (pl.delay || 0); continue; } if (Date.now() < due[i]) continue; due[i] = 0;
      const sol = solve(s.prompt), texts = s.items.map(x => x.text), k = texts.indexOf(String(sol.v)); seen[i].push({ p: s.prompt, sol, texts });
      last[i] = s.s; const pick = pl.wrong ? (k + 1) % texts.length : k; if (pl.wrong) wrongAt[i] = Date.now();
      await tapEl(pads[i], '#padCh' + pick);
    }
    if (!shots && tag === 'free' && seen[0].length >= 3 && seen[1].length >= 2) { shots = true; await sleep(250); await shot(c, 'math-race-tv-race'); await shot(pads[1], 'math-race-phone-age4-6'); await shot(pads[0], 'math-race-phone-age10'); await shot(pads[2], 'math-race-phone-age7-9'); }
    await sleep(80);
    if (process.env.DBG) console.log(JSON.stringify(await Promise.all(pads.map(scrOf))).slice(0, 300));
  }
  return { end, seen, gaps };
}
try {
  ok('3 pads joined', await S.boot(0));
  const r = await race('free', [2, 0, 1], (i, n) => i === 1 && n === 0 ? { wrong: true } : { delay: i === 2 ? 1200 : 0 });
  const all = r.seen.flat();
  ok('free: every problem has its answer among the buttons', all.length > 10 && all.every(x => x.texts.includes(String(x.sol.v))), all.filter(x => !x.texts.includes(String(x.sol.v))).slice(0, 3));
  ok('free: 4-6 gets counting problems (things + things, sum ≤10, 3 buttons)', r.seen[1].length && r.seen[1].every(x => x.sol.kind === 'dots' && x.sol.v <= 10 && x.texts.length === 3), r.seen[1].slice(0, 3).map(x => x.p));
  ok('free: 7-9 gets + − × within 100 (4 buttons)', r.seen[2].length && r.seen[2].every(x => '+−×'.includes(x.sol.kind) && x.sol.v <= 100 && x.sol.v >= 0 && x.texts.length === 4), r.seen[2].slice(0, 3).map(x => x.p));
  ok('free: 10+ gets the four operations, division always whole', r.seen[0].length >= 6 && r.seen[0].every(x => '+−×÷'.includes(x.sol.kind) && Number.isInteger(x.sol.v) && x.sol.v >= 0), r.seen[0].map(x => x.p));
  ok('free: a wrong answer waits ≈1.2 s before the next problem', r.gaps.length === 1 && r.gaps[0] >= 900, r.gaps);
  const e = r.end; ok('free: race reached api.end', !!e, e && e.text);
  if (e) { ok('free: first to 6 correct is rank 1, scores = steps by seat', e.ranks[0] === 1 && e.scores[0] === 6 && /سارة/.test(e.text), { ranks: e.ranks, scores: e.scores, text: e.text });
    ok('free: no teamScores in free mode', e.teamScores == null); }
  await S.toLobby('فريقان');
  const r2 = await race('teams', [1, 1, 0], (i) => ({ delay: i * 400 }));
  const e2 = r2.end; ok('teams: ended with teamScores [A,B] finite', e2 && Array.isArray(e2.teamScores) && e2.teamScores.length === 2 && e2.teamScores.every(Number.isFinite), e2 && { ts: e2.teamScores, text: e2.text });
  await S.finishChecks();
} catch (e) { S.fail(e); }
finally { S.done(); }
