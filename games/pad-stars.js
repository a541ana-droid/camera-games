// @title صيد النجوم
// @desc كل لاعب يحرّك شكله الملوّن بعصا جواله ويجمع النجوم المتساقطة في الساحة. الزرّ يعطي اندفاعة سريعة. النجمة الكبيرة بثلاث نقاط!
// @howto حرّك شكلك بالعصا واجمع النجوم
// @howto-act joystick
// @accent #ffc145
// @engine 0.5
// @capabilities players.pads audio hud
// @pads 1-8 free 1v1 2v2 teams
// @series no
// @players 1-8
// @minutes 1
// @age 4
// @play pads
// @style versus teams
// مرجع لعبة جوالات: api.pads (القائمة، المدخلات، الانضمام والمغادرة، رسائل الجوال)، api.teams، ولون كل لاعب وشكله (ui.shape).

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل / 1 عادي (سلوك ما قبلها حرفيًا) / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let ROUND = 60, GRAB = 1; const SPEED = 0.42, DASH = 2.4, DASHT = 0.28, DASHCD = 1.4, NS = 7, NP = 90;
let api, ui, state = 'ready', t = 0, left = ROUND, W = 800, H = 600, readyT = 0, ended = false;
const pl = []; // لكل مقعد: {x,y,vx,vy,score,dash,cd,ready,look,face,mood,moodT}
const stars = []; for (let i = 0; i < NS; i++) stars.push({ x: 0, y: 0, big: false, t: 0, on: false });
const P = new Float32Array(NP * 6); // جسيمات: x y vx vy life colour
const SKY = []; for (let i = 0; i < 40; i++) SKY.push([(i * 0.381 + 0.05) % 1, (i * 0.617 + 0.11) % 1, 0.5 + (i % 3) * 0.5]);
const COL = ['#ffe680', '#ffffff', '#ffc145'];
const A = { x0: 0, y0: 0, x1: 1, y1: 1 }; // الساحة بالبكسل

function arena(w, h) { A.x0 = w * 0.04; A.x1 = w * 0.96; A.y0 = ui.safe.top + Math.max(56, h * 0.09); A.y1 = h - Math.max(70, h * 0.08); }
function seat(i) { // يُنشأ مرة واحدة لكل مقعد ثم يُعاد استعماله
  if (!pl[i]) pl[i] = { x: 0.5, y: 0.5, vx: 0, vy: 0, score: 0, dash: 0, cd: 0, ready: false, lx: 0, ly: 0, mood: 'happy', moodT: 0 };
  const p = pl[i], a = (i / 8) * 6.283; p.x = 0.5 + Math.cos(a) * 0.3; p.y = 0.55 + Math.sin(a) * 0.28; p.vx = p.vy = 0; return p;
}
function spawn(s) { s.x = 0.08 + Math.random() * 0.84; s.y = 0.1 + Math.random() * 0.8; s.big = Math.random() < 0.14; s.t = 0; s.on = true; }
function burst(x, y, n, ci) {
  for (let k = 0; k < n; k++) { let i = 0; for (; i < NP; i++) if (P[i * 6 + 4] <= 0) break; if (i >= NP) return;
    const a = Math.random() * 6.283, v = 60 + Math.random() * 220, o = i * 6; P[o] = x; P[o + 1] = y; P[o + 2] = Math.cos(a) * v; P[o + 3] = Math.sin(a) * v; P[o + 4] = 0.4 + Math.random() * 0.5; P[o + 5] = ci; }
}
const teamOn = () => api.teams.on;
function teamScore(tm) { let s = 0; for (const p of api.pads.list) if (api.teams.of(p.index) === tm && pl[p.index]) s += pl[p.index].score; return s; }
function begin() {
  state = 'count'; t = 0; left = ROUND; for (const p of api.pads.list) { seat(p.index).score = 0; }
  for (const s of stars) spawn(s);
  api.pads.controls({ stick: true, a: 'اندفع' }); api.pads.say(-1, 'اجمع النجوم!');
  ui.countdown(3, () => { state = 'play'; });
}
function finish() {
  state = 'over'; ended = true; const scores = [], list = api.pads.list; for (let i = 0; i < 8; i++) scores[i] = pl[i] ? pl[i].score : 0;
  let text = '', best = -1, who = '';
  for (const p of list) if (scores[p.index] > best) { best = scores[p.index]; who = p.name; }
  const ts = teamOn() ? [teamScore(0), teamScore(1)] : undefined;
  if (ts) text = ts[0] === ts[1] ? 'تعادل الفريقان بالنجوم!' : 'فاز ' + api.teams.names[ts[0] > ts[1] ? 0 : 1] + ' بـ' + ui.num(Math.max(ts[0], ts[1])) + ' نجمة';
  else text = list.length ? 'أكثر من جمع: ' + who + ' (' + ui.num(best) + ')' : 'انتهت الجولة';
  api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 120 }, { freq: 1046, ms: 260 }]);
  api.end({ score: list.reduce((s, p) => s + (pl[p.index] ? pl[p.index].score : 0), 0), scores, teamScores: ts, text });
}

function tok(c, i, x, y, sz, mood) { // اللاعب = لونه وشكله فقط (DESIGN.md §2)، بلا وجه: cheer نبضة خفيفة، wow حلقة بيضاء
  const r = sz * 0.4 * (mood === 'cheer' && !ui.still ? 1 + 0.08 * Math.sin(ui.t * 10) : 1); ui.shape(c, i, x, y, r);
  if (mood === 'wow') { c.save(); c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = Math.max(2, r * 0.12); c.beginPath(); c.arc(x, y, r * 1.4, 0, 6.283); c.stroke(); c.restore(); }
}
defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; ROUND = Math.round(60 * RS); left = ROUND; GRAB = by3(1.45, 1, 0.85); const s = api.view.size(); W = s.w; H = s.h; arena(W, H);
    for (const p of api.pads.list) seat(p.index);
    api.pads.onJoin(p => { const q = pl[p.index] || seat(p.index); if (state === 'ready') q.ready = false; api.pads.say(p.index, state === 'play' ? 'ادخل واجمع النجوم!' : 'اضغط «جاهز»'); });
    api.pads.onLeave(p => { if (pl[p.index]) pl[p.index].ready = false; });
    api.pads.controls({ stick: true, a: 'جاهز' }); api.pads.say(-1, 'اضغط «جاهز» حين تستعد');
    api.hud.set({ title: 'صيد النجوم' });
  },
  onResize(w, h) { W = w; H = h; arena(w, h); },
  update(dt) {
    const list = api.pads.list;
    if (state === 'ready') { // كل لاعب يضغط «جاهز»؛ تبدأ الجولة حين يجهز الجميع، أو بعد 12 ثانية إن جهز أحد
      let on = 0, rd = 0;
      for (const p of list) { if (!p.connected) continue; on++; const q = pl[p.index] || seat(p.index); if (api.pads.input(p.index).aDown && !q.ready) { q.ready = true; api.audio.beep(660 + p.index * 60, 70, 0.2); api.pads.vibrate(p.index, 30); } if (q.ready) rd++; }
      readyT = rd ? readyT + dt : 0;
      if (on && (rd === on || readyT > 12)) begin();
    }
    for (let i = 0; i < NP; i++) { const o = i * 6; if (P[o + 4] <= 0) continue; P[o + 4] -= dt; P[o] += P[o + 2] * dt; P[o + 1] += P[o + 3] * dt; P[o + 2] *= 0.95; P[o + 3] = P[o + 3] * 0.95 + 120 * dt; }
    if (state !== 'play') return;
    t += dt; left = Math.max(0, ROUND - t);
    const aw = A.x1 - A.x0, ah = A.y1 - A.y0, k = ah / aw; // السرعة متساوية بالبكسل في الاتجاهين
    for (const p of list) {
      const q = pl[p.index] || seat(p.index), s = api.pads.input(p.index);
      q.cd = Math.max(0, q.cd - dt); q.dash = Math.max(0, q.dash - dt); q.moodT = Math.max(0, q.moodT - dt);
      if (s.aDown && q.cd <= 0 && p.connected) { q.dash = DASHT; q.cd = DASHCD; api.audio.tone({ freq: 300, ms: 140, slide: 500, vol: 0.12, type: 'triangle' }); }
      const m = (q.dash > 0 ? DASH : 1) * SPEED, tx = s.x * m * k, ty = s.y * m;
      q.vx += (tx - q.vx) * Math.min(1, dt * 10); q.vy += (ty - q.vy) * Math.min(1, dt * 10);
      q.x = Math.min(0.97, Math.max(0.03, q.x + q.vx * dt)); q.y = Math.min(0.95, Math.max(0.05, q.y + q.vy * dt));
      if (Math.abs(s.x) + Math.abs(s.y) > 0.15) { q.lx = s.x; q.ly = s.y; }
    }
    // تدافع لطيف بين اللاعبين
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = pl[list[i].index], b = pl[list[j].index]; if (!a || !b) continue; const dx = (b.x - a.x) * aw, dy = (b.y - a.y) * ah, d = Math.hypot(dx, dy), r = Math.min(aw, ah) * 0.09;
      if (d > 0 && d < r) { const f = (r - d) / d * 0.5; a.x -= dx * f / aw; a.y -= dy * f / ah; b.x += dx * f / aw; b.y += dy * f / ah; }
    }
    for (const st of stars) {
      st.t += dt; if (!st.on) continue;
      for (const p of list) {
        const q = pl[p.index]; if (!q || !p.connected) continue;
        const dx = (q.x - st.x) * aw, dy = (q.y - st.y) * ah, R = Math.min(aw, ah) * (st.big ? 0.085 : 0.07) * GRAB;
        if (dx * dx + dy * dy < R * R) {
          const v = st.big ? 3 : 1, sx = A.x0 + st.x * aw, sy = A.y0 + st.y * ah; q.score += v; q.mood = 'cheer'; q.moodT = 0.6;
          ui.pop(v, sx, sy - 20, p.color); burst(sx, sy, st.big ? 24 : 12, st.big ? 2 : 0); api.audio.beep(st.big ? 1320 : 880 + (q.score % 5) * 80, 60, 0.18); api.pads.vibrate(p.index, st.big ? 80 : 25);
          spawn(st); break;
        }
      }
    }
    let hs = ''; if (teamOn()) hs = ui.num(teamScore(0)) + ' : ' + ui.num(teamScore(1));
    api.hud.set({ time: ui.num(Math.ceil(left)), score: hs });
    if (left <= 0 && !ended) finish();
  },
  render(c, w, h) {
    W = w; H = h; const th = ui.theme, T = ui.t, list = api.pads.list, aw = A.x1 - A.x0, ah = A.y1 - A.y0, ms = Math.max(54, Math.min(aw, ah) * 0.16);
    ui.background(c);
    for (const s of SKY) { c.globalAlpha = 0.25 + 0.25 * Math.sin(T * s[2] + s[0] * 9); c.fillStyle = '#ffffff'; c.fillRect(s[0] * w, s[1] * h, 2, 2); } c.globalAlpha = 1;
    // أرضية الساحة
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.beginPath(); c.roundRect(A.x0, A.y0, aw, ah, 28); c.fill(); c.strokeStyle = 'rgba(255,193,69,0.35)'; c.lineWidth = 3; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 1; c.beginPath(); for (let i = 1; i < 6; i++) { c.moveTo(A.x0 + aw * i / 6, A.y0 + 10); c.lineTo(A.x0 + aw * i / 6, A.y1 - 10); } for (let i = 1; i < 4; i++) { c.moveTo(A.x0 + 10, A.y0 + ah * i / 4); c.lineTo(A.x1 - 10, A.y0 + ah * i / 4); } c.stroke();
    if (state === 'play' || state === 'count' || state === 'over') {
      for (const st of stars) { if (!st.on) continue; const x = A.x0 + st.x * aw, y = A.y0 + st.y * ah + Math.sin(T * 3 + st.x * 9) * 4, r = Math.min(aw, ah) * (st.big ? 0.05 : 0.032) * Math.min(1, st.t * 4);
        c.globalAlpha = 0.25; c.fillStyle = st.big ? '#ffc145' : '#ffe680'; c.beginPath(); c.arc(x, y, r * 1.9, 0, 6.283); c.fill(); c.globalAlpha = 1;
        c.save(); c.translate(x, y); c.rotate(T * (st.big ? 1.5 : 0.8)); c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r, a = k * 0.6283 - 1.5708; k ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath();
        c.fillStyle = st.big ? '#ffb020' : '#ffe680'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff6cc'; c.stroke(); c.restore(); }
      for (const p of list) { const q = pl[p.index]; if (!q) continue; const x = A.x0 + q.x * aw, y = A.y0 + q.y * ah, tm = api.teams.of(p.index);
        c.globalAlpha = p.connected ? 1 : 0.35;
        if (tm >= 0) { c.strokeStyle = api.teams.colors[tm]; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y + ms * 0.46, ms * 0.42, ms * 0.12, 0, 0, 6.283); c.stroke(); }
        if (q.dash > 0) { c.globalAlpha = 0.3; tok(c, p.colorIndex, x - q.vx * aw * 0.06, y - q.vy * ah * 0.06, ms, 'wow'); c.globalAlpha = 1; }
        tok(c, p.colorIndex, x, y, ms, !p.connected ? 'sad' : q.moodT > 0 ? q.mood : q.dash > 0 ? 'wow' : 'happy');
        ui.text(c, p.name, x, y - ms * 0.78, Math.max(14, ms * 0.24), th.fg, true); c.globalAlpha = 1; }
    }
    for (let i = 0; i < NP; i++) { const o = i * 6; if (P[o + 4] <= 0) continue; c.globalAlpha = Math.min(1, P[o + 4] * 2); c.fillStyle = COL[P[o + 5] | 0]; c.fillRect(P[o] - 3, P[o + 1] - 3, 6, 6); } c.globalAlpha = 1;
    // لوحة النقاط أعلى الساحة
    const top = ui.safe.top + 6;
    if (teamOn()) { for (let tm = 0; tm < 2; tm++) { const bw = Math.min(260, w * 0.3), x = tm ? w / 2 - bw - 12 : w / 2 + 12; c.fillStyle = api.teams.colors[tm]; c.globalAlpha = 0.9; c.beginPath(); c.roundRect(x, top, bw, 44, 22); c.fill(); c.globalAlpha = 1; ui.text(c, api.teams.names[tm] + '  ' + ui.num(teamScore(tm)), x + bw / 2, top + 22, 20, th.bg, true); } }
    else if (state !== 'ready') { const n = list.length, cw = Math.min(190, (w - 40) / Math.max(1, n)); list.forEach((p, k) => { const q = pl[p.index]; ui.playerChip(c, p.colorIndex, w / 2 + (k - (n - 1) / 2) * cw, top + 22, { label: p.name, score: q ? q.score : 0, size: 40 }); }); }
    if (state === 'play') ui.progress(c, left / ROUND, { y: A.y1 + 14, h: 8 });
    if (state === 'ready') {
      ui.background(c, 0.55); ui.bigText(c, 'صيد النجوم', { y: h * 0.2 }); ui.text(c, 'حرّك شكلك بالعصا واجمع النجوم. الزرّ = اندفاعة.', w / 2, h * 0.29, Math.max(16, Math.min(26, w * 0.02)), th.mut);
      const n = Math.max(1, list.length), sz = Math.min(150, w * 0.8 / n), y = h * 0.55;
      list.forEach((p, k) => { const q = pl[p.index], x = w / 2 + (k - (n - 1) / 2) * sz * 1.15, rd = q && q.ready;
        c.globalAlpha = p.connected ? 1 : 0.35;
        tok(c, p.colorIndex, x, y, sz * 0.8, !p.connected ? 'sad' : rd ? 'cheer' : 'happy'); ui.text(c, p.name, x, y + sz * 0.62, Math.max(15, sz * 0.15), th.fg, true);
        ui.text(c, !p.connected ? 'انقطع' : rd ? '✓ جاهز' : 'اضغط «جاهز»', x, y + sz * 0.82, Math.max(13, sz * 0.12), rd ? th.ok : th.mut, rd);
        c.globalAlpha = 1; });
      if (!list.length) ui.text(c, 'بانتظار الجوالات…', w / 2, h * 0.55, 24, th.mut);
      else if (readyT > 0) ui.text(c, 'نبدأ بعد ' + ui.num(Math.ceil(12 - readyT)) + ' ثانية', w / 2, h * 0.86, 20, th.warn, true);
    }
    ui.draw(c);
  }
});
