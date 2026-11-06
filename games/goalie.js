// @title حارس المرمى
// @desc كرات تنطلق نحو مربعات المرمى، حرّك يدك أو جسمك في المربع قبل أن تصل لتصدّها! لاعب واحد على الشاشة كلها، أو من 2 إلى 4 لاعبين لكل منهم مرماه (حارته).
// @accent #3ddc97
// @engine 0.2
// @capabilities camera.motion camera.lanes audio haptic hud players.local
// لاعب واحد: شبكة حركة 3×3 (الصدّ بنشاط الخلية أو جارتها). لاعبان فأكثر: حارات، لكل حارة ثلاثة ارتفاعات ويُقاس ارتفاع الحركة من مركزها.

const ROUND = 50, MAXB = 18, WIN = 0.5, CELL_ON = 0.06, NEIGH_ON = 0.15, LANE_ON = 0.035, ROW_TOL = 0.2, ROWS = [0.34, 0.55, 0.76];
const NP = 90, P = new Float32Array(NP * 7); // x y vx vy life size kind(0 أخضر،1 أحمر،2 أبيض)
let api, ui, handle = null, state = 'intro', n = 1, cells = [], lanes = [], t = 0, W = 400, H = 700, seed = 0, over = 0;
const B = []; for (let i = 0; i < MAXB; i++) B.push({ s: 0, lane: 0, tgt: 0, age: 0, dur: 1.5, blk: false, ox: .5, oy: .5, tx: .5, ty: .5, fade: 0, rot: 0 }); // s: 0 فارغ،1 طائرة،2 صُدّت،3 هدف
const pk = new Float32Array(9), cur = [], timer = [0, 0, 0, 0], lastT = [-1, -1, -1, -1], saves = [0, 0, 0, 0], goals = [0, 0, 0, 0], streak = [0, 0, 0, 0], glow = [0, 0, 0, 0], glowC = ['', '', '', ''];
const cntR = [], startR = { x: 0, y: 0, w: 200, h: 58 };
for (let i = 0; i < 4; i++) cur.push({ mv: false, cx: .5, cy: .5 });

function spark(x, y, k, nn, spd) { for (let q = 0; q < nn; q++) { let i = 0; for (; i < NP; i++) if (P[i * 7 + 4] <= 0) break; if (i >= NP) return; const a = Math.random() * 6.283, s = (0.3 + Math.random()) * spd, o = i * 7; P[o] = x; P[o + 1] = y; P[o + 2] = Math.cos(a) * s; P[o + 3] = Math.sin(a) * s; P[o + 4] = 0.5 + Math.random() * 0.4; P[o + 5] = 2 + Math.random() * 3.5; P[o + 6] = k; } }
function track() {
  if (handle) { handle.stop(); handle = null; }
  if (n === 1) handle = api.track.motion({ grid: [3, 3], threshold: 24 }, d => { cells = d.cells; });
  else handle = api.track.lanes({ count: n, by: 'motion', threshold: 24 }, d => { lanes = d.lanes; });
}
function slot(lane, tgt) { // موضع الهدف بكسلًا
  if (n === 1) return [((tgt % 3) + 0.5) / 3 * W, (Math.floor(tgt / 3) + 0.5) / 3 * H];
  return [(lane + 0.5) * W / n, ROWS[tgt] * H];
}
function spawn(lane) {
  let b = null; for (const q of B) if (!q.s) { b = q; break; } if (!b) return;
  const cnt = n === 1 ? 9 : 3; let g; do { g = Math.floor(Math.random() * cnt); } while (g === lastT[lane] && cnt > 1); lastT[lane] = g;
  const k = Math.min(1, t / ROUND), p = slot(lane, g), lw = W / n;
  b.s = 1; b.lane = lane; b.tgt = g; b.age = 0; b.dur = 1.75 - 0.55 * k + Math.random() * 0.2; b.blk = false; b.fade = 0; b.rot = Math.random() * 6;
  b.ox = (n === 1 ? 0.5 * W : (lane + 0.5) * lw); b.oy = H * 0.44; b.tx = p[0] + (n === 1 ? 0 : (Math.random() - 0.5) * lw * 0.3); b.ty = p[1];
}
function covered(b) { // هل صُدّت الكرة بحسب حركة اللاعب؟
  if (n === 1) {
    const c = b.tgt, x = c % 3, y = (c / 3) | 0; if (pk[c] >= CELL_ON) return true;
    return (x > 0 && pk[c - 1] >= NEIGH_ON) || (x < 2 && pk[c + 1] >= NEIGH_ON) || (y > 0 && pk[c - 3] >= NEIGH_ON) || (y < 2 && pk[c + 3] >= NEIGH_ON);
  }
  const q = cur[b.lane]; return q.mv && Math.abs(q.cy - ROWS[b.tgt]) <= ROW_TOL;
}
function sample(dt) {
  if (n === 1) for (let i = 0; i < 9; i++) pk[i] = Math.max((cells[i] || 0), pk[i] - dt * 0.3);
  else for (let i = 0; i < n; i++) { const L = lanes[i], c = cur[i]; if (!L) { c.mv = false; continue; } c.mv = L.energy > LANE_ON; c.cx = L.cx; c.cy = L.cy; }
}
function start() { track(); state = 'count'; t = 0; over = 0; for (let i = 0; i < 4; i++) { saves[i] = goals[i] = streak[i] = 0; timer[i] = 0.2 + i * 0.15; lastT[i] = -1; } for (const b of B) b.s = 0; ui.countdown(3, () => { state = 'play'; }); }
function layout(w, h) { ui.row(cntR, 4, h * 0.46, 56, undefined, 440); startR.w = Math.min(240, w * 0.7); startR.x = (w - startR.w) / 2; startR.y = h * 0.62; startR.h = 58; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function finish() {
  state = 'over'; if (handle) handle.stop(); const sc = saves.slice(0, n), best = Math.max(...sc), ranks = sc.map(v => 1 + sc.filter(o => o > v).length);
  api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 260 }]);
  api.end({ score: best, scores: sc, ranks, text: n === 1 ? 'صددتَ ' + ui.num(sc[0]) + ' كرة، وأُحرز عليك ' + ui.num(goals[0]) : 'الفائز: اللاعب ' + ui.num(sc.indexOf(best) + 1) + ' بصدّ ' + ui.num(best) + ' كرة' });
}

defineGame({
  init(a) { api = a; ui = a.ui; const s = api.view.size(); W = s.w; H = s.h; n = Math.max(1, Math.min(4, api.players.local({ names: ['1'] }).names.length)); layout(W, H); api.hud.set({ title: 'حارس المرمى' }); },
  onResize(w, h) { W = w; H = h; layout(w, h); },
  onTap(x, y) {
    if (state !== 'intro') return;
    for (let i = 0; i < 4; i++) if (ui.hit(cntR[i], x, y)) { n = i + 1; api.audio.beep(700, 50); }
    if (ui.hit(startR, x, y)) start();
  },
  update(dt) {
    seed += dt; for (let i = 0; i < NP; i++) { const o = i * 7; if (P[o + 4] > 0) { P[o + 4] -= dt; P[o] += P[o + 2] * dt; P[o + 1] += P[o + 3] * dt; P[o + 3] += 200 * dt; } }
    for (let i = 0; i < 4; i++) glow[i] = Math.max(0, glow[i] - dt * 2.5);
    if (state !== 'play') return;
    t += dt; sample(dt); const k = Math.min(1, t / ROUND);
    if (t < ROUND - 2) for (let i = 0; i < n; i++) { timer[i] -= dt; if (timer[i] <= 0) { spawn(i); timer[i] = 1.45 - 0.6 * k + Math.random() * 0.35; } }
    let live = 0;
    for (const b of B) {
      if (!b.s) continue; b.age += dt; b.rot += dt * 6;
      if (b.s === 1) {
        live++; if (b.dur - b.age <= WIN && !b.blk && covered(b)) b.blk = true;
        if (b.age >= b.dur) {
          const L = b.lane; if (b.blk) { b.s = 2; saves[L]++; streak[L]++; glow[L] = 1; glowC[L] = ui.theme.ok; spark(b.tx, b.ty, 0, 16, 220); ui.pop(1, b.tx, b.ty - H * 0.05, ui.theme.ok); if (streak[L] % 5 === 0) ui.pop('سلسلة ' + ui.num(streak[L]), (n === 1 ? W / 2 : (L + 0.5) * W / n), H * 0.5, ui.theme.warn); api.audio.tone({ freq: 620, ms: 100, slide: 500, vol: 0.2 }); api.haptic(25); }
          else { b.s = 3; goals[L]++; streak[L] = 0; glow[L] = 1; glowC[L] = ui.theme.bad; spark(b.tx, b.ty, 1, 8, 140); api.audio.tone({ freq: 180, ms: 170, vol: 0.2 }); }
          b.age = 0;
        }
      } else if (b.age > 0.6) b.s = 0;
    }
    api.hud.set({ score: ui.num(Math.max(...saves.slice(0, n))), time: ui.num(Math.max(0, Math.ceil(ROUND - t))) });
    if (t >= ROUND) { over += dt; if ((!live && over > 0.7) || over > 3) finish(); }
  },
  render(c, w, h) {
    const th = ui.theme, u = Math.min(w, h) / 100; W = w; H = h;
    ui.background(c, 1);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(30,120,110,0.05)'); g.addColorStop(1, 'rgba(50,190,100,0.30)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (state === 'intro') {
      ui.bigText(c, 'حارس المرمى', { y: h * 0.17, size: Math.min(h * 0.08, w * 0.13) });
      ui.text(c, 'صُدّ الكرات بحركتك قبل أن تصل!', w / 2, h * 0.27, Math.max(16, u * 4.2), th.accent, true);
      ui.text(c, 'حرّك يدك أو جسمك داخل المربع الذي تتجه إليه الكرة', w / 2, h * 0.32, Math.max(14, u * 3.4), th.mut);
      ui.text(c, 'عدد اللاعبين', w / 2, h * 0.42, Math.max(14, u * 3.6), th.fg);
      for (let i = 0; i < 4; i++) ui.button(c, cntR[i], ui.num(i + 1), { on: n === i + 1 });
      ui.button(c, startR, 'ابدأ اللعب', { primary: true });
      ball(c, w / 2, h * 0.84, Math.min(w, h) * 0.07, seed * 3); ui.draw(c); return;
    }
    const lw = w / n, pad = u * 1.2;
    for (let i = 0; i < n; i++) {
      const x0 = i * lw, pc = th.players[i].color;
      c.globalAlpha = 0.5; c.fillStyle = th.bg; rr(c, x0 + pad, pad, lw - pad * 2, h - pad * 2, u * 3); c.fill();
      c.globalAlpha = 0.12; c.strokeStyle = th.fg; c.lineWidth = 1; // شبكة المرمى
      const step = n === 1 ? w / 9 : lw / 6; c.beginPath();
      for (let x = x0 + pad + step; x < x0 + lw - pad; x += step) { c.moveTo(x, pad); c.lineTo(x, h - pad); }
      for (let y = pad + step; y < h - pad; y += step) { c.moveTo(x0 + pad, y); c.lineTo(x0 + lw - pad, y); } c.stroke(); c.globalAlpha = 1;
      c.strokeStyle = n === 1 ? th.accent : pc; c.lineWidth = u * 0.7; c.globalAlpha = 0.5 + glow[i] * 0.5; rr(c, x0 + pad, pad, lw - pad * 2, h - pad * 2, u * 3); c.stroke(); c.globalAlpha = 1;
      if (glow[i] > 0) { c.fillStyle = glowC[i]; c.globalAlpha = glow[i] * 0.22; rr(c, x0 + pad, pad, lw - pad * 2, h - pad * 2, u * 3); c.fill(); c.globalAlpha = 1; }
      if (n > 1) { c.strokeStyle = th.fg; c.globalAlpha = 0.1; c.setLineDash([u, u * 1.5]); for (let r = 0; r < 3; r++) { c.beginPath(); c.moveTo(x0 + pad * 2, ROWS[r] * h); c.lineTo(x0 + lw - pad * 2, ROWS[r] * h); c.stroke(); } c.setLineDash([]); c.globalAlpha = 1; }
      if (state === 'play' && n > 1 && cur[i].mv) { c.fillStyle = pc; c.globalAlpha = 0.28; c.beginPath(); c.arc(cur[i].cx * w, cur[i].cy * h, u * 7, 0, 7); c.fill(); c.globalAlpha = 0.55; c.beginPath(); c.arc(cur[i].cx * w, cur[i].cy * h, u * 3.4, 0, 7); c.fill(); c.globalAlpha = 1; }
      ui.playerChip(c, i, x0 + lw / 2, ui.safe.top + Math.max(u * 7, 30), { score: saves[i], size: Math.max(34, Math.min(lw * 0.34, u * 6.5)), label: n === 1 ? 'أنت' : undefined });
    }
    if (n === 1 && state === 'play') for (let i = 0; i < 9; i++) { const a = pk[i]; if (a < 0.05) continue; c.globalAlpha = Math.min(0.2, a); c.fillStyle = th.accent; rr(c, (i % 3) * w / 3 + pad, ((i / 3) | 0) * h / 3 + pad, w / 3 - pad * 2, h / 3 - pad * 2, u * 3); c.fill(); } c.globalAlpha = 1;
    const base = Math.min(lw * 0.2, h * 0.12, u * 13);
    for (const b of B) { // علامة الهبوط أولًا، ثم الكرات
      if (b.s !== 1) continue; const k = Math.min(1, b.age / b.dur), rem = b.dur - b.age;
      c.strokeStyle = b.blk ? th.ok : th.warn; c.lineWidth = u * 0.7; c.globalAlpha = 0.25 + 0.55 * k; c.beginPath(); c.arc(b.tx, b.ty, base * (1.55 - 0.45 * k), 0, 7); c.stroke();
      if (rem < WIN) { c.globalAlpha = 0.14 + 0.1 * Math.sin(seed * 20); c.fillStyle = b.blk ? th.ok : th.warn; c.beginPath(); c.arc(b.tx, b.ty, base * 1.1, 0, 7); c.fill(); } c.globalAlpha = 1;
    }
    for (const b of B) {
      if (!b.s) continue; const k = Math.min(1, b.age / b.dur);
      if (b.s === 1) { const e = k * k * (0.4 + 0.6 * k), x = b.ox + (b.tx - b.ox) * e, y = b.oy + (b.ty - b.oy) * e; for (let q = 3; q > 0; q--) { const e2 = Math.max(0, e - q * 0.05); c.globalAlpha = 0.12; ball(c, b.ox + (b.tx - b.ox) * e2, b.oy + (b.ty - b.oy) * e2, base * (0.3 + 0.7 * e2), b.rot, 1); } c.globalAlpha = 1; ball(c, x, y, base * (0.3 + 0.7 * e), b.rot); }
      else if (b.s === 2) { c.globalAlpha = Math.max(0, 1 - b.age / 0.5); ball(c, b.tx, b.ty - b.age * h * 0.35, base * (1 - b.age * 0.8), b.rot); c.globalAlpha = 1; }
      else { c.globalAlpha = Math.max(0, 1 - b.age / 0.6); ball(c, b.tx, b.ty, base * (1 + b.age * 0.1), b.rot); c.globalAlpha = 1; }
    }
    for (let i = 0; i < NP; i++) { const o = i * 7; if (P[o + 4] <= 0) continue; c.globalAlpha = Math.min(1, P[o + 4] * 2); c.fillStyle = P[o + 6] === 0 ? th.ok : P[o + 6] === 1 ? th.bad : th.fg; c.beginPath(); c.arc(P[o], P[o + 1], P[o + 5], 0, 7); c.fill(); } c.globalAlpha = 1;
    if (state === 'play' || state === 'count') ui.progress(c, Math.max(0, 1 - t / ROUND));
    if (state === 'play' && n === 1) ui.text(c, 'أُحرز عليك ' + ui.num(goals[0]), w / 2, h - ui.safe.bottom - u * 2, Math.max(14, u * 3.4), th.mut);
    ui.draw(c);
  }
});

function ball(c, x, y, r, rot, ghost) { // كرة قدم: دائرة بيضاء ونقاط داكنة تدور
  c.fillStyle = ghost ? '#ffffff' : '#f4f1ff'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); if (ghost) return;
  c.fillStyle = '#2a2547'; c.beginPath(); for (let k = 0; k < 5; k++) { const a = rot + k * 1.2566; c.lineTo(x + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36); } c.closePath(); c.fill();
  for (let k = 0; k < 5; k++) { const a = rot + k * 1.2566 + 0.63; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, r * 0.17, 0, 7); c.fill(); }
  c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = Math.max(1, r * 0.06); c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
}
