// @title شدّ الحبل بالإيقاع
// @desc فريقان يشدّان الحبل. اضغطوا الزرّ مع النبضة تمامًا: الضغطة في وقتها تشدّ بقوة، والضغط العشوائي السريع لا يفيد. يهتزّ الجوال مع كل نبضة.
// @howto اضغط الزرّ مع النبضة تمامًا
// @howto-act tap-beat
// @accent #ff8a3d
// @engine 0.5
// @capabilities players.pads audio hud
// @pads 2-8 1v1 2v2 teams
// @series no
// لعبة فرق: api.teams.of(index) يحدّد فريق كل جوال، وapi.end({teamScores}) يبلغ الشاشة بالفائز. لا صراخ ولا كاميرا: إيقاع فقط.

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل / 1 عادي (سلوك ما قبلها حرفيًا) / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let BEAT = 0.6, PERFECT = 0.11, GOOD = 0.21, ROUND = 45; const WIN = 1;
let api, ui, state = 'ready', t = 0, bt = 0, beatN = 0, rope = 0, ropeV = 0, W = 800, H = 600, readyT = 0, ended = false, flashT = [0, 0];
const pl = []; // {ready, last, hits, perfect, mood, moodT, lean}
const marks = []; for (let i = 0; i < 24; i++) marks.push({ x: 0, y: 0, k: 0, a: -1, c: '' }); let mi = 0;
const pull = [0, 0]; // قوة كل فريق المتراكمة في هذه النبضة (تتلاشى)

function q(i) { return pl[i] || (pl[i] = { ready: false, last: -9, hits: 0, perfect: 0, mood: 'happy', moodT: 0 }); }
function teamOf(i) { const tm = api.teams.of(i); return tm >= 0 ? tm : i % 2; } // احتياط: لو شُغّلت بلا فرق نقسم بالتناوب
function mark(x, y, k, col, i) { const m = marks[mi]; mi = (mi + 1) % marks.length; m.x = x; m.y = y; m.k = k; m.a = 0; m.c = col; m.i = i; }
const headAt = []; // موضع رأس كل لاعب في آخر رسم: تطفو كلمة «ممتاز/جيد» فوقه لا فوق اسم غيره
function begin() {
  state = 'count'; rope = 0; ropeV = 0; t = 0; bt = 0; beatN = 0; for (const p of pl) if (p) { p.hits = 0; p.perfect = 0; p.last = -9; }
  api.pads.controls({ stick: false, a: 'شُدّ!' }); api.pads.say(-1, 'اضغط مع النبضة!');
  ui.countdown(3, () => { state = 'play'; bt = 0; });
}
function finish() {
  state = 'over'; ended = true; const list = api.pads.list, scores = [];
  for (let i = 0; i < 8; i++) scores[i] = pl[i] ? pl[i].hits : 0;
  const winner = rope > 0.02 ? 0 : rope < -0.02 ? 1 : -1; // الحبل نحو اليمين = الفريق أ
  const ts = [Math.round(50 + rope * 50), Math.round(50 - rope * 50)];
  api.audio.melody([{ freq: 392, ms: 120 }, { freq: 523, ms: 120 }, { freq: 659, ms: 300 }]);
  api.end({ score: Math.max(ts[0], ts[1]), scores, teamScores: ts, text: winner < 0 ? 'تعادل! الحبل في المنتصف' : 'فاز ' + api.teams.names[winner] + ' بالشدّ في الإيقاع' });
}

function tok(c, i, x, y, sz, mood) { // اللاعب = لونه وشكله فقط (DESIGN.md §2)، بلا وجه: cheer نبضة خفيفة، wow حلقة بيضاء
  const r = sz * 0.4 * (mood === 'cheer' && !ui.still ? 1 + 0.08 * Math.sin(ui.t * 10) : 1); ui.shape(c, i, x, y, r);
  if (mood === 'wow') { c.save(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = Math.max(2, r * 0.12); c.beginPath(); c.arc(x, y, r * 1.4, 0, 6.283); c.stroke(); c.restore(); }
}
defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; ROUND = Math.round(45 * RS); BEAT = by3(0.75, 0.6, 0.55); PERFECT = by3(0.2, 0.11, 0.08); GOOD = by3(0.375, 0.21, 0.15); const s = api.view.size(); W = s.w; H = s.h; // سهل: نبضة أبطأ وكل ضغطة قريبة تُحسب
    api.pads.controls({ stick: false, a: 'جاهز' }); api.pads.say(-1, 'اضغط «جاهز»');
    api.pads.onJoin(p => api.pads.controls({ stick: false, a: state === 'play' ? 'شُدّ!' : 'جاهز' }, p.index));
    api.hud.set({ title: 'شدّ الحبل' });
  },
  onResize(w, h) { W = w; H = h; },
  update(dt) {
    const list = api.pads.list;
    for (const m of marks) if (m.a >= 0) { m.a += dt; if (m.a > 0.8) m.a = -1; }
    for (const p of pl) if (p) p.moodT = Math.max(0, p.moodT - dt);
    flashT[0] = Math.max(0, flashT[0] - dt); flashT[1] = Math.max(0, flashT[1] - dt);
    if (state === 'ready') {
      let on = 0, rd = 0; const tm = [0, 0];
      for (const p of list) { if (!p.connected) continue; on++; tm[teamOf(p.index)]++; const r = q(p.index); if (api.pads.input(p.index).aDown && !r.ready) { r.ready = true; api.audio.beep(520 + teamOf(p.index) * 200, 70, 0.2); } if (r.ready) rd++; }
      readyT = rd ? readyT + dt : 0;
      if (tm[0] && tm[1] && (rd === on || readyT > 12)) begin();
      return;
    }
    if (state !== 'play') return;
    t += dt; bt += dt;
    if (bt >= BEAT) { bt -= BEAT; beatN++; api.audio.tone({ freq: beatN % 4 ? 330 : 440, ms: 70, vol: 0.12, type: 'triangle' }); api.pads.vibrate(-1, 25); }
    const phase = Math.min(bt, BEAT - bt); // البعد عن أقرب نبضة بالثواني
    for (const p of list) {
      const s = api.pads.input(p.index); if (!s.aDown || !p.connected) continue; const r = q(p.index), tm = teamOf(p.index), near = Math.round(t / BEAT); // نبضة واحدة لكل لاعب: لا فائدة من التكرار
      const x = tm === 0 ? W * 0.72 : W * 0.28, y = H * 0.7;
      if (r.last === near) { mark(x, y, 0, ui.theme.mut, p.index); continue; } r.last = near;
      if (phase <= PERFECT) { pull[tm] += 1; r.hits++; r.perfect++; r.mood = 'cheer'; r.moodT = 0.4; mark(x, y, 2, ui.theme.ok, p.index); api.pads.vibrate(p.index, 60); }
      else if (phase <= GOOD) { pull[tm] += 0.5; r.hits++; r.mood = 'happy'; r.moodT = 0.3; mark(x, y, 1, ui.theme.warn, p.index); }
      else { r.mood = 'wow'; r.moodT = 0.4; mark(x, y, 0, ui.theme.bad, p.index); }
    }
    // القوّة: كل فريق يُقاس بمتوسط لاعبيه كي لا يغلب الفريق الأكبر عددًا وحده
    const n = [0, 0]; for (const p of list) if (p.connected) n[teamOf(p.index)]++;
    const f0 = pull[0] / Math.max(1, n[0]), f1 = pull[1] / Math.max(1, n[1]);
    ropeV += (f0 - f1) * 0.9 * dt * 10; pull[0] *= Math.pow(0.02, dt); pull[1] *= Math.pow(0.02, dt);
    if (f0 > f1 + 0.2) flashT[0] = 0.2; else if (f1 > f0 + 0.2) flashT[1] = 0.2;
    ropeV *= Math.pow(0.15, dt); rope = Math.max(-WIN, Math.min(WIN, rope + ropeV * dt * 0.05));
    api.hud.set({ time: ui.num(Math.ceil(Math.max(0, ROUND - t))) });
    if ((Math.abs(rope) >= WIN || t >= ROUND) && !ended) finish();
  },
  render(c, w, h) {
    W = w; H = h; const th = ui.theme, T = ui.t, list = api.pads.list, cx = w / 2, ry = h * 0.56, span = w * 0.42;
    ui.background(c);
    // نصفا الملعب بلوني الفريقين
    for (let tm = 0; tm < 2; tm++) { c.globalAlpha = 0.1 + flashT[tm] * 0.8; c.fillStyle = api.teams.colors[tm]; c.fillRect(tm ? 0 : cx, ui.safe.top, w / 2, h - ui.safe.top); } c.globalAlpha = 1;
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.setLineDash([10, 10]); c.lineWidth = 3; c.beginPath(); c.moveTo(cx, ui.safe.top + 60); c.lineTo(cx, h - 70); c.stroke(); c.setLineDash([]);
    for (let tm = 0; tm < 2; tm++) ui.text(c, api.teams.names[tm], tm ? w * 0.2 : w * 0.8, ui.safe.top + 30, Math.max(20, w * 0.022), api.teams.colors[tm], true);
    // النبضة: حلقة تنكمش نحو الدائرة الثابتة؛ لحظة التطابق = اضغط
    const k = state === 'play' ? bt / BEAT : 0, by = h * 0.3, R = Math.min(w, h) * 0.07;
    c.lineWidth = 6; c.strokeStyle = th.fg; c.globalAlpha = 0.9; c.beginPath(); c.arc(cx, by, R, 0, 6.283); c.stroke();
    if (state === 'play') { const rr = R * (1 + (1 - k) * 1.6); c.globalAlpha = 0.25 + k * 0.6; c.strokeStyle = th.accent; c.lineWidth = 8; c.beginPath(); c.arc(cx, by, rr, 0, 6.283); c.stroke();
      const hit = Math.min(bt, BEAT - bt) <= PERFECT; c.globalAlpha = hit ? 0.85 : 0.2; c.fillStyle = th.accent; c.beginPath(); c.arc(cx, by, R * 0.8, 0, 6.283); c.fill();
      c.globalAlpha = 1; ui.text(c, 'اضغط!', cx, by, Math.max(16, R * 0.34), hit ? '#1a1430' : th.mut, true); }
    c.globalAlpha = 1;
    // الحبل والعقدة والراية
    const kx = cx - rope * span; // الحبل نحو اليمين ⇒ الفريق أ (يمين الشاشة) يربح
    c.lineCap = 'round'; c.strokeStyle = '#c98b4a'; c.lineWidth = Math.max(10, h * 0.016); c.beginPath(); c.moveTo(w * 0.04, ry); for (let i = 1; i <= 20; i++) { const x = w * 0.04 + (w * 0.92) * i / 20; c.lineTo(x, ry + Math.sin(i * 1.3 + T * 8) * (state === 'play' ? 2 : 0)); } c.stroke();
    c.strokeStyle = '#8a5a2b'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 40; i++) { const x = w * 0.04 + w * 0.92 * i / 40; c.moveTo(x, ry - 6); c.lineTo(x + 8, ry + 6); } c.stroke();
    c.fillStyle = th.bad; c.beginPath(); c.moveTo(kx, ry - h * 0.09); c.lineTo(kx + h * 0.06, ry - h * 0.07); c.lineTo(kx, ry - h * 0.05); c.closePath(); c.fill(); c.strokeStyle = th.fg; c.lineWidth = 3; c.beginPath(); c.moveTo(kx, ry); c.lineTo(kx, ry - h * 0.09); c.stroke();
    c.fillStyle = th.fg; c.beginPath(); c.arc(kx, ry, h * 0.018, 0, 6.283); c.fill();
    // علامتا الفوز
    for (let s = -1; s <= 1; s += 2) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(cx + s * span - 3, ry - 50, 6, 100); }
    // اللاعبون على الحبل: كل فريق في نصفه، يميلون مع الشدّ
    const side = [[], []]; for (const p of list) side[teamOf(p.index)].push(p);
    const ms = Math.max(56, Math.min(h * 0.15, w * 0.09));
    for (let tm = 0; tm < 2; tm++) side[tm].forEach((p, j) => {
      const r = q(p.index), dir = tm ? -1 : 1, x = kx + dir * (ms * 1.1 + j * ms * 0.95), y = ry + ms * 0.08 - (j % 2) * 6; headAt[p.index] = [x, y - ms * 1.0];
      c.globalAlpha = p.connected ? 1 : 0.35; c.save(); c.translate(x, y); c.rotate(dir * (0.12 + (r.moodT > 0 ? 0.1 : 0))); tok(c, p.colorIndex, 0, -ms * 0.3, ms, !p.connected ? 'sad' : r.moodT > 0 ? r.mood : 'happy'); c.restore();
      ui.text(c, p.name, x, y + ms * 0.55, Math.max(14, ms * 0.2), th.fg, true); if (state === 'ready') ui.text(c, r.ready ? '✓' : '…', x, y - ms * 0.95, 22, r.ready ? th.ok : th.mut, true); c.globalAlpha = 1; });
    for (const m of marks) if (m.a >= 0) { const at = headAt[m.i] || [m.x, m.y]; c.globalAlpha = 1 - m.a / 0.8; ui.text(c, m.k === 2 ? 'ممتاز!' : m.k === 1 ? 'جيد' : 'ليس الآن', at[0], at[1] - m.a * 50, Math.max(20, Math.min(30, w * 0.016)), m.c, true); } c.globalAlpha = 1;
    if (state === 'play') ui.progress(c, Math.max(0, 1 - t / ROUND), { y: h - 64, h: 8 });
    if (state === 'ready') {
      ui.bigText(c, 'شدّ الحبل بالإيقاع', { y: h * 0.14 + ui.safe.top * 0.4 });
      const n0 = side[0].filter(p => p.connected).length, n1 = side[1].filter(p => p.connected).length;
      ui.text(c, !n0 || !n1 ? 'تحتاج اللعبة لاعبًا في كل فريق' : 'كل لاعب يضغط «جاهز» — ثم اضغطوا مع النبضة لا بسرعة!', cx, h * 0.84, Math.max(16, Math.min(26, w * 0.02)), !n0 || !n1 ? th.warn : th.fg, true);
      if (readyT > 0) ui.text(c, 'نبدأ بعد ' + ui.num(Math.ceil(12 - readyT)) + ' ثانية', cx, h * 0.9, 18, th.warn, true);
    }
    ui.draw(c);
  }
});
