// @title متاهة الميلان
// @desc أمِل الجوال لتدحرج الكرة عبر المتاهة إلى الهدف الأخضر، واجمع النجوم وتجنّب الثقوب. ثلاث مراحل قصيرة في 60 ثانية، ومن 1 إلى 4 لاعبين يتناوبون على الجوال.
// @howto أمِل الجوال لتصل الكرة للهدف
// @howto-act tilt
// @accent #ff5cc8
// @engine 0.2
// @capabilities motion.device audio haptic hud players.local
// يحتاج مستشعر حركة. الميل x يمين/يسار و y أمام/خلف من -1 إلى 1 (كما في كرة الميزان). الدور: لكل لاعب 60 ثانية، ثم يُمرَّر الجوال.

const TAU = 6.2832, ROUND = 60, ACC = 26, FRIC = 2.4, VMAX = 6.5, BR = 0.3;
const LV = [
  ['#######', '#S...*#', '#.###.#', '#.#...#', '#.#.###', '#...*.#', '###.#.#', '#G..O.#', '#######'],
  ['#######', '#S...*#', '#.###.#', '#.*#..#', '#.##.##', '#..O..#', '#.....#', '#*.#.G#', '#######'],
  ['#######', '#S.*..#', '#.##.##', '#..O..#', '##.##.#', '#..O..#', '#.##.##', '#*..G.#', '#######']
];
const COLS = 7, ROWS = 9;
let api, ui, state = 'intro', count = 1, turn = 0, lvl = 0, left = ROUND, W = 400, H = 700, names = [];
let bx = 1.5, by = 1.5, vx = 0, vy = 0, tx = 0, ty = 0, sx = 0, sy = 0, fallT = 0, btw = 0, stars = 0, done = 0, t = 0, got = {}, hudT = '';
const tscore = [], dones = [], starsT = [], trail = [], parts = [], PN = 90; let pi = 0;
const cntR = [], startR = { x: 0, y: 0, w: 220, h: 58 };
for (let i = 0; i < 14; i++) trail.push({ x: 0, y: 0 });
for (let i = 0; i < PN; i++) parts.push({ x: 0, y: 0, vx: 0, vy: 0, l: 0, c: '#fff', s: 3 });

function geo(w, h) { const top = ui.safe.top + 66, aw = w - 16, ah = h - top - 70, c = Math.max(20, Math.min(aw / COLS, ah / ROWS)); return { c, x0: (w - c * COLS) / 2, y0: top + (ah - c * ROWS) / 2 }; }
function cellAt(l, x, y) { return LV[l][y] ? LV[l][y][x] : '#'; }
function find(l, ch) { const o = []; LV[l].forEach((r, y) => { for (let x = 0; x < COLS; x++) if (r[x] === ch) o.push([x + 0.5, y + 0.5]); }); return o; }
function emit(cx, cy, col, n, spd, size) { for (let k = 0; k < n; k++) { const p = parts[pi], a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.7); pi = (pi + 1) % PN; p.x = cx; p.y = cy; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.l = 0.5 + Math.random() * 0.5; p.c = col; p.s = size * (0.6 + Math.random() * 0.8); } }
function toPx(x, y) { const g = geo(W, H); return [g.x0 + x * g.c, g.y0 + y * g.c]; }
function respawn() { const s = find(lvl, 'S')[0]; bx = s[0]; by = s[1]; vx = vy = 0; fallT = 0; }
function loadLevel(l) { lvl = l; got = {}; respawn(); state = 'play'; for (const q of trail) { q.x = bx; q.y = by; } }
function layout(w, h) { ui.row(cntR, 4, h * 0.46, 54, 8, 420); startR.w = Math.min(w * 0.7, 280); startR.x = (w - startR.w) / 2; startR.y = h * 0.62; }
function beginTurn() {
  left = ROUND; stars = 0; done = 0; state = 'count'; loadLevel(0); state = 'count';
  api.hud.set({ title: count > 1 ? 'دور اللاعب ' + ui.num(turn + 1) : 'متاهة الميلان', score: 'نجوم 0', time: String(ROUND) });
  ui.countdown(3, () => { state = 'play'; });
}
function turnScore(complete) { return done * 100 + stars * 25 + (complete ? Math.ceil(Math.max(0, left)) * 3 : 0); }
function endTurn(complete) {
  tscore[turn] = turnScore(complete); dones[turn] = done; starsT[turn] = stars;
  if (turn + 1 < count) { state = 'pass'; api.audio.melody([{ freq: 523, ms: 100 }, { freq: 659, ms: 100 }, { freq: 784, ms: 160 }]); return; }
  state = 'over'; const sc = tscore.slice(0, count), best = Math.max(...sc), ranks = sc.map(s => 1 + sc.filter(o => o > s).length);
  api.end({ score: best, scores: sc, ranks, text: count === 1 ? 'أنجزتَ ' + ui.num(done) + ' من 3 مراحل وجمعتَ ' + ui.num(stars) + ' نجوم' : 'الفائز: اللاعب ' + ui.num(sc.indexOf(best) + 1) + ' بـ ' + ui.num(best) + ' نقطة' });
}
function collide() { // كرة (دائرة) ضد خلايا الجدران
  const cx0 = Math.floor(bx), cy0 = Math.floor(by);
  for (let y = cy0 - 1; y <= cy0 + 1; y++) for (let x = cx0 - 1; x <= cx0 + 1; x++) {
    if (cellAt(lvl, x, y) !== '#') continue;
    const nx = Math.max(x, Math.min(x + 1, bx)), ny = Math.max(y, Math.min(y + 1, by)); let dx = bx - nx, dy = by - ny, d = Math.hypot(dx, dy);
    if (d >= BR) continue;
    if (d < 1e-4) { dx = bx - (x + 0.5); dy = by - (y + 0.5); d = Math.hypot(dx, dy) || 1; }
    dx /= d; dy /= d; const pen = BR - d; bx += dx * pen; by += dy * pen; const vn = vx * dx + vy * dy;
    if (vn < 0) { vx -= (1 + 0.35) * vn * dx; vy -= (1 + 0.35) * vn * dy; if (vn < -2.5) { api.audio.tone({ freq: 220, ms: 40, vol: 0.12, type: 'triangle' }); const p = toPx(nx, ny); emit(p[0], p[1], '#b9a8ff', 3, 60, 2.5); } }
  }
}

defineGame({
  init(a) {
    api = a; ui = a.ui; const s = api.view.size(); W = s.w; H = s.h; names = api.players.local({ names: ['1'] }).names; count = Math.max(1, Math.min(4, names.length));
    api.sensors.motion(d => { tx = d.x; ty = d.y; }); layout(W, H); api.hud.set({ title: 'متاهة الميلان' });
  },
  onResize(w, h) { W = w; H = h; layout(w, h); },
  onTap(x, y) {
    if (state === 'intro') { for (let i = 0; i < 4; i++) if (ui.hit(cntR[i], x, y)) { count = i + 1; api.audio.beep(700, 50); } if (ui.hit(startR, x, y)) { turn = 0; beginTurn(); } }
    else if (state === 'pass') { turn++; beginTurn(); }
  },
  update(dt) {
    t += dt; for (let k = 0; k < PN; k++) { const p = parts[k]; if (p.l > 0) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; } }
    if (state === 'between') { btw -= dt; if (btw <= 0) loadLevel(lvl + 1); return; }
    if (state !== 'play') return;
    left -= dt;
    sx += (tx - sx) * Math.min(1, dt * 10); sy += (ty - sy) * Math.min(1, dt * 10);
    const dx = Math.abs(sx) < 0.04 ? 0 : sx, dy = Math.abs(sy) < 0.04 ? 0 : sy;
    if (fallT > 0) { fallT -= dt; if (fallT <= 0) respawn(); }
    else {
      for (let s = 0; s < 3; s++) {
        const h = dt / 3; vx += dx * ACC * h; vy += dy * ACC * h; const f = Math.max(0, 1 - FRIC * h); vx *= f; vy *= f; const sp = Math.hypot(vx, vy); if (sp > VMAX) { vx *= VMAX / sp; vy *= VMAX / sp; }
        bx += vx * h; by += vy * h; collide();
      }
      for (let i = trail.length - 1; i > 0; i--) { trail[i].x = trail[i - 1].x; trail[i].y = trail[i - 1].y; } trail[0].x = bx; trail[0].y = by;
      const k = (x, y) => x + ',' + y;
      for (const p of find(lvl, '*')) if (!got[k(p[0], p[1])] && Math.hypot(bx - p[0], by - p[1]) < 0.5) {
        got[k(p[0], p[1])] = 1; stars++; const q = toPx(p[0], p[1]); ui.pop(1, q[0], q[1] - 20, ui.theme.warn); emit(q[0], q[1], '#ffd24a', 14, 150, 4); api.audio.tone({ freq: 660, ms: 120, slide: 360, vol: 0.25 }); api.haptic(25);
      }
      for (const p of find(lvl, 'O')) if (Math.hypot(bx - p[0], by - p[1]) < 0.4) {
        fallT = 0.5; vx = vy = 0; bx = p[0]; by = p[1]; left -= 3; const q = toPx(p[0], p[1]); ui.pop('−3 ث', q[0], q[1] - 30, ui.theme.bad); ui.flash(ui.theme.bad, 0.2); api.audio.tone({ freq: 400, ms: 300, slide: -300, vol: 0.25 }); api.haptic(60);
      }
      const gl = find(lvl, 'G')[0];
      if (Math.hypot(bx - gl[0], by - gl[1]) < 0.42) {
        done++; const q = toPx(gl[0], gl[1]); emit(q[0], q[1], '#3ddc97', 24, 220, 5); emit(q[0], q[1], '#ffffff', 10, 160, 3); api.audio.melody([{ freq: 523, ms: 90 }, { freq: 659, ms: 90 }, { freq: 784, ms: 150 }]); api.haptic(50); ui.flash(ui.theme.ok, 0.25);
        if (lvl + 1 >= LV.length) { endTurn(true); return; }
        state = 'between'; btw = 1.2; ui.pop('أحسنت!', W / 2, H * 0.35, ui.theme.ok);
      }
    }
    const ht = String(Math.max(0, Math.ceil(left))); if (ht !== hudT) { hudT = ht; api.hud.set({ time: ht, score: 'نجوم ' + ui.num(stars) }); }
    if (left <= 0) endTurn(false);
  },
  render(ctx, w, h) {
    const th = ui.theme; W = w; H = h;
    if (state === 'intro') {
      ui.background(ctx); ui.bigText(ctx, 'متاهة الميلان', { y: h * 0.17 }); ui.text(ctx, 'أمِل الجوال لتدحرج الكرة إلى الهدف', w / 2, h * 0.27, Math.min(19, w * 0.052), th.fg);
      ui.text(ctx, 'اجمع النجوم وتجنّب الثقوب — ثلاث مراحل في 60 ثانية', w / 2, h * 0.32, Math.min(15, w * 0.04), th.mut);
      ui.text(ctx, 'عدد اللاعبين (يتناوبون على الجوال)', w / 2, h * 0.41, 16, th.fg, true);
      for (let i = 0; i < 4; i++) ui.button(ctx, cntR[i], ui.num(i + 1), { on: count === i + 1 });
      ui.button(ctx, startR, 'ابدأ', { primary: true }); ui.draw(ctx); return;
    }
    if (state === 'pass') {
      ui.background(ctx); ui.bigText(ctx, 'انتهى الدور', { y: h * 0.2 }); ui.text(ctx, 'نقاطك', w / 2, h * 0.3, 16, th.mut); ui.bigText(ctx, ui.num(tscore[turn]), { y: h * 0.4, color: th.accent });
      ui.playerChip(ctx, turn + 1, w / 2, h * 0.58, { label: 'الدور التالي', size: 52, active: true }); ui.text(ctx, 'مرّر الجوال إلى اللاعب ' + ui.num(turn + 2), w / 2, h * 0.68, 18, th.fg, true);
      ui.text(ctx, 'المس الشاشة حين تصبح جاهزًا', w / 2, h * 0.76, 15, th.mut); ui.draw(ctx); return;
    }
    ui.background(ctx);
    const g = geo(w, h), c = g.c, bw = c * COLS, bh = c * ROWS, ox = sx * 4, oy = sy * 4, rad = c * 0.2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(g.x0 - 6 + ox, g.y0 - 2 + oy, bw + 12, bh + 12, c * 0.35); ctx.fill();
    const fl = ctx.createLinearGradient(0, g.y0, 0, g.y0 + bh); fl.addColorStop(0, '#231d47'); fl.addColorStop(1, '#171335'); ctx.fillStyle = fl; ctx.beginPath(); ctx.roundRect(g.x0 - 4, g.y0 - 4, bw + 8, bh + 8, c * 0.3); ctx.fill();
    ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    const M = LV[lvl];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = M[y][x], px = g.x0 + x * c, py = g.y0 + y * c;
      if (ch === '#') {
        ctx.fillStyle = '#3b3270'; ctx.beginPath(); ctx.roundRect(px + 1, py + 1, c - 2, c - 2, rad); ctx.fill();
        ctx.fillStyle = '#4d4390'; ctx.beginPath(); ctx.roundRect(px + 3, py + 3, c - 6, c * 0.45, rad * 0.7); ctx.fill();
      } else { ctx.globalAlpha = 0.5; ctx.fillStyle = '#2c2558'; ctx.beginPath(); ctx.roundRect(px + 2, py + 2, c - 4, c - 4, rad * 0.6); ctx.fill(); ctx.globalAlpha = 1; }
    }
    const s0 = find(lvl, 'S')[0], sp = toPx(s0[0], s0[1]); ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sp[0], sp[1], c * 0.3, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    for (const p of find(lvl, 'O')) { // ثقب
      const q = toPx(p[0], p[1]); ctx.fillStyle = th.bad; ctx.globalAlpha = 0.28; ctx.beginPath(); ctx.arc(q[0], q[1], c * 0.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#05030c'; ctx.beginPath(); ctx.arc(q[0], q[1], c * 0.38, 0, TAU); ctx.fill(); ctx.strokeStyle = th.bad; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(q[0] + c * 0.04, q[1] + c * 0.05, c * 0.22, 0, TAU); ctx.fill();
    }
    const gl = find(lvl, 'G')[0], gp = toPx(gl[0], gl[1]), pulse = 1 + Math.sin(t * 4) * 0.08; // الهدف
    ctx.fillStyle = th.ok; ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(gp[0], gp[1], c * 0.55 * pulse, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(gp[0], gp[1], c * 0.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.setLineDash([c * 0.12, c * 0.1]); ctx.lineDashOffset = -t * 12; ctx.beginPath(); ctx.arc(gp[0], gp[1], c * 0.3, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(gp[0], gp[1], c * 0.08, 0, TAU); ctx.fill();
    for (const p of find(lvl, '*')) { // نجوم
      if (got[p[0] + ',' + p[1]]) continue; const q = toPx(p[0], p[1]), R = c * 0.3 * (1 + Math.sin(t * 5 + p[0]) * 0.08);
      ctx.fillStyle = th.warn; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(q[0], q[1], R * 1.5, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -1.5708 + k * 0.62832 + t * 0.6, rr = k % 2 ? R * 0.45 : R; ctx.lineTo(q[0] + Math.cos(a) * rr, q[1] + Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
    }
    if (state === 'play' || state === 'between' || state === 'count') { // الكرة وأثرها
      const k = fallT > 0 ? Math.max(0.05, fallT / 0.5) : 1, rr = c * BR * k;
      for (let i = trail.length - 1; i > 1; i--) { const q = toPx(trail[i].x, trail[i].y); ctx.globalAlpha = 0.22 * (1 - i / trail.length); ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(q[0], q[1], rr * (1 - i / trail.length * 0.6), 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
      const b = toPx(bx, by);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(b[0] + rr * 0.25 - sx * rr * 0.2, b[1] + rr * 0.35 - sy * rr * 0.2, rr, 0, TAU); ctx.fill();
      ctx.fillStyle = th.accent; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(b[0], b[1], rr * 1.6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(b[0], b[1], rr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(b[0] - rr * 0.1, b[1] - rr * 0.15, rr * 0.7, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(b[0] - rr * 0.38, b[1] - rr * 0.42, rr * 0.2, 0, TAU); ctx.fill();
    }
    for (let k = 0; k < PN; k++) { const p = parts[k]; if (p.l <= 0) continue; ctx.globalAlpha = Math.min(1, p.l * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    ui.playerChip(ctx, turn, w / 2, ui.safe.top + 26, { label: count > 1 ? 'اللاعب ' + ui.num(turn + 1) : 'المرحلة ' + ui.num(lvl + 1) + ' من 3', score: ui.num(turnScore(false)), active: true, size: 38 });
    for (let i = 0; i < LV.length; i++) { ctx.beginPath(); ctx.arc(w / 2 + (i - 1) * 18, ui.safe.top + 54, 5, 0, TAU); if (i <= lvl) { ctx.fillStyle = i < done ? th.ok : th.accent; ctx.fill(); } else { ctx.strokeStyle = th.mut; ctx.lineWidth = 2; ctx.stroke(); } }
    if (state === 'play' || state === 'between') ui.progress(ctx, left / ROUND);
    if (state === 'between') ui.bigText(ctx, 'المرحلة ' + ui.num(lvl + 2), { y: h * 0.5, color: th.accent });
    ui.draw(ctx);
  }
});
