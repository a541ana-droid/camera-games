// @title الحجلة
// @desc بيوت مرسومة بالطباشير على الشاشة. البيت الذهبي النابض: ادخله بيدك. البيت الذي فيه حجر: لا تلمسه! وبعدها تضيء البيوت واحدًا بعد الآخر فأعِدها بالترتيب. من 1 إلى 4 لاعبين، بلا قراءة.
// @howto ادخل البيت الذهبي ولا تلمس الحجر
// @howto-act hand-zone
// @accent #ffb020
// @engine 0.2
// @capabilities camera.view camera.motion camera.lanes audio haptic hud players.local
// @players 1-4
// @minutes 1
// @age 4
// @play camera
// @style versus
// لاعب واحد: شبكة حركة 2×2 على الشاشة كلها (أربعة بيوت). لاعبان فأكثر: حارات (api.track.lanes) ولكل حارة أربعة بيوت، والبيت من مركز الحركة داخل الحارة.
// البيوت: 0 أعلى يسار، 1 أعلى يمين، 2 أسفل يسار، 3 أسفل يمين (كما تُرى على الشاشة؛ الصورة مرآة فيطابق البيت يدك).
// المراحل: بيت ذهبي وحده (تعليم) ← ذهبي + حجر ← تسلسل قفزات يُحفظ ويُعاد بالترتيب.

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل (بلا عقوبة) / 1 عادي / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let ROUND = 60, ACT = 3, SEQS = 0.65, REPS = 2, SL0 = 2, SMAX = 5; const DROP = 0.5, RES = 1, HOLD = 0.3;
const TONE = [523, 659, 784, 988], TAU = 6.2832;
const NP = 70, P = new Float32Array(NP * 6); // x y vx vy life size
let api, ui, handle = null, state = 'intro', n = 1, cells = [], lanes = [], t = 0, W = 400, H = 700, seed = 0;
let kind = 'one', phase = 'drop', pt = 0, gold = 0, stone = -1, seqN = 0, seqLen = 2, firstDone = false, bump = 0;
const seq = [0, 0, 0, 0, 0, 0, 0];
const score = [0, 0, 0, 0], st = [0, 0, 0, 0], prog = [0, 0, 0, 0], hitC = [-1, -1, -1, -1], hitT = [0, 0, 0, 0], used = [-1, -1, -1, -1];
const fl = new Float32Array(16); // وميض كل بيت في كل حارة (حارة×4 + بيت)
const cur = [], cntR = [], startR = { x: 0, y: 0, w: 200, h: 58 };
for (let i = 0; i < 4; i++) cur.push({ mv: false, q: -1, cx: .5, cy: .5 });

function burst(x, y) { for (let k = 0; k < 12; k++) { let i = 0; for (; i < NP; i++) if (P[i * 6 + 4] <= 0) break; if (i >= NP) return; const a = Math.random() * TAU, s = 60 + Math.random() * 160, o = i * 6; P[o] = x; P[o + 1] = y; P[o + 2] = Math.cos(a) * s; P[o + 3] = Math.sin(a) * s; P[o + 4] = 0.6; P[o + 5] = 2 + Math.random() * 3; } }
function track() {
  if (handle) { handle.stop(); handle = null; }
  if (n === 1) handle = api.track.motion({ grid: [2, 2], threshold: 24 }, d => { cells = d.cells; });
  else handle = api.track.lanes({ count: n, by: 'motion', threshold: 24 }, d => { lanes = d.lanes; });
}
function sample() { // البيت الذي فيه أقوى حركة لكل لاعب (أو −1)
  if (n === 1) {
    let bi = 0, mx = 0; for (let i = 0; i < 4; i++) { const v = cells[i] || 0; if (v > mx) { mx = v; bi = i; } }
    const c = cur[0]; c.mv = mx > 0.05; c.q = c.mv ? bi : -1; c.cx = (bi % 2 + 0.5) / 2; c.cy = ((bi >> 1) + 0.5) / 2;
  } else for (let i = 0; i < n; i++) {
    const L = lanes[i], c = cur[i]; if (!L) { c.mv = false; c.q = -1; continue; }
    c.mv = L.energy > 0.04; c.cx = L.cx; c.cy = L.cy; c.q = c.mv ? (L.cy < 0.5 ? 0 : 2) + (L.cx < (i + 0.5) / n ? 0 : 1) : -1;
  }
}
// هندسة البيوت: حارة لكل لاعب، والبيوت متناظرة حول منتصف الشاشة لتطابق أنصاف صورة الكاميرا
function sq(i, q, o) { const lw = W / n, m = ui.safe.top + Math.max(10, Math.min(W, H) * 0.02), g = Math.min(W, H) * 0.018; o.x = i * lw + g + (q % 2) * lw / 2; o.y = (q >> 1 ? H / 2 + g / 2 : m); o.w = lw / 2 - g * 1.5; o.h = H / 2 - m - g / 2; return o; }
const R0 = { x: 0, y: 0, w: 0, h: 0 };
function mid(i, q) { sq(i, q, R0); return R0; }
function pick(not1, not2) { let z; do { z = Math.floor(Math.random() * 4); } while (z === not1 || z === not2); return z; }
function nextTurn() {
  const f = t / ROUND; kind = f < 0.22 ? 'one' : f < 0.5 ? 'stone' : kind === 'seq' ? 'stone' : 'seq';
  phase = kind === 'seq' ? 'show' : 'drop'; pt = 0; firstDone = false; bump = 0;
  const old = gold; gold = pick(old, -9); stone = kind === 'stone' ? pick(gold, -9) : -1;
  if (kind === 'seq') { seqLen = Math.min(SMAX, SL0 + seqN); seqN++; for (let k = 0; k < seqLen; k++) seq[k] = pick(k ? seq[k - 1] : -9, -9); }
  for (let i = 0; i < 4; i++) { st[i] = 0; prog[i] = 0; hitC[i] = -1; hitT[i] = 0; used[i] = -1; }
  if (kind === 'stone') api.audio.tone({ freq: 140, ms: 120, vol: 0.18, type: 'triangle' }); // صوت خفيف لسقوط الحجر
}
function good(i, pts) { const r = mid(i, kind === 'seq' ? seq[seqLen - 1] : gold), x = r.x + r.w / 2, y = r.y + r.h / 2; st[i] = 1; score[i] += pts; ui.pop(pts, x, y, ui.theme.ok); burst(x, y); api.audio.tone({ freq: 660, ms: 90, slide: 400, vol: 0.18 }); api.haptic(20); }
function hit(i, c) { // لاعب i ثبّت حركته في البيت c مدة HOLD
  if (phase === 'act') {
    if (c === gold) good(i, pt < 1.2 ? 2 : 1);
    else if (c === stone) {
      const r = mid(i, stone); bump = 0.4; api.audio.tone({ freq: 190, ms: 160, vol: 0.2 }); api.haptic(40);
      if (DIFF === 0) return; // سهل: الحجر يهتزّ فقط، بلا عقوبة
      st[i] = 2; score[i] = Math.max(0, score[i] - 1); ui.pop(-1, r.x + r.w / 2, r.y + r.h / 2, ui.theme.bad); ui.flash(ui.theme.bad, 0.18);
    }
  } else if (phase === 'rep') {
    if (c === seq[prog[i]]) {
      fl[i * 4 + c] = 0.45; api.audio.tone({ freq: TONE[c], ms: 160, vol: 0.2 }); prog[i]++;
      if (prog[i] >= seqLen) { good(i, seqLen - 1 + (n > 1 && !firstDone ? 1 : 0)); firstDone = true; }
    } else if (DIFF !== 0) { st[i] = 2; const r = mid(i, c); ui.pop('✗', r.x + r.w / 2, r.y + r.h / 2, ui.theme.warn); api.audio.tone({ freq: 220, ms: 140, vol: 0.16 }); }
  }
}
function judge(i, dt) {
  if (st[i]) return; const q = cur[i].q;
  if (q !== used[i]) used[i] = -1; // ترك البيت ⇒ يُحسب إن عاد إليه
  if (q !== hitC[i]) { hitC[i] = q; hitT[i] = 0; return; }
  if (q < 0 || q === used[i]) return;
  hitT[i] += dt; if (hitT[i] >= HOLD) { used[i] = q; hitT[i] = 0; hit(i, q); }
}
function allDone() { for (let i = 0; i < n; i++) if (!st[i]) return false; return true; }
function endAct() { for (let i = 0; i < n; i++) if (!st[i]) st[i] = 3; } // 3 = انتهى الوقت (بلا عقوبة)
function start() { track(); state = 'count'; t = 0; seqN = 0; kind = 'one'; for (let i = 0; i < 4; i++) score[i] = 0; ui.countdown(3, () => { state = 'play'; nextTurn(); }); }
function layout(w, h) { ui.row(cntR, 4, h * 0.6, 56, undefined, 440); startR.w = Math.min(240, w * 0.7); startR.x = (w - startR.w) / 2; startR.y = h * 0.74; startR.h = 58; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function chalk(c, x, y, w, h, lw) { // مربع طباشير: خطّان متزحزحان قليلًا
  c.strokeStyle = '#ffffff'; c.lineCap = 'round'; c.globalAlpha = 0.78; c.lineWidth = lw; c.strokeRect(x, y, w, h);
  c.globalAlpha = 0.25; c.lineWidth = lw * 0.6; c.beginPath(); c.moveTo(x + 3, y - 2); c.lineTo(x + w - 2, y + 2); c.lineTo(x + w + 2, y + h - 3); c.lineTo(x - 2, y + h + 1); c.closePath(); c.stroke(); c.globalAlpha = 1;
}
function rock(c, x, y, r) { // الحجر: شكل رمادي ثقيل غير منتظم (بلا ملامح)
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y + r * 0.75, r * 1.05, r * 0.3, 0, 0, TAU); c.fill();
  c.fillStyle = '#8d8a9c'; c.beginPath(); c.moveTo(x - r, y + r * 0.35); c.lineTo(x - r * 0.75, y - r * 0.45); c.lineTo(x - r * 0.1, y - r * 0.8); c.lineTo(x + r * 0.7, y - r * 0.55); c.lineTo(x + r, y + r * 0.2); c.lineTo(x + r * 0.55, y + r * 0.7); c.lineTo(x - r * 0.55, y + r * 0.7); c.closePath(); c.fill();
  c.fillStyle = '#b4b1c2'; c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.3); c.lineTo(x - r * 0.1, y - r * 0.6); c.lineTo(x + r * 0.45, y - r * 0.4); c.lineTo(x - r * 0.05, y - r * 0.15); c.closePath(); c.fill();
}
function mark(c, x, y, r, okv) { // ✓ أخضر أو ✗ أحمر داخل دائرة
  const th = ui.theme; c.fillStyle = okv ? th.ok : th.bad; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = th.bg; c.lineWidth = r * 0.22; c.lineCap = 'round'; c.beginPath();
  if (okv) { c.moveTo(x - r * 0.45, y); c.lineTo(x - r * 0.1, y + r * 0.4); c.lineTo(x + r * 0.5, y - r * 0.4); } else { c.moveTo(x - r * 0.4, y - r * 0.4); c.lineTo(x + r * 0.4, y + r * 0.4); c.moveTo(x + r * 0.4, y - r * 0.4); c.lineTo(x - r * 0.4, y + r * 0.4); }
  c.stroke(); c.lineCap = 'butt';
}
function goldSq(c, x, y, w, h, u, k) { const th = ui.theme; c.fillStyle = th.accent; c.globalAlpha = 0.28 + 0.22 * k; rr(c, x, y, w, h, u * 2); c.fill(); c.globalAlpha = 1; c.strokeStyle = th.accent; c.lineWidth = u * (0.9 + 0.5 * k); rr(c, x, y, w, h, u * 2); c.stroke(); }

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; ROUND = Math.round(60 * RS);
    ACT = by3(5, 3, 2.2); SEQS = by3(0.9, 0.65, 0.5); REPS = by3(3.2, 2, 1.5); SL0 = by3(2, 2, 3); SMAX = by3(3, 5, 6);
    api.view.showCamera(true); const s = api.view.size(); W = s.w; H = s.h;
    const nm = api.players.local({ names: ['1'] }).names; n = Math.max(1, Math.min(4, nm.length)); layout(W, H); api.hud.set({ title: 'الحجلة' });
  },
  onResize(w, h) { W = w; H = h; layout(w, h); },
  onTap(x, y) {
    if (state !== 'intro') return;
    for (let i = 0; i < 4; i++) if (ui.hit(cntR[i], x, y)) { n = i + 1; api.audio.beep(700, 50); }
    if (ui.hit(startR, x, y)) start();
  },
  update(dt) {
    seed += dt; bump = Math.max(0, bump - dt); for (let k = 0; k < 16; k++) fl[k] = Math.max(0, fl[k] - dt);
    for (let i = 0; i < NP; i++) { const o = i * 6; if (P[o + 4] > 0) { P[o + 4] -= dt; P[o] += P[o + 2] * dt; P[o + 1] += P[o + 3] * dt; } }
    if (state !== 'play') return;
    t += dt; pt += dt; sample();
    if (phase === 'drop' && pt >= DROP) { phase = 'act'; pt = 0; }
    else if (phase === 'show') {
      const k = Math.floor(pt / SEQS); if (k !== Math.floor((pt - dt) / SEQS) && k < seqLen) api.audio.tone({ freq: TONE[seq[k]], ms: SEQS * 600, vol: 0.18 });
      if (pt >= SEQS * seqLen + 0.3) { phase = 'rep'; pt = 0; api.audio.beep(880, 60, 0.15); }
    } else if (phase === 'act' || phase === 'rep') {
      for (let i = 0; i < n; i++) judge(i, dt);
      if (allDone() || pt >= (phase === 'act' ? ACT : seqLen * REPS + 1.5)) { endAct(); phase = 'res'; pt = 0; }
    } else if (phase === 'res' && pt >= RES) {
      if (t >= ROUND - 2) {
        state = 'over'; if (handle) handle.stop(); const sc = score.slice(0, n), best = Math.max(...sc), w = sc.indexOf(best);
        const ranks = sc.map(v => 1 + sc.filter(o => o > v).length);
        api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 260 }]);
        api.end({ score: best, scores: sc, ranks, text: n === 1 ? 'جمعتَ ' + ui.num(best) + ' نقطة' : 'الفائز: اللاعب ' + ui.num(w + 1) + ' بـ' + ui.num(best) + ' نقطة' });
      } else nextTurn();
    }
    api.hud.set({ score: ui.num(Math.max(...score.slice(0, n))), time: ui.num(Math.max(0, Math.ceil(ROUND - t))) });
  },
  render(c, w, h) {
    const th = ui.theme, u = Math.min(w, h) / 100; W = w; H = h;
    if (state === 'intro') {
      ui.background(c, 1); ui.bigText(c, 'الحجلة', { y: h * 0.16, size: Math.min(h * 0.08, w * 0.13) });
      // رسم توضيحي بلا قراءة: بيت ذهبي = ✓ ، بيت فيه حجر = ✗
      const bs = Math.min(w * 0.3, h * 0.17), gx = w / 2 - bs - u, gy = h * 0.25, k = 0.5 + 0.5 * Math.sin(seed * 5);
      chalk(c, gx, gy, bs, bs, u * 0.8); chalk(c, gx + bs + u * 2, gy, bs, bs, u * 0.8);
      goldSq(c, gx + u, gy + u, bs - u * 2, bs - u * 2, u, k); mark(c, gx + bs / 2, gy + bs + u * 5, u * 3.6, true);
      rock(c, gx + bs * 1.5 + u * 2, gy + bs / 2, bs * 0.26); mark(c, gx + bs * 1.5 + u * 2, gy + bs + u * 5, u * 3.6, false);
      ui.text(c, 'ادخل البيت الذهبي ولا تلمس الحجر', w / 2, h * 0.52, Math.max(15, u * 3.8), th.mut);
      for (let i = 0; i < 4; i++) ui.button(c, cntR[i], ui.num(i + 1), { on: n === i + 1 });
      ui.button(c, startR, 'ابدأ', { primary: true }); ui.draw(c); return;
    }
    ui.background(c, 0.55); // الكاميرا (إن أظهرها المستخدم) خافتة خلف البيوت
    const act = state === 'play', pulse = 0.5 + 0.5 * Math.sin(seed * 7), lw = w / n;
    const showK = phase === 'show' ? Math.floor(pt / SEQS) : -1, showOn = showK >= 0 && showK < seqLen && pt % SEQS < SEQS * 0.78;
    for (let i = 0; i < n; i++) {
      const x0 = i * lw, pc = th.players[i].color;
      for (let q = 0; q < 4; q++) {
        const r = mid(i, q), cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        chalk(c, r.x, r.y, r.w, r.h, Math.max(2, u * 0.7));
        ui.text(c, ui.num(q + 1), r.x + u * 3.5, r.y + u * 4, Math.max(13, u * 3.4), 'rgba(255,255,255,0.4)', true);
        if (!act) continue;
        const isGold = (phase === 'drop' || phase === 'act') && q === gold || showOn && seq[showK] === q;
        if (isGold) { const s = phase === 'drop' ? Math.min(1, pt / DROP) : 1, m = (1 - s) * r.w * 0.3; goldSq(c, r.x + u + m, r.y + u + m * r.h / r.w, r.w - u * 2 - m * 2, r.h - u * 2 - m * 2 * r.h / r.w, u, pulse); }
        if (fl[i * 4 + q] > 0) { c.fillStyle = pc; c.globalAlpha = fl[i * 4 + q] * 1.3; rr(c, r.x + u, r.y + u, r.w - u * 2, r.h - u * 2, u * 2); c.fill(); c.globalAlpha = 1; }
        if (q === stone) {
          const fall = phase === 'drop' ? Math.max(0, 1 - pt / DROP) : 0, sh = bump > 0 ? Math.sin(bump * 60) * u * 1.2 : 0;
          rock(c, cx + sh, cy - fall * fall * r.h * 0.6, Math.min(r.w * 0.36, r.h * 0.24));
        }
        if (hitC[i] === q && hitT[i] > 0 && !st[i]) { c.strokeStyle = pc; c.lineWidth = u * 0.8; c.beginPath(); c.arc(cx, cy, Math.min(r.w, r.h) * 0.36, -1.5708, -1.5708 + TAU * Math.min(1, hitT[i] / HOLD)); c.stroke(); }
      }
      if (i) { c.strokeStyle = th.line; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0, h); c.stroke(); }
      const cu = cur[i]; if (act && cu.mv) { const px = n === 1 ? (cu.q % 2 + 0.5) * w / 2 : cu.cx * w, py = n === 1 ? (cu.q >> 1) * h / 2 + h / 4 : cu.cy * h; c.fillStyle = pc; c.globalAlpha = 0.25; c.beginPath(); c.arc(px, py, u * 7, 0, TAU); c.fill(); c.globalAlpha = 0.6; ui.shape(c, i, px, py, u * 3.2); c.globalAlpha = 1; }
      const chipS = Math.max(34, Math.min(lw * 0.3, u * 6.5));
      ui.playerChip(c, i, x0 + lw / 2, h / 2, { score: score[i], size: chipS, label: n === 1 ? 'أنت' : undefined });
      if (act && kind === 'seq' && phase !== 'drop') { // نقاط التسلسل: كم قفزة بقيت
        const dr = u * 1.6, gap = dr * 3, bx = x0 + lw / 2 - (seqLen - 1) * gap / 2, by = h / 2 + chipS * 0.85;
        for (let k = 0; k < seqLen; k++) { c.beginPath(); c.arc(bx + k * gap, by, dr, 0, TAU); if (phase === 'show' ? k <= showK : k < prog[i]) { c.fillStyle = phase === 'show' ? th.accent : pc; c.fill(); } else { c.strokeStyle = th.mut; c.lineWidth = 2; c.stroke(); } }
      }
      if (act && phase === 'res' && st[i] && st[i] !== 3) { mark(c, x0 + lw / 2, h / 2 - chipS * 1.2, u * 4.2, st[i] === 1); }
    }
    c.fillStyle = th.accent; for (let i = 0; i < NP; i++) { const o = i * 6; if (P[o + 4] <= 0) continue; c.globalAlpha = Math.min(1, P[o + 4] * 2); c.beginPath(); c.arc(P[o], P[o + 1], P[o + 5], 0, TAU); c.fill(); } c.globalAlpha = 1;
    if (act) ui.progress(c, Math.max(0, 1 - t / ROUND));
    ui.draw(c);
  }
});
