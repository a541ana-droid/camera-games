// «مسابقة» (games/quiz.js): تلفاز + ثلاثة جوالات عبر ?net=bc. ثلاث جولات: سباق السرعة (كلٌّ لنفسه)، والصغار (3 أزرار برموز، محاولة ثانية، الكل يفوز)، وفريقان.
// الأسئلة: الحزمة الاحتياطية المضمّنة (api.pack غائبة) أو أي حزمة في games/quiz/*.json — نعرف الجواب بمطابقة الأزرار. «قصيرة» (roundScale 0.6) ⇒ 6 أسئلة.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { padSuite, sleep } from './padgame-lib.mjs';
const S = await padSuite(9601, ['سارة', 'حمد', 'ريم']), { c, pads, ok, until, shot, tapEl, ps, endEv, scrOf } = S;
const root = new URL('..', import.meta.url);
const SAMPLE = Function('return ' + /const SAMPLE = (\[[\s\S]*?\n\]);/.exec(readFileSync(new URL('games/quiz.js', root), 'utf8'))[1])();
const BANK = SAMPLE.slice(); const qd = new URL('games/quiz/', root);
if (existsSync(qd)) for (const f of readdirSync(qd)) if (f.endsWith('.json')) try { const j = JSON.parse(readFileSync(new URL(f, qd), 'utf8')); for (const x of j.questions || []) BANK.push({ q: x.q || x.question, choices: x.choices, answer: x.answer }); } catch { }
const cut = (s, n) => { const a = [...String(s)]; return a.length <= n ? a.join('') : a.slice(0, n - 1).join('') + '…'; };
function answerOf(sc) { // فهرس الزرّ الصحيح في الشاشة
  const texts = sc.items.map(i => i.text);
  for (const q of BANK) { if (!q || !Array.isArray(q.choices)) continue; if (sc.prompt && cut(q.q, 40) !== sc.prompt) continue;
    const right = cut(q.choices[q.answer], 16); if (texts.includes(right) && texts.every(t => q.choices.some(ch => cut(ch, 16) === t))) return texts.indexOf(right); }
  return -1;
}
const wrongOf = (sc, a) => (a + 1) % sc.items.length;
const VOTE = 'أي أسئلة؟'; // (رقم الشاشة id لا يصل الجوال؛ نميّز بالسؤال ورقم الإرسال s)
async function nextScreen(prev) { // كل الجوالات على شاشة سؤال جديدة لم تُقفل
  return until(async () => { const all = await Promise.all(pads.map(scrOf)); return all.every((s, i) => s && s.k === 'choice' && s.prompt !== VOTE && s.picked === -1 && s.s !== prev[i]) ? all : null; }, 12000);
}
// المحرك 0.6.1+ يمرّر api.pack (منوّعة من games/quiz/ افتراضيًا): نحقن العيّنة المضمّنة حزمةً كي تكون الجولات حتمية (تصويت + صغار)، ثم جولة بالحزمة الرسمية
const usePack = p => c.ev(`typeof __engine.launch==='function' ? (__engine.launch('games/quiz.js', {caps:['players.pads']}, ${JSON.stringify(p)}), true) : false`);
const SAMPLE_PACK = { id: 'test', title: 'عيّنة الاختبار', questions: SAMPLE };
async function vote(ch) { // كل جوال يختار نوع الأسئلة (يعيد الضغط حتى تُقفل شاشته)
  for (let i = 0; i < pads.length; i++) await until(async () => { const s = await scrOf(pads[i]); if (!s || s.prompt !== VOTE) return false; if (s.picked >= 0) return true; await tapEl(pads[i], '#padCh' + ch[i]); return false; }, 8000);
}
async function round(tag, plan) { // plan(qi, sc, ans) ⇒ [[pad, choice, delayMs], ...]
  let prev = [], n = 0, end = null, first = null;
  while (!(end = await endEv())) {
    const all = await nextScreen(prev); if (!all) { end = await until(endEv, 6000); if (!end) console.log('     (no new question screen)', JSON.stringify(await Promise.all(pads.map(scrOf))).slice(0, 600)); break; }
    prev = all.map(s => s.s); const sc = all[0], ans = answerOf(sc); if (!first) first = { sc, ans };
    ok(tag + ': q' + n + ' answer known from the buttons', ans >= 0, sc.items.map(i => i.text));
    if (n === 1) { if (tag === 'kids') ok('kids: emoji buttons drawn big (emo class)', (await pads[1].ev(`[...document.querySelectorAll('.pchc')].map(e=>e.className.includes('emo'))`)).every(Boolean)); await shot(c, 'quiz-' + tag + '-tv-question'); await shot(pads[0], 'quiz-' + tag + '-phone-question'); }
    for (const [p, ch, d] of plan(n, sc, ans)) { if (d) await sleep(d);
      if (ch !== 'retry') { await tapEl(pads[p], '#padCh' + ch); continue; }
      await tapEl(pads[p], '#padCh' + wrongOf(sc, ans)); // خطأ أول ⇒ محاولة ثانية للصغار
      const s0 = all[p]; const again = await until(async () => { const s = await scrOf(pads[p]); return s && s.s !== s0.s && s.picked === -1 && s.items.length === sc.items.length ? s : null; }, 4000);
      ok(tag + ': a wrong answer gives one more try (screen comes back unlocked)', !!again, again && again.s);
      await shot(pads[p], 'quiz-' + tag + '-phone-retry'); if (again) await tapEl(pads[p], '#padCh' + ans); }
    if (n === 1) { await sleep(700); await shot(c, 'quiz-' + tag + '-tv-reveal'); await shot(pads[1], 'quiz-' + tag + '-phone-reveal'); }
    n++;
  }
  return { end, n, first };
}
try {
  ok('3 pads joined', await S.boot(0));
  // ---------- سباق السرعة ----------
  await usePack(SAMPLE_PACK);
  ok('free: quiz ready, phones switch to controller', await S.play('games/quiz.js'));
  const v = await until(async () => { const s = await scrOf(pads[0]); return s && s.prompt === VOTE ? s : null; }, 5000);
  ok('free: ready screen asks which questions (2 big buttons)', v && v.items.length === 2 && v.prompt === 'أي أسئلة؟', v);
  await shot(c, 'quiz-tv-ready'); await shot(pads[0], 'quiz-phone-ready');
  await vote([0, 0, 0]);
  await sleep(3800); // الشرح القصير
  const r1 = await round('speed', (n, sc, a) => [[0, a, 0], [1, wrongOf(sc, a), 0], [2, a, 1500]]);
  const look = r1.first && r1.first.sc;
  ok('speed: 4 coloured buttons (no shapes), question on the phone, ≤16 chars each', look && look.items.length === 4 && look.items.every(i => i.shape === -1 && /^#[0-9a-f]{6}$/i.test(i.color) && [...i.text].length <= 16) && look.prompt.length > 0, look);
  const e1 = r1.end; ok('speed: game ends after 6 questions (roundScale 0.6)', e1 && r1.n === 6, { n: r1.n, text: e1 && e1.text });
  if (e1) {
    ok('speed: faster correct beats slower correct, wrong scores 0', e1.scores[0] > e1.scores[2] && e1.scores[2] > 0 && e1.scores[1] === 0, e1.scores);
    ok('speed: points in range (100..220 per question)', e1.scores[0] <= 6 * 220 && e1.scores[2] >= 6 * 100, e1.scores);
    ok('speed: ranks by seat, fastest first', e1.ranks && e1.ranks[0] === 1 && e1.ranks[2] === 2 && e1.ranks[1] === 3, e1.ranks);
    ok('speed: no teamScores in free mode', e1.teamScores == null);
  }
  // ---------- الصغار ----------
  await S.toLobby(); await usePack(SAMPLE_PACK); ok('kids: replay ready', await S.play('games/quiz.js'));
  await vote([1, 1, 0]);
  await sleep(2500);
  const r2 = await round('kids', (n, sc, a) => n === 0 ? [[1, a, 0], [2, a, 0], [0, 'retry', 0]] : [[0, a, 0], [1, a, 0], [2, a, 0]]);
  const k = r2.first && r2.first.sc;
  ok('kids: 3 emoji buttons, no prompt text on the phone', k && k.items.length === 3 && !k.prompt, k);
  const e2 = r2.end; ok('kids: game ended', !!e2, e2 && e2.text);
  if (e2) { ok('kids: everyone wins (all ranks 1), stars text', e2.ranks.slice(0, 3).every(r => r === 1) && /أحسنتم/.test(e2.text), { ranks: e2.ranks, text: e2.text });
    ok('kids: one star per correct answer (second try counts too)', [0, 1, 2].every(i => e2.scores[i] === r2.n), e2.scores); }
  // ---------- فريقان ----------
  await S.toLobby('فريقان'); await usePack(SAMPLE_PACK); ok('teams: ready', await S.play('games/quiz.js'));
  await vote([0, 0, 0]);
  await sleep(2500);
  const r3 = await round('teams', (n, sc, a) => [[0, a, 0], [1, a, 0], [2, wrongOf(sc, a), 0]]);
  const e3 = r3.end; ok('teams: ended with teamScores [A,B] finite', e3 && Array.isArray(e3.teamScores) && e3.teamScores.length === 2 && e3.teamScores.every(Number.isFinite), e3 && e3.teamScores);
  // ---------- الحزمة الرسمية (api.pack من المضيف) ----------
  await S.toLobby('كلٌّ لنفسه');
  if (await usePack(null)) {
    ok('pack: ready', await S.play('games/quiz.js'));
    for (const p of pads) await until(async () => { const s = await scrOf(p); if (s && s.prompt === VOTE) { await tapEl(p, '#padCh0'); return true; } // حزمة فيها أسئلة صغار وكبار ⇒ تصويت، وإلا زرّ «جاهز»
      if ((await p.ev(`(document.getElementById('padBtnA')||{}).textContent`)) !== 'جاهز') return false; await tapEl(p, '#padBtnA'); return true; }, 8000);
    await sleep(2500);
    const r4 = await round('pack', (n, sc, a) => [[0, a, 0], [1, a, 0], [2, a, 0]]);
    const fromBank = r4.first && !SAMPLE.some(q => q.choices.map(x => cut(x, 16)).join() === r4.first.sc.items.map(i => i.text).join());
    ok('pack: questions come from api.pack (the official bank), not the built-in sample', r4.n >= 3 && fromBank, r4.first && r4.first.sc.prompt);
    ok('pack: game ended', !!r4.end, r4.end && r4.end.text);
    console.log('     pack title on TV:', await c.ev(`(__engine.events.filter(e=>e.n==='start').pop()||{}).d`));
  } else console.log('     (engine has no api.pack yet: pack round skipped)');
  await S.finishChecks();
} catch (e) { S.fail(e); }
finally { S.done(); }
