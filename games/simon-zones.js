// @title سيمون يقول
// @desc من 1 إلى 4 لاعبين. تظهر تعليمة حركة لمنطقة من الشاشة: إن بدأت بـ«سيمون يقول» فتحرّك فيها، وإن لم تبدأ بها فلا تتحرك أبدًا! بلا صوت عالٍ.
// @accent #ffb020
// @engine 0.2
// @capabilities camera.motion camera.lanes audio haptic hud players.local
// لاعب واحد: شبكة حركة 2×2 على الشاشة كلها. لاعبان فأكثر: حارات (api.track.lanes) ويُحدَّد الربع من مركز الحركة داخل الحارة.
// المناطق: 0 أعلى يسار، 1 أعلى يمين، 2 أسفل يسار، 3 أسفل يمين (كما تُرى على الشاشة)، 4 الجسم كله، 5 تجمّد.

const ROUND = 50, SHOW = 0.8, ACT = 2.4, RES = 0.9, GRACE = 0.3;
const ACTION = ['حرّك يدك يسار فوق', 'حرّك يدك يمين فوق', 'حرّك يدك يسار تحت', 'حرّك يدك يمين تحت', 'حرّك جسمك كله', 'تجمّد مكانك'];
const NP = 60, P = new Float32Array(NP * 6); // x y vx vy life size
let api, ui, handle = null, state = 'intro', n = 1, names = ['1'], cells = [], lanes = [], t = 0, W = 400, H = 700, seed = 0;
let phase = 'show', pt = 0, zone = 0, says = true, turn = 0, lastZ = -1;
let score = [0, 0, 0, 0], hold = [0, 0, 0, 0], mvT = [0, 0, 0, 0], st = [0, 0, 0, 0]; // st: 0 قيد الحكم، 1 نجح، 2 أخطأ
const cur = [], cntR = [], startR = { x: 0, y: 0, w: 200, h: 58 };
for (let i = 0; i < 4; i++) cur.push({ mv: false, all: false, q: -1, cx: .5, cy: .5 });

function burst(x, y, col) { for (let k = 0; k < 10; k++) { let i = 0; for (; i < NP; i++) if (P[i * 6 + 4] <= 0) break; if (i >= NP) return; const a = Math.random() * 6.283, s = 60 + Math.random() * 140, o = i * 6; P[o] = x; P[o + 1] = y; P[o + 2] = Math.cos(a) * s; P[o + 3] = Math.sin(a) * s; P[o + 4] = 0.6; P[o + 5] = 2 + Math.random() * 3; } }
function track() {
  if (handle) { handle.stop(); handle = null; }
  if (n === 1) handle = api.track.motion({ grid: [2, 2], threshold: 24 }, d => { cells = d.cells; });
  else handle = api.track.lanes({ count: n, by: 'motion', threshold: 24 }, d => { lanes = d.lanes; });
}
function sample() { // يملأ cur[] من آخر قياس
  if (n === 1) {
    let bi = 0, mx = 0, cnt = 0; for (let i = 0; i < 4; i++) { const v = cells[i] || 0; if (v > mx) { mx = v; bi = i; } if (v > 0.05) cnt++; }
    const c = cur[0]; c.mv = mx > 0.05; c.all = cnt >= 3 || mx > 0.3; c.q = c.mv ? bi : -1; c.cx = (bi % 2 + 0.5) / 2; c.cy = (Math.floor(bi / 2) + 0.5) / 2;
  } else for (let i = 0; i < n; i++) {
    const L = lanes[i], c = cur[i]; if (!L) { c.mv = c.all = false; c.q = -1; continue; }
    c.mv = L.energy > 0.04; c.all = L.energy > 0.13; c.cx = L.cx; c.cy = L.cy; c.q = c.mv ? (L.cy < 0.5 ? 0 : 2) + (L.cx < (i + 0.5) / n ? 0 : 1) : -1;
  }
}
function nextTurn() {
  turn++; let z; do { z = Math.floor(Math.random() * 6); } while (z === lastZ); lastZ = z; zone = z;
  says = turn <= 2 || Math.random() < 0.65; phase = 'show'; pt = 0;
  for (let i = 0; i < 4; i++) { hold[i] = 0; mvT[i] = 0; st[i] = 0; }
}
function lanePos(i) { return { x: (i + 0.5) * W / n, w: W / n }; }
function judge(i, dt) {
  if (st[i]) return; const c = cur[i], lp = lanePos(i), py = H * 0.74;
  const good = zone < 4 ? c.mv && c.q === zone : zone === 4 ? c.all : false;
  if (pt > GRACE && c.mv) mvT[i] += dt;
  if (says) {
    if (zone === 5) return; // التجمّد يُحكم عند نهاية النافذة
    if (pt > GRACE && good) hold[i] += dt;
    if (hold[i] >= 0.3) { const q = pt < 1.2 ? 2 : 1; st[i] = 1; score[i] += q; ui.pop(q, lp.x, py, ui.theme.ok); burst(lp.x, py * 0.9, 0); api.audio.tone({ freq: 660, ms: 90, slide: 400, vol: 0.18 }); }
  } else if (mvT[i] >= 0.45) { st[i] = 2; score[i] = Math.max(0, score[i] - 1); ui.pop(-1, lp.x, py, ui.theme.bad); ui.flash(ui.theme.bad, 0.18); api.audio.tone({ freq: 190, ms: 160, vol: 0.2 }); api.haptic(40); }
}
function endAct() {
  for (let i = 0; i < n; i++) {
    if (st[i]) continue; const lp = lanePos(i);
    if (says && zone === 5 && mvT[i] <= 0.35) { st[i] = 1; score[i]++; ui.pop(1, lp.x, H * 0.74, ui.theme.ok); burst(lp.x, H * 0.56, 0); }
    else if (!says && mvT[i] < 0.45) { st[i] = 1; score[i]++; ui.pop(1, lp.x, H * 0.74, ui.theme.ok); }
    else if (says) { st[i] = 2; ui.pop('أبطأ!', lp.x, H * 0.74, ui.theme.warn); }
  }
}
function start() { track(); state = 'count'; t = 0; turn = 0; lastZ = -1; score = [0, 0, 0, 0]; ui.countdown(3, () => { state = 'play'; nextTurn(); }); }
function layout(w, h) { ui.row(cntR, 4, h * 0.46, 56, undefined, 440); startR.w = Math.min(240, w * 0.7); startR.x = (w - startR.w) / 2; startR.y = h * 0.62; startR.h = 58; }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

defineGame({
  init(a) { api = a; ui = a.ui; const s = api.view.size(); W = s.w; H = s.h; const nm = api.players.local({ names: ['1'] }).names; names = nm; n = Math.max(1, Math.min(4, nm.length)); layout(W, H); api.hud.set({ title: 'سيمون يقول' }); },
  onResize(w, h) { W = w; H = h; layout(w, h); },
  onTap(x, y) {
    if (state !== 'intro') return;
    for (let i = 0; i < 4; i++) if (ui.hit(cntR[i], x, y)) { n = i + 1; api.audio.beep(700, 50); }
    if (ui.hit(startR, x, y)) start();
  },
  update(dt) {
    seed += dt; for (let i = 0; i < NP; i++) { const o = i * 6; if (P[o + 4] > 0) { P[o + 4] -= dt; P[o] += P[o + 2] * dt; P[o + 1] += P[o + 3] * dt; } }
    if (state !== 'play') return;
    t += dt; pt += dt; sample();
    if (phase === 'show' && pt >= SHOW) { phase = 'act'; pt = 0; }
    else if (phase === 'act') { for (let i = 0; i < n; i++) judge(i, dt); if (pt >= ACT) { endAct(); phase = 'res'; pt = 0; } }
    else if (phase === 'res' && pt >= RES) {
      if (t >= ROUND - 2) {
        state = 'over'; if (handle) handle.stop(); const sc = score.slice(0, n); let best = Math.max(...sc), w = sc.indexOf(best);
        const ranks = sc.map(v => 1 + sc.filter(o => o > v).length);
        api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 260 }]);
        api.end({ score: best, scores: sc, ranks, text: n === 1 ? 'جمعتَ ' + ui.num(best) + ' نقطة' : 'الفائز: اللاعب ' + ui.num(w + 1) + ' بـ' + ui.num(best) + ' نقطة' });
      } else nextTurn();
    }
    api.hud.set({ score: n === 1 ? ui.num(score[0]) : sc4(), time: ui.num(Math.max(0, Math.ceil(ROUND - t))) });
  },
  render(c, w, h) {
    const th = ui.theme, u = Math.min(w, h) / 100; W = w; H = h;
    ui.background(c, 1);
    if (state === 'intro') {
      ui.bigText(c, 'سيمون يقول', { y: h * 0.17, size: Math.min(h * 0.08, w * 0.13) });
      ui.text(c, 'تحرّك فقط إذا قال سيمون!', w / 2, h * 0.27, Math.max(16, u * 4.2), th.accent, true);
      ui.text(c, 'إن لم تبدأ التعليمة بـ«سيمون يقول» فاثبت مكانك', w / 2, h * 0.32, Math.max(14, u * 3.4), th.mut);
      ui.text(c, 'عدد اللاعبين', w / 2, h * 0.42, Math.max(14, u * 3.6), th.fg);
      for (let i = 0; i < 4; i++) ui.button(c, cntR[i], ui.num(i + 1), { on: n === i + 1 });
      ui.button(c, startR, 'ابدأ اللعب', { primary: true });
      face(c, w / 2, h * 0.82, Math.min(w, h) * 0.07, true, 0); ui.draw(c); return;
    }
    // مربعات المناطق في كل حارة: تغطي الشاشة كلها لأن الربع يُقاس من صورة الكاميرا كاملة
    const act = state === 'play', lit = act && phase !== 'res' ? zone : -1, pulse = 0.5 + 0.5 * Math.sin(seed * 7);
    for (let i = 0; i < n; i++) {
      const lw = w / n, x0 = i * lw, pc = th.players[i].color, gap = u * 1.2;
      for (let q = 0; q < 4; q++) {
        const tx = x0 + gap + (q % 2) * lw / 2, ty = gap + (q >> 1) * h / 2, tw = lw / 2 - gap * 1.5, tH = h / 2 - gap * 1.5, on = lit === q || lit === 4;
        c.fillStyle = on ? th.accent : pc; c.globalAlpha = on ? 0.2 + 0.16 * pulse : 0.1; rr(c, tx, ty, tw, tH, u * 3); c.fill();
        c.globalAlpha = on ? 0.9 : 0.4; c.strokeStyle = on ? th.accent : pc; c.lineWidth = on ? u * 0.7 : 1.5; rr(c, tx, ty, tw, tH, u * 3); c.stroke(); c.globalAlpha = 1;
      }
      if (lit === 5) { c.fillStyle = th.fg; c.globalAlpha = 0.5 + 0.2 * pulse; const bx = x0 + lw / 2, by = h * 0.24, bw = Math.min(lw * 0.09, u * 3); rr(c, bx - bw * 2, by - bw * 3, bw * 1.6, bw * 6, bw * 0.6); c.fill(); rr(c, bx + bw * 0.4, by - bw * 3, bw * 1.6, bw * 6, bw * 0.6); c.fill(); c.globalAlpha = 1; }
      if (i) { c.strokeStyle = th.line; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0, h); c.stroke(); }
      const cu = cur[i]; if (act && cu.mv) { const px = n === 1 ? (cu.q % 2 + 0.5) * w / 2 : cu.cx * w, py = n === 1 ? (cu.q >> 1) * h / 2 + h / 4 : cu.cy * h; c.fillStyle = pc; c.globalAlpha = 0.25; c.beginPath(); c.arc(px, py, u * 7, 0, 7); c.fill(); c.globalAlpha = 0.5; c.beginPath(); c.arc(px, py, u * 3.4, 0, 7); c.fill(); c.globalAlpha = 1; }
      const chipS = Math.max(34, Math.min(lw * 0.34, u * 6.5));
      ui.playerChip(c, i, x0 + lw / 2, ui.safe.top + Math.max(u * 7, 30), { score: score[i], size: chipS, label: n === 1 ? 'أنت' : undefined });
      if (act && st[i]) { const bx = x0 + lw / 2, by = h * 0.84, r = u * 4.2; c.fillStyle = st[i] === 1 ? th.ok : th.bad; c.beginPath(); c.arc(bx, by, r, 0, 7); c.fill(); c.strokeStyle = th.bg; c.lineWidth = u * 0.9; c.lineCap = 'round'; c.beginPath(); if (st[i] === 1) { c.moveTo(bx - r * 0.45, by); c.lineTo(bx - r * 0.1, by + r * 0.4); c.lineTo(bx + r * 0.5, by - r * 0.4); } else { c.moveTo(bx - r * 0.4, by - r * 0.4); c.lineTo(bx + r * 0.4, by + r * 0.4); c.moveTo(bx + r * 0.4, by - r * 0.4); c.lineTo(bx - r * 0.4, by + r * 0.4); } c.stroke(); c.lineCap = 'butt'; }
    }
    if (act) {
      const cw = Math.min(w * 0.94, u * 120), chh = Math.max(u * 22, 110), cx = w / 2 - cw / 2, cy = h / 2 - chh / 2;
      c.fillStyle = th.bg; c.globalAlpha = 0.86; rr(c, cx, cy, cw, chh, u * 4); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = says ? th.accent : th.mut; c.lineWidth = u * 0.6; rr(c, cx, cy, cw, chh, u * 4); c.stroke();
      face(c, cx + cw - chh * 0.5, cy + chh * 0.5, chh * 0.32, says, phase === 'act' ? Math.sin(seed * 12) : 0);
      const tx = cx + (cw - chh) / 2, fs = Math.min(u * 6.6, (cw - chh) / 9.2);
      if (says) ui.text(c, 'سيمون يقول', tx, cy + chh * 0.3, fs * 0.85, th.accent, true);
      ui.text(c, ACTION[zone], tx, cy + chh * (says ? 0.62 : 0.5), fs, th.fg, true);
      const k = phase === 'show' ? pt / SHOW : phase === 'act' ? 1 - pt / ACT : 0; c.fillStyle = th.line; rr(c, cx + chh * 0.12, cy + chh - u * 2.2, cw - chh * 0.24, u * 0.9, u * 0.45); c.fill();
      c.fillStyle = phase === 'show' ? th.mut : th.accent; if (k > 0) { rr(c, cx + cw - chh * 0.12 - (cw - chh * 0.24) * k, cy + chh - u * 2.2, (cw - chh * 0.24) * k, u * 0.9, u * 0.45); c.fill(); }
    }
    c.fillStyle = th.accent; for (let i = 0; i < NP; i++) { const o = i * 6; if (P[o + 4] <= 0) continue; c.globalAlpha = Math.min(1, P[o + 4] * 2); c.beginPath(); c.arc(P[o], P[o + 1], P[o + 5], 0, 7); c.fill(); } c.globalAlpha = 1;
    if (act) ui.progress(c, Math.max(0, 1 - t / ROUND));
    ui.draw(c);
  }
});

function sc4() { return ui.num(Math.max(...score.slice(0, n))); }
function face(c, x, y, r, talk, mouth) { // سيمون: وجه دائري ودود بقبعة
  const th = ui.theme, g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.1); g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#ff9a3c');
  c.globalAlpha = 0.18; c.fillStyle = th.accent; c.beginPath(); c.arc(x, y, r * 1.3, 0, 7); c.fill(); c.globalAlpha = 1;
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.fillStyle = th.accent; c.beginPath(); c.moveTo(x - r * 0.62, y - r * 0.62); c.lineTo(x + r * 0.05, y - r * 1.55); c.lineTo(x + r * 0.62, y - r * 0.62); c.closePath(); c.fill();
  c.fillStyle = '#3a2a10'; c.beginPath(); c.ellipse(x - r * 0.33, y - r * 0.12, r * 0.1, r * 0.15, 0, 0, 7); c.ellipse(x + r * 0.33, y - r * 0.12, r * 0.1, r * 0.15, 0, 0, 7); c.fill();
  c.strokeStyle = '#3a2a10'; c.lineWidth = Math.max(2, r * 0.09); c.lineCap = 'round'; c.beginPath(); c.ellipse(x, y + r * 0.22, r * 0.3, r * (talk ? 0.2 + 0.08 * mouth : 0.1), 0, 0, talk ? 3.1416 : 6.283); c.stroke(); c.lineCap = 'butt';
}
