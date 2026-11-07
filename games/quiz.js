// @title مسابقة
// @desc السؤال على الشاشة الكبيرة والأجوبة أزرار كبيرة على جوال كل لاعب. الأسرع في الجواب الصحيح يأخذ نقاطًا أكثر. وحدك، أو بفريقين، أو بأسئلة الصغار بالصور.
// @howto اقرأ السؤال واضغط الجواب في جوالك
// @howto-act tap
// @accent #a37bff
// @engine 0.6
// @capabilities players.pads audio hud
// @pads 1-8 free 1v1 2v2 teams
// @series no
// @pack quiz
// @players 1-8
// @minutes 4
// @age 5
// @play pads
// @style versus teams calm
// الأسئلة من api.pack (حزمة للقراءة فقط يمرّرها المضيف: {id, title, questions:[{q, choices, answer, explain?, kid?}]}) وإن غابت فعيّنة مضمّنة.
// الأنماط: سباق السرعة (كلٌّ لنفسه: الصحيح 100 + حتى 100 بحسب سرعة الجواب المقيسة على الجوال، وأول صحيح +20)،
// الفرق (طريقة اللعب «فريقان»/2ضد2: درجة الفريق متوسط أعضائه)، والصغار (يُختار من الجوال: 3 أزرار برموز كبيرة، 30 ثانية، محاولة ثانية، نجمة لكل صحيح، والكل يفوز).

// عيّنة احتياطية من ideas-2026-11/02-questions-starter.json (10 عامة + 5 للصغار، رموز بلا وجوه)
const SAMPLE = [
  { q: 'الجليد هو الماء في حالته…', choices: ['السائلة', 'الغازية', 'المشتعلة', 'الصلبة'], answer: 3, explain: 'الماء يتجمد عند 0 °م فيصبح جليدًا.' },
  { q: 'ما أقرب نجم إلى الأرض؟', choices: ['القمر', 'الزهرة', 'النجم القطبي', 'الشمس'], answer: 3, explain: 'الشمس نجم، والقمر تابع للأرض.' },
  { q: 'ما الفاكهة الصفراء المقوسة التي يقشّرها القرد في الرسوم؟', choices: ['البرتقال', 'الموز', 'العنب', 'الفراولة'], answer: 1 },
  { q: 'أي شكل له أربعة أضلاع متساوية وأربع زوايا قائمة؟', choices: ['المثلث', 'الدائرة', 'المربع', 'النجمة'], answer: 2 },
  { q: 'ما الرمز الكيميائي للماء؟', choices: ['CO2', 'O2', 'NaCl', 'H2O'], answer: 3, explain: 'جزيء الماء ذرتا هيدروجين وذرة أكسجين.' },
  { q: 'كم رجلًا للحشرة؟', choices: ['4', '8', '6', '10'], answer: 2 },
  { q: 'ما أكبر عظمة في جسم الإنسان؟', choices: ['عظمة الساق', 'عظمة الذراع', 'الجمجمة', 'عظمة الفخذ'], answer: 3 },
  { q: 'ما المكوّن الأساسي لطبق الحمّص بالطحينة؟', choices: ['العدس', 'الفول', 'الأرز', 'حبوب الحمّص'], answer: 3 },
  { q: 'كم كوكبًا في المجموعة الشمسية؟', choices: ['8', '7', '9', '10'], answer: 0, explain: 'منذ عام 2006 صُنّف بلوتو كوكبًا قزمًا.' },
  { q: 'أي كوكب يُعرف بالكوكب الأحمر؟', choices: ['المريخ', 'الزهرة', 'المشتري', 'عطارد'], answer: 0 },
  { q: 'أين الكرة؟', choices: ['🚗', '⚽', '🍌'], answer: 1, kid: true },
  { q: 'أين التفاحة؟', choices: ['🍌', '🍇', '🍎'], answer: 2, kid: true },
  { q: 'أي واحدة هي السيارة؟', choices: ['✈️', '🚗', '🚲'], answer: 1, kid: true },
  { q: 'أين المطر؟', choices: ['☀️', '🌧️', '❄️'], answer: 1, kid: true },
  { q: 'أي واحد نلبسه في القدمين؟', choices: ['👟', '🧢', '🧤'], answer: 0, kid: true }
];
const VOTE = 900, VOTE_SPEC = { prompt: 'أي أسئلة؟', id: VOTE, items: [{ text: '🧠 للجميع', color: '#7c6cff' }, { text: '🎈 للصغار', color: '#3ddc97' }] };
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let api, ui, state = 'ready', W = 1280, H = 720, readyT = 0, ended = false, ALL = SAMPLE, packTitle = '', hasKid = true, allKid = false, kids = false; // حزمة كلها للصغار ⇒ وضع الصغار بلا تصويت
let list = [], qi = -1, cur = null, qid = 0, spec = null, T = 15, qt = 0, phase = 'q', rt = 0, REV = 3, lines = [], linesKey = '';
const pl = []; // لكل مقعد: {vote, score, ms, ans:{k, ms, ok}|null, retried, retryAt, got}
const boxes = []; for (let i = 0; i < 4; i++) boxes.push({ x: 0, y: 0, w: 0, h: 0 });
const cut = (s, n) => { const a = [...String(s)]; return a.length <= n ? a.join('') : a.slice(0, n - 1).join('') + '…'; };
const P = i => pl[i] || (pl[i] = { vote: -1, score: 0, ms: 0, ans: null, retried: false, retryAt: -1, got: 0 });

function readPack(p) { // الحزمة بيانات لا شيفرة: نأخذ ما صحّ منها فقط
  if (!p || !Array.isArray(p.questions)) return null; const out = [];
  for (const x of p.questions.slice(0, 1000)) {
    if (!x || typeof x !== 'object') continue; const q = x.q != null ? x.q : x.question; if (typeof q !== 'string' || !q.trim()) continue;
    const ch = Array.isArray(x.choices) ? x.choices.slice(0, 4).map(s => String(s == null ? '' : s)) : []; if (ch.length < 2 || ch.some(s => !s)) continue;
    if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer >= ch.length) continue;
    out.push({ q: q.slice(0, 160), choices: ch, answer: x.answer, explain: x.explain ? String(x.explain).slice(0, 140) : '', kid: !!x.kid });
  }
  return out.length >= 3 ? out : null;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function prep(x) { // للصغار ثلاثة أزرار فقط: نحذف جوابًا خاطئًا عشوائيًا
  const ch = x.choices.slice(); let ans = x.answer;
  if (kids && ch.length > 3) { let d; do d = (Math.random() * ch.length) | 0; while (d === ans); ch.splice(d, 1); if (d < ans) ans--; }
  return { q: x.q, choices: ch, answer: ans, explain: x.explain || '' };
}
function connected() { return api.pads.list.filter(p => p.connected); }
function teamScore(tm) { let s = 0, n = 0; for (const p of api.pads.list) if (api.teams.of(p.index) === tm) { s += P(p.index).score; n++; } return n ? Math.round(s / n) : 0; }
function begin() {
  let k = 0, n = 0; for (const p of connected()) { const v = P(p.index).vote; if (v === 1) k++; else if (v === 0) n++; }
  kids = allKid || (hasKid && k > 0 && k >= n); // التعادل للصغار: لا يُترك صغير بأسئلة لا يفهمها
  let pool = ALL.filter(x => !!x.kid === kids); if (pool.length < 3) pool = ALL.slice();
  list = shuffle(pool.slice()).slice(0, Math.max(3, Math.round(10 * RS))).map(prep);
  T = kids ? 30 : by3(25, 15, 10); qi = -1; state = 'count';
  for (const p of api.pads.list) { const r = P(p.index); r.score = 0; r.ms = 0; r.got = 0; }
  api.pads.choices(-1, null); api.pads.controls({ stick: false, a: '', b: '' }); api.pads.say(-1, kids ? 'اضغط الصورة الصحيحة' : 'اقرأ السؤال واضغط الجواب');
  ui.countdown(3, () => { state = 'play'; nextQ(); });
}
function nextQ() {
  qi++; if (qi >= list.length) return finish();
  cur = list[qi]; qid = 100 + qi; phase = 'q'; qt = 0;
  for (const p of api.pads.list) { const r = P(p.index); r.ans = null; r.retried = false; r.retryAt = -1; }
  spec = { prompt: kids ? '' : cut(cur.q, 40), id: qid, items: cur.choices.map((t, k) => kids ? { text: cut(t, 16), color: '#2a2547' } : { text: cut(t, 16), color: ui.theme.players[k].color }) };
  api.pads.choices(-1, spec); api.audio.beep(660, 70, 0.15);
  api.hud.set({ score: hudScore() });
}
function points(r) { return !r.ans || !r.ans.ok ? 0 : kids ? 1 : 100 + Math.round(100 * Math.max(0, T - r.ans.ms / 1000) / T); }
function reveal() {
  phase = 'reveal'; rt = 0; REV = cur.explain ? 5 : 3.2; let first = -1, fm = 1e9;
  if (!kids) for (const p of api.pads.list) { const r = P(p.index); if (r.ans && r.ans.ok && r.ans.ms < fm) { fm = r.ans.ms; first = p.index; } }
  const right = cut(cur.choices[cur.answer], 20);
  for (const p of api.pads.list) {
    const r = P(p.index), v = points(r) + (p.index === first ? 20 : 0); r.score += v; r.got = v; if (r.ans) r.ms += r.ans.ms; else r.ms += T * 1000;
    if (r.ans && r.ans.ok) { api.pads.say(p.index, kids ? '⭐ أحسنت!' : '✓ صح! +' + v); api.pads.vibrate(p.index, 80); }
    else api.pads.say(p.index, (r.ans ? '✗ ' : '⏱ ') + 'الجواب: ' + right);
  }
  api.audio.melody([{ freq: 784, ms: 90 }, { freq: 1046, ms: 160 }]);
  api.hud.set({ score: hudScore() });
}
function hudScore() { return api.teams.on ? ui.num(teamScore(0)) + ' : ' + ui.num(teamScore(1)) : ui.num(Math.min(qi + 1, list.length)) + '/' + ui.num(list.length); }
function finish() {
  state = 'over'; ended = true; const scores = [], ranks = [], L = api.pads.list;
  for (let i = 0; i < 8; i++) scores[i] = pl[i] ? pl[i].score : 0;
  const ord = L.slice().sort((a, b) => P(b.index).score - P(a.index).score || P(a.index).ms - P(b.index).ms); // التعادل: الأقل زمنًا
  ord.forEach((p, k) => { const prev = ord[k - 1]; ranks[p.index] = kids ? 1 : prev && P(prev.index).score === P(p.index).score && P(prev.index).ms === P(p.index).ms ? ranks[prev.index] : k + 1; });
  for (let i = 0; i < 8; i++) if (ranks[i] == null) ranks[i] = 8;
  const ts = api.teams.on ? [teamScore(0), teamScore(1)] : undefined; let stars = 0; for (const p of L) stars += P(p.index).score;
  const text = kids ? 'أحسنتم يا فريق! ⭐ ' + ui.num(stars) : ts ? (ts[0] === ts[1] ? 'تعادل الفريقان!' : 'فاز ' + api.teams.names[ts[0] > ts[1] ? 0 : 1]) : ord.length ? 'الأول: ' + ord[0].name + ' (' + ui.num(P(ord[0].index).score) + ')' : 'انتهت المسابقة';
  api.pads.choices(-1, null); api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 120 }, { freq: 1046, ms: 260 }]);
  api.end({ score: ord.length ? P(ord[0].index).score : 0, scores, ranks, teamScores: ts, text });
}
function wrap(c, s, maxW, size) { // يلفّ السؤال حتى 3 أسطر
  c.font = 'bold ' + size + 'px sans-serif'; const out = []; let line = '';
  for (const wd of s.split(' ')) { const t = line ? line + ' ' + wd : wd; if (line && c.measureText(t).width > maxW) { out.push(line); line = wd; } else line = t; }
  if (line) out.push(line); return out;
}

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1;
    const pk = readPack(a.pack); if (pk) { ALL = pk; packTitle = String((a.pack && a.pack.title) || '').slice(0, 40); }
    const nk = ALL.filter(x => x.kid).length; allKid = nk === ALL.length; hasKid = nk >= 3 && ALL.length - nk >= 3; const s = api.view.size(); W = s.w; H = s.h;
    api.pads.onChoice(e => {
      const r = P(e.index);
      if (e.id === VOTE) { if (state === 'ready' && r.vote < 0) { r.vote = e.choice; api.audio.beep(660 + e.index * 60, 70, 0.2); api.pads.say(e.index, '✓ جاهز — ننتظر الباقين'); } return; }
      if (state !== 'play' || phase !== 'q' || (e.id !== qid && e.id !== qid + 500) || (r.ans && r.ans.final)) return;
      const ok = e.choice === cur.answer;
      if (kids && !ok && !r.retried) { r.retried = true; r.retryAt = qt + 0.9; api.pads.vibrate(e.index, 40); api.pads.say(e.index, 'حاول مرة أخرى 🙂'); return; }
      r.ans = { k: e.choice, ms: e.ms, ok, final: true }; api.audio.beep(520 + e.index * 40, 50, 0.12);
    });
    api.pads.onJoin(p => { const r = P(p.index);
      if (state === 'ready') { r.vote = -1; if (hasKid) api.pads.choices(p.index, VOTE_SPEC); else { api.pads.controls({ stick: false, a: 'جاهز', b: '' }, p.index); api.pads.say(p.index, 'اضغط «جاهز»'); } }
      else if (state === 'play' && phase === 'q' && !r.ans) api.pads.choices(p.index, spec); });
    if (hasKid) { api.pads.choices(-1, VOTE_SPEC); api.pads.say(-1, 'اختر نوع الأسئلة لتبدأ'); }
    else { api.pads.controls({ stick: false, a: 'جاهز', b: '' }); api.pads.say(-1, 'اضغط «جاهز» حين تستعد'); }
    api.hud.set({ title: 'مسابقة' });
  },
  onResize(w, h) { W = w; H = h; },
  update(dt) {
    const L = connected();
    if (state === 'ready') {
      let rd = 0; for (const p of L) { const r = P(p.index); if (!hasKid && api.pads.input(p.index).aDown && r.vote < 0) { r.vote = 0; api.audio.beep(700, 60, 0.2); } if (r.vote >= 0) rd++; }
      readyT = rd ? readyT + dt : 0; if (L.length && (rd === L.length || readyT > 12)) begin(); return;
    }
    if (state !== 'play') return;
    if (phase === 'q') {
      qt += dt; let done = 0;
      for (const p of L) { const r = P(p.index); if (r.ans) done++; if (r.retryAt > 0 && qt >= r.retryAt) { r.retryAt = -1; api.pads.choices(p.index, Object.assign({}, spec, { id: qid + 500 })); } }
      if (qt >= T || (L.length && done === L.length && qt > 0.5)) reveal();
    } else if ((rt += dt) >= REV) nextQ();
  },
  render(c, w, h) {
    W = w; H = h; const th = ui.theme, L = api.pads.list, cx = w / 2, u = Math.min(w, h) / 100;
    ui.background(c);
    if (state === 'ready') {
      ui.bigText(c, 'مسابقة', { y: h * 0.2 });
      if (packTitle) ui.text(c, packTitle, cx, h * 0.28, Math.max(18, u * 3), th.accent, true);
      ui.text(c, hasKid ? 'اختر على جوالك: 🧠 أسئلة للجميع، أو 🎈 أسئلة الصغار بالصور' : 'اضغط «جاهز» على جوالك', cx, h * 0.36, Math.max(16, Math.min(28, w * 0.02)), th.mut);
      const n = Math.max(1, L.length), sz = Math.min(150, w * 0.8 / n);
      L.forEach((p, k) => { const r = P(p.index), x = cx + (k - (n - 1) / 2) * sz * 1.15, y = h * 0.58; c.globalAlpha = p.connected ? 1 : 0.35;
        ui.shape(c, p.colorIndex, x, y, sz * 0.3); ui.text(c, p.name, x, y + sz * 0.5, Math.max(15, sz * 0.15), th.fg, true);
        ui.text(c, !p.connected ? 'انقطع' : r.vote < 0 ? '…' : hasKid ? (r.vote ? '🎈 جاهز' : '🧠 جاهز') : '✓ جاهز', x, y + sz * 0.7, Math.max(13, sz * 0.13), r.vote < 0 ? th.mut : th.ok, true); c.globalAlpha = 1; });
      if (!L.length) ui.text(c, 'بانتظار الجوالات…', cx, h * 0.58, 24, th.mut);
      else if (readyT > 0) ui.text(c, 'نبدأ بعد ' + ui.num(Math.ceil(12 - readyT)) + ' ثانية', cx, h * 0.88, 20, th.warn, true);
      ui.draw(c); return;
    }
    if (cur && state !== 'count') {
      const top = ui.safe.top + 8, rev = phase === 'reveal';
      ui.text(c, 'سؤال ' + ui.num(qi + 1) + ' من ' + ui.num(list.length), cx, top + 10, Math.max(16, u * 2.6), th.mut, true);
      if (!rev) ui.progress(c, Math.max(0, 1 - qt / T), { y: top + 30, h: 10 });
      // السؤال: حتى 3 أسطر
      const qs = Math.max(24, Math.min(64, h * (kids ? 0.08 : 0.065)));
      if (linesKey !== cur.q + w) { linesKey = cur.q + w; lines = wrap(c, cur.q, w * 0.86, qs).slice(0, 3); }
      lines.forEach((ln, k) => ui.text(c, ln, cx, top + 70 + qs * 0.6 + k * qs * 1.25, qs, th.fg, true));
      // الأجوبة: شبكة 2×2 (أو صفّ من 3 للصغار) بلون الزرّ نفسه الذي على الجوال
      const n = cur.choices.length, cols = kids || n === 3 ? n : 2, rows = Math.ceil(n / cols), gy = top + 90 + qs * 1.25 * lines.length, gh = h - gy - Math.max(120, h * 0.2);
      const bw = Math.min(w * 0.9 / cols - u * 2, kids ? 300 : 620), bh = Math.min(gh / rows - u * 2, kids ? 260 : 130);
      for (let k = 0; k < n; k++) {
        const b = boxes[k], col = k % cols, row = (k / cols) | 0; b.w = bw; b.h = bh; b.x = cx + (cols / 2 - col - 1) * (bw + u * 2) + u; b.y = gy + row * (bh + u * 2) + (gh - rows * (bh + u * 2)) / 2;
        const isAns = k === cur.answer; c.globalAlpha = rev && !isAns ? 0.4 : 1;
        c.fillStyle = rev && isAns ? th.ok : th.surface; c.beginPath(); c.roundRect(b.x, b.y, b.w, b.h, Math.min(24, b.h * 0.25)); c.fill();
        c.lineWidth = 3; c.strokeStyle = rev && isAns ? '#ffffff' : th.line; c.stroke();
        const txt = cur.choices[k];
        if (kids) ui.text(c, txt, b.x + b.w / 2, b.y + b.h / 2, Math.min(b.h * 0.6, b.w * 0.5), th.fg);
        else { c.fillStyle = th.players[k].color; c.beginPath(); c.roundRect(b.x + b.w - b.h * 0.3, b.y + b.h * 0.16, b.h * 0.14, b.h * 0.68, b.h * 0.07); c.fill(); // لون الزرّ نفسه على الجوال (بلا شكل كي لا يختلط بجواب مثل «المثلث»)

            ui.text(c, txt, b.x + (b.w - b.h * 0.4) / 2, b.y + b.h / 2, Math.max(16, Math.min(b.h * 0.36, (b.w - b.h) * 1.7 / Math.max(4, [...txt].length))), rev && isAns ? th.bg : th.fg, true); }
        c.globalAlpha = 1;
        if (rev) { let m = 0; for (const p of L) { const r = P(p.index); if (r.ans && r.ans.k === k) { ui.shape(c, p.colorIndex, b.x + 22 + m * 34, b.y + b.h + 4, 13); m++; } } } // من اختار ماذا
      }
      if (rev && cur.explain) ui.text(c, cur.explain, cx, h - Math.max(110, h * 0.17) - 12, Math.max(16, u * 2.8), th.warn, true);
      if (!rev) { let d = 0, on = 0; for (const p of L) if (p.connected) { on++; if (P(p.index).ans) d++; } ui.text(c, ui.num(d) + ' من ' + ui.num(on) + ' أجابوا', cx, h - Math.max(110, h * 0.17) - 12, Math.max(16, u * 2.6), th.mut, true); }
    }
    // اللاعبون أسفل الشاشة: ✓ لمن أجاب (بلا كشف ماذا اختار) ونقاطه
    const n = Math.max(1, L.length), cw = Math.min(190, (w - 60) / n), y = h - Math.max(56, h * 0.08);
    L.forEach((p, k) => { const r = P(p.index), x = cx + (k - (n - 1) / 2) * cw, tm = api.teams.of(p.index); c.globalAlpha = p.connected ? 1 : 0.35;
      if (tm >= 0) { c.fillStyle = api.teams.colors[tm]; c.globalAlpha *= 0.35; c.beginPath(); c.roundRect(x - cw * 0.46, y - 34, cw * 0.92, 68, 20); c.fill(); c.globalAlpha = p.connected ? 1 : 0.35; }
      ui.playerChip(c, p.colorIndex, x, y, { label: p.name, score: kids ? '⭐ ' + ui.num(r.score) : r.score, size: Math.min(44, cw * 0.3), active: phase === 'q' && !!r.ans });
      if (phase === 'q' && r.ans) ui.text(c, '✓', x, y - 46, 26, th.ok, true);
      if (phase === 'reveal' && r.got) ui.text(c, '+' + ui.num(r.got), x, y - 46, 24, th.ok, true);
      c.globalAlpha = 1; });
    if (api.teams.on) for (let tm = 0; tm < 2; tm++) { const bw = Math.min(240, w * 0.22), x = tm ? 20 : w - 20 - bw; c.fillStyle = api.teams.colors[tm]; c.beginPath(); c.roundRect(x, ui.safe.top + 4, bw, 40, 20); c.fill(); ui.text(c, api.teams.names[tm] + '  ' + ui.num(teamScore(tm)), x + bw / 2, ui.safe.top + 24, 18, th.bg, true); }
    ui.draw(c);
  }
});
