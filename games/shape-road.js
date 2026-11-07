// @title طريق الأشكال
// @desc سباق على طريق طويل: كل لاعب شكله الملوّن، يوجّهه بإمالة جواله (أو بالعصا) ويجمع الأشكال على الطريق. شكلك نفسه بنقطتين، والنجمة الذهبية بثلاث. الزرّ يسرّعك، واحذر الحواجز فهي تبطئك.
// @howto أمِل جوالك واجمع الأشكال
// @howto-act tilt
// @accent #3ddc97
// @engine 0.5
// @capabilities players.pads audio hud
// @pads 1-8 free 1v1 2v2 teams
// @series no
// @players 1-8
// @minutes 2
// @age 4
// @play pads
// @style versus teams
// كل جوال: ميل يمين/يسار (tilt) يوجّه، والعصا بديل دائم (iOS قد يرفض إذن الميل). الزرّ A مضغوطًا = أسرع (يتقدّم شكلك على الشاشة فيصل الأشكال قبل غيره).
// الأشكال المجموعة بيضاء محايدة (دائرة/مثلث/مربع/معيّن) واللاعبون وحدهم بألوانهم؛ الحاجز شريط أحمر وأبيض.

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل (بلا حواجز تقريبًا) / 1 عادي / 2 صعب.
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
let ROUND = 120, VX = 0.55, V0 = 0.28, GAP = 0.32, BAR = 0.14, GRAB = 1; const NI = 48, BASE = 0.74, FRONT = 0.42, NP = 90, TAU = 6.2832;
let api, ui, state = 'ready', t = 0, left = ROUND, W = 1280, H = 720, readyT = 0, ended = false, spawnT = 0, scroll = 0;
const pl = []; // لكل مقعد: {x, y, vx, score, ready, stun, glow}
const items = []; for (let i = 0; i < NI; i++) items.push({ on: false, x: 0, y: 0, k: 0, rot: 0 }); // k: 0..3 شكل، 4 نجمة ذهبية، 5 حاجز
const P = new Float32Array(NP * 6); // جسيمات: x y vx vy life colour
const RD = { x0: 0, x1: 1, y0: 0, y1: 1 }; // الطريق بالبكسل
const GEM = '#e9f6ff', GOLD = '#ffc145';

function road(w, h) { const side = w > h * 1.2 ? 0.17 : 0.05; RD.x0 = w * side; RD.x1 = w * (1 - side); RD.y0 = ui.safe.top + Math.max(54, h * 0.08); RD.y1 = h - 8; }
function seat(i) { if (!pl[i]) pl[i] = { x: 0.5, y: BASE, vx: 0, score: 0, ready: false, stun: 0, glow: 0 }; const p = pl[i]; p.x = 0.12 + ((i * 3) % 8) / 7 * 0.76; p.y = BASE; p.vx = 0; p.stun = 0; return p; }
function burst(x, y, n, ci) { for (let k = 0; k < n; k++) { let i = 0; for (; i < NP; i++) if (P[i * 6 + 4] <= 0) break; if (i >= NP) return; const a = Math.random() * TAU, v = 60 + Math.random() * 200, o = i * 6; P[o] = x; P[o + 1] = y; P[o + 2] = Math.cos(a) * v; P[o + 3] = Math.sin(a) * v; P[o + 4] = 0.35 + Math.random() * 0.4; P[o + 5] = ci; } }
function spawn() {
  let it = null; for (const q of items) if (!q.on) { it = q; break; } if (!it) return;
  const r = Math.random(); it.k = r < BAR ? 5 : r < BAR + 0.07 ? 4 : Math.floor(Math.random() * 4);
  it.x = 0.06 + Math.random() * 0.88; it.y = -0.06; it.rot = Math.random() * TAU; it.on = true;
  for (const q of items) if (q !== it && q.on && q.y < 0.08 && Math.abs(q.x - it.x) < 0.12) { it.on = false; return; } // لا تكدّس عند المدخل
}
const teamOn = () => api.teams.on;
function teamScore(tm) { let s = 0, n = 0; for (const p of api.pads.list) if (api.teams.of(p.index) === tm && pl[p.index]) { s += pl[p.index].score; n++; } return n ? Math.round(s / n) : 0; } // متوسط الفريق: عادل حين يختلف العدد
function steer(s) { if (Math.abs(s.x) > 0.08) return s.x; const tx = (s.tx || 0) * 1.8; return Math.abs(tx) < 0.08 ? 0 : Math.max(-1, Math.min(1, tx)); }
function begin() {
  state = 'count'; t = 0; left = ROUND; scroll = 0; spawnT = 0; for (const it of items) it.on = false;
  for (const p of api.pads.list) seat(p.index).score = 0;
  api.pads.controls({ stick: true, a: 'أسرع', b: '', tilt: true }); api.pads.say(-1, 'أمِل جوالك واجمع الأشكال!');
  ui.countdown(3, () => { state = 'play'; });
}
function finish() {
  state = 'over'; ended = true; const scores = [], list = api.pads.list; for (let i = 0; i < 8; i++) scores[i] = pl[i] ? pl[i].score : 0;
  let best = -1, who = ''; for (const p of list) if (scores[p.index] > best) { best = scores[p.index]; who = p.name; }
  const ts = teamOn() ? [teamScore(0), teamScore(1)] : undefined;
  const text = ts ? (ts[0] === ts[1] ? 'تعادل الفريقان!' : 'فاز ' + api.teams.names[ts[0] > ts[1] ? 0 : 1]) : list.length ? 'أكثر من جمع: ' + who + ' (' + ui.num(best) + ')' : 'انتهى السباق';
  api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 120 }, { freq: 1046, ms: 260 }]);
  api.end({ score: best < 0 ? 0 : best, scores, teamScores: ts, text });
}
function gem(c, k, x, y, r, rot) { // شكل يُجمع: أبيض محايد بحدّ رفيع، يدور ببطء
  c.save(); c.translate(x, y); c.rotate(k === 0 ? 0 : rot * 0.3); c.beginPath();
  if (k === 0) c.arc(0, 0, r, 0, TAU);
  else if (k === 1) { c.moveTo(0, -r * 1.1); c.lineTo(r * 1.05, r * 0.75); c.lineTo(-r * 1.05, r * 0.75); c.closePath(); }
  else if (k === 2) c.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
  else if (k === 3) { c.moveTo(0, -r * 1.15); c.lineTo(r * 0.9, 0); c.lineTo(0, r * 1.15); c.lineTo(-r * 0.9, 0); c.closePath(); }
  else { for (let q = 0; q < 10; q++) { const rr = q % 2 ? r * 0.5 : r * 1.25, a = q * 0.6283 - 1.5708; q ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
  c.fillStyle = k === 4 ? GOLD : GEM; c.fill(); c.lineWidth = Math.max(2, r * 0.14); c.strokeStyle = k === 4 ? '#fff3c4' : 'rgba(20,16,40,0.55)'; c.stroke(); c.restore();
}
function barrier(c, x, y, wd, ht) { c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(x - wd / 2, y - ht / 2, wd, ht, ht * 0.3); c.fill(); c.fillStyle = '#ff5d73'; const n = 4, sw = wd / (n * 2); for (let q = 0; q < n; q++) { c.beginPath(); c.moveTo(x - wd / 2 + sw * (q * 2 + 0.5), y + ht / 2); c.lineTo(x - wd / 2 + sw * (q * 2 + 1.5), y - ht / 2); c.lineTo(x - wd / 2 + sw * (q * 2 + 2.3), y - ht / 2); c.lineTo(x - wd / 2 + sw * (q * 2 + 1.3), y + ht / 2); c.closePath(); c.fill(); } }

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; ROUND = Math.round(120 * RS); left = ROUND;
    VX = by3(0.45, 0.55, 0.65); V0 = by3(0.2, 0.28, 0.34); GAP = by3(0.42, 0.32, 0.26); BAR = by3(0.05, 0.14, 0.2); GRAB = by3(1.5, 1, 0.85);
    const s = api.view.size(); W = s.w; H = s.h; road(W, H);
    for (const p of api.pads.list) seat(p.index);
    api.pads.onJoin(p => { const q = pl[p.index] || seat(p.index); if (state === 'ready') q.ready = false; api.pads.say(p.index, state === 'play' ? 'أمِل جوالك واجمع الأشكال!' : 'اضغط «جاهز»'); });
    api.pads.onLeave(p => { if (pl[p.index]) pl[p.index].ready = false; });
    api.pads.controls({ stick: true, a: 'جاهز', b: '', tilt: true }); api.pads.say(-1, 'اضغط «جاهز» حين تستعد');
    api.hud.set({ title: 'طريق الأشكال' });
  },
  onResize(w, h) { W = w; H = h; road(w, h); },
  update(dt) {
    const list = api.pads.list;
    for (let i = 0; i < NP; i++) { const o = i * 6; if (P[o + 4] <= 0) continue; P[o + 4] -= dt; P[o] += P[o + 2] * dt; P[o + 1] += P[o + 3] * dt; P[o + 2] *= 0.95; P[o + 3] *= 0.95; }
    if (state === 'ready') { // كلٌّ يضغط «جاهز»؛ نبدأ حين يجهز الجميع، أو بعد 12 ثانية إن جهز أحد
      let on = 0, rd = 0;
      for (const p of list) { if (!p.connected) continue; on++; const q = pl[p.index] || seat(p.index); if (api.pads.input(p.index).aDown && !q.ready) { q.ready = true; api.audio.beep(660 + p.index * 60, 70, 0.2); api.pads.vibrate(p.index, 30); } if (q.ready) rd++; }
      readyT = rd ? readyT + dt : 0; if (on && (rd === on || readyT > 12)) begin();
      return;
    }
    if (state !== 'play') return;
    t += dt; left = Math.max(0, ROUND - t); const k = t / ROUND, v = V0 * (1 + 0.45 * k); scroll += v * dt;
    spawnT -= dt; if (spawnT <= 0 && left > 3) { spawnT = GAP * (1 - 0.3 * k) * (0.7 + Math.random() * 0.6); spawn(); }
    const rw = RD.x1 - RD.x0, rh = RD.y1 - RD.y0;
    for (const it of items) if (it.on) { it.y += v * dt; it.rot += dt * 2; if (it.y > 1.08) it.on = false; }
    for (const p of list) {
      const q = pl[p.index] || seat(p.index), s = api.pads.input(p.index); q.stun = Math.max(0, q.stun - dt); q.glow = Math.max(0, q.glow - dt);
      const tv = p.connected ? steer(s) * VX : 0; q.vx += (tv - q.vx) * Math.min(1, dt * 8); q.x = Math.min(0.97, Math.max(0.03, q.x + q.vx * dt));
      const fast = s.a && q.stun <= 0 && p.connected, ty = fast ? FRONT : BASE; q.y += (ty - q.y) * Math.min(1, dt * (fast ? 1.4 : 0.9));
      if (!p.connected) continue;
      for (const it of items) {
        if (!it.on) continue; const dx = (q.x - it.x) * rw, dy = (q.y - it.y) * rh, R = Math.min(rw, rh) * (it.k === 5 ? 0.06 : 0.065) * (it.k === 5 ? 1 : GRAB);
        if (it.k === 5 ? Math.abs(dx) < rw * 0.06 && Math.abs(dy) < rh * 0.04 : dx * dx + dy * dy < R * R) {
          it.on = false; const x = RD.x0 + it.x * rw, y = RD.y0 + it.y * rh;
          if (it.k === 5) { if (q.stun > 0) continue; q.stun = 0.8; q.y = Math.min(0.92, q.y + 0.12); q.vx *= 0.3; burst(x, y, 10, 2); api.audio.tone({ freq: 160, ms: 180, vol: 0.2, type: 'triangle' }); api.pads.vibrate(p.index, 120); ui.pop('آه!', x, y - 20, ui.theme.warn); continue; }
          const pts = it.k === 4 ? 3 : it.k === (p.colorIndex % 4) ? 2 : 1; q.score += pts; q.glow = 0.4;
          ui.pop(pts, x, y - 22, p.color); burst(x, y, pts > 1 ? 18 : 9, it.k === 4 ? 1 : 0); api.audio.beep(it.k === 4 ? 1320 : 760 + pts * 160, 60, 0.18); api.pads.vibrate(p.index, pts > 1 ? 60 : 20);
        }
      }
    }
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { // تدافع لطيف بين الأشكال
      const a = pl[list[i].index], b = pl[list[j].index]; if (!a || !b) continue; const dx = (b.x - a.x) * rw, dy = (b.y - a.y) * rh, d = Math.hypot(dx, dy), r = Math.min(rw, rh) * 0.09;
      if (d > 0 && d < r) { const f = (r - d) / d * 0.5; a.x -= dx * f / rw; b.x += dx * f / rw; a.y -= dy * f / rh * 0.3; b.y += dy * f / rh * 0.3; }
    }
    api.hud.set({ time: ui.num(Math.ceil(left)), score: teamOn() ? ui.num(teamScore(0)) + ' : ' + ui.num(teamScore(1)) : '' });
    if (left <= 0 && !ended) finish();
  },
  render(c, w, h) {
    W = w; H = h; const th = ui.theme, T = ui.t, list = api.pads.list, rw = RD.x1 - RD.x0, rh = RD.y1 - RD.y0, u = Math.min(rw, rh) / 100, ms = Math.max(26, u * 5.2);
    ui.background(c);
    // الطريق: إسفلت، حافّتان، خطوط متقطّعة تنزل مع السرعة
    c.fillStyle = '#1d3b33'; c.fillRect(RD.x0 - u * 6, RD.y0, rw + u * 12, rh);
    c.fillStyle = '#2a2740'; c.beginPath(); c.roundRect(RD.x0, RD.y0, rw, rh, u * 2); c.fill();
    const seg = rh / 6, off = (scroll * rh) % seg;
    c.fillStyle = 'rgba(255,255,255,0.22)'; for (let l = 1; l < 4; l++) { const x = RD.x0 + rw * l / 4 - u * 0.5; for (let y = RD.y0 - seg + off; y < RD.y1; y += seg) { const y0 = Math.max(RD.y0, y), y1 = Math.min(RD.y1, y + seg * 0.5); if (y1 > y0) c.fillRect(x, y0, u, y1 - y0); } }
    for (const sd of [RD.x0, RD.x1]) for (let y = RD.y0 - seg + off, q = 0; y < RD.y1; y += seg / 2, q++) { const y0 = Math.max(RD.y0, y), y1 = Math.min(RD.y1, y + seg / 2); if (y1 > y0) { c.fillStyle = q % 2 ? '#ffffff' : '#ff5d73'; c.fillRect(sd - u * 0.9, y0, u * 1.8, y1 - y0); } }
    if (state === 'play' && left < 3.5) { // خط النهاية يقترب
      const fy = RD.y0 + rh * Math.min(1, (3.5 - left) / 3.5) * BASE, sq = rw / 16; for (let q = 0; q < 16; q++) for (let r = 0; r < 2; r++) { c.fillStyle = (q + r) % 2 ? '#ffffff' : '#141024'; c.fillRect(RD.x0 + q * sq, fy + r * sq * 0.5, sq, sq * 0.5); }
    }
    if (state !== 'ready') {
      for (const it of items) { if (!it.on) continue; const x = RD.x0 + it.x * rw, y = RD.y0 + it.y * rh; if (y < RD.y0 - 20) continue;
        if (it.k === 5) barrier(c, x, y, rw * 0.11, rh * 0.045);
        else { if (it.k === 4) { c.globalAlpha = 0.25; c.fillStyle = GOLD; c.beginPath(); c.arc(x, y, ms * 0.9, 0, TAU); c.fill(); c.globalAlpha = 1; } gem(c, it.k, x, y, ms * 0.55, it.rot); } }
      for (const p of list) { const q = pl[p.index]; if (!q) continue; const x = RD.x0 + q.x * rw, y = RD.y0 + q.y * rh, tm = api.teams.of(p.index);
        c.globalAlpha = p.connected ? 1 : 0.35;
        c.fillStyle = 'rgba(255,255,255,0.10)'; c.beginPath(); c.moveTo(x - ms * 0.35, y + ms * 0.3); c.lineTo(x + ms * 0.35, y + ms * 0.3); c.lineTo(x, y + ms * 1.6); c.closePath(); c.fill(); // ذيل خفيف
        if (tm >= 0) { c.strokeStyle = api.teams.colors[tm]; c.lineWidth = 4; c.beginPath(); c.arc(x, y, ms * 0.66, 0, TAU); c.stroke(); }
        if (q.glow > 0) { c.strokeStyle = '#ffffff'; c.globalAlpha = q.glow * 2; c.lineWidth = 3; c.beginPath(); c.arc(x, y, ms * (0.8 + (0.4 - q.glow)), 0, TAU); c.stroke(); c.globalAlpha = p.connected ? 1 : 0.35; }
        ui.shape(c, p.colorIndex, x + (q.stun > 0 && !ui.still ? Math.sin(T * 50) * 3 : 0), y, ms * 0.45);
        ui.text(c, p.name, x, y - ms * 0.85, Math.max(13, ms * 0.36), th.fg, true); c.globalAlpha = 1; }
    }
    for (let i = 0; i < NP; i++) { const o = i * 6; if (P[o + 4] <= 0) continue; c.globalAlpha = Math.min(1, P[o + 4] * 2); c.fillStyle = P[o + 5] === 1 ? GOLD : P[o + 5] === 2 ? '#ff5d73' : '#ffffff'; c.fillRect(P[o] - 3, P[o + 1] - 3, 6, 6); } c.globalAlpha = 1;
    const top = ui.safe.top + 4; // لوحة النقاط
    if (teamOn() && state !== 'ready') { for (let tm = 0; tm < 2; tm++) { const bw = Math.min(260, w * 0.3), x = tm ? w / 2 - bw - 12 : w / 2 + 12; c.fillStyle = api.teams.colors[tm]; c.globalAlpha = 0.92; c.beginPath(); c.roundRect(x, top, bw, 44, 22); c.fill(); c.globalAlpha = 1; ui.text(c, api.teams.names[tm] + '  ' + ui.num(teamScore(tm)), x + bw / 2, top + 22, 20, th.bg, true); } }
    else if (state !== 'ready') { const n = list.length, cw = Math.min(170, (w - 40) / Math.max(1, n)); list.forEach((p, k) => { const q = pl[p.index]; ui.playerChip(c, p.colorIndex, w / 2 + (k - (n - 1) / 2) * cw, top + 22, { label: p.name, score: q ? q.score : 0, size: Math.min(40, cw * 0.3) }); }); }
    if (state === 'play') ui.progress(c, left / ROUND, { y: RD.y0 - 10, h: 8 });
    if (state === 'ready') {
      ui.background(c, 0.6); ui.bigText(c, 'طريق الأشكال', { y: h * 0.18 });
      ui.text(c, 'أمِل جوالك لتوجّه شكلك (أو العصا)، والزرّ يسرّعك', w / 2, h * 0.27, Math.max(16, Math.min(26, w * 0.02)), th.mut);
      const gx = w / 2, gy = h * 0.36, gs = Math.max(16, Math.min(28, h * 0.03)); for (let k = 0; k < 5; k++) gem(c, k, gx + (k - 2) * gs * 3, gy, gs * 0.5, 0); // ما يُجمع
      barrier(c, gx + 3 * gs * 3, gy, gs * 2.2, gs * 0.8); mark(c, gx + 3 * gs * 3, gy + gs * 1.4, gs * 0.45);
      const n = Math.max(1, list.length), sz = Math.min(150, w * 0.8 / n), y = h * 0.58;
      list.forEach((p, k) => { const q = pl[p.index], x = w / 2 + (k - (n - 1) / 2) * sz * 1.15, rd = q && q.ready; c.globalAlpha = p.connected ? 1 : 0.35;
        ui.shape(c, p.colorIndex, x, y, sz * 0.3 * (rd && !ui.still ? 1 + 0.06 * Math.sin(T * 8) : 1)); ui.text(c, p.name, x, y + sz * 0.5, Math.max(15, sz * 0.15), th.fg, true);
        ui.text(c, !p.connected ? 'انقطع' : rd ? '✓ جاهز' : 'اضغط «جاهز»', x, y + sz * 0.7, Math.max(13, sz * 0.12), rd ? th.ok : th.mut, rd); c.globalAlpha = 1; });
      if (!list.length) ui.text(c, 'بانتظار الجوالات…', w / 2, h * 0.58, 24, th.mut);
      else if (readyT > 0) ui.text(c, 'نبدأ بعد ' + ui.num(Math.ceil(12 - readyT)) + ' ثانية', w / 2, h * 0.88, 20, th.warn, true);
    }
    ui.draw(c);
  }
});
function mark(c, x, y, r) { c.save(); c.strokeStyle = ui.theme.bad; c.lineWidth = r * 0.35; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x + r, y + r); c.moveTo(x + r, y - r); c.lineTo(x - r, y + r); c.stroke(); c.restore(); } // ✗ تحت الحاجز في شاشة «جاهز»
