// @title البالون الطائر
// @desc تعاون عائلي: بالون كبير يهبط ببطء، وحركتكم أمام الكاميرا تدفعه للأعلى. أبقوه في الهواء أطول وقت ممكن! لا يلزم أن يظهر وجهك.
// @howto تحرّكوا لتدفعوا البالون للأعلى
// @howto-act push-up
// @accent #ff6b8b
// @engine 0.2
// @capabilities camera.motion audio haptic hud players.local
// @players 1-6
// @minutes 1
// @age 4
// @play camera
// @style coop
// كل الكاميرا هنا شبكة حركة 5×4 فقط (لا صورة). كل خلية متحركة تدفع البالون بعيدًا عنها فتُحرّكه الأيدي من تحته.

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل / 1 عادي (سلوك ما قبلها حرفيًا) / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
const GC = 5, GR = 4, REACH = 0.34; let ROUND = 50, G = 0.1, PUSH = 11, SECOND = 20; const FLOOR = 0.86, HIGH = 0.72, NOISE = 0.035;
const HUES = [['#ff6b8b', '#ffb3c6'], ['#4da3ff', '#a8d4ff'], ['#ffc145', '#ffe6a3']];
const NP = 70, P = new Float32Array(NP * 7); // x y vx vy life size colourIdx
let lost = 0, api, ui, mot, state = 'intro', cells = [], t = 0, air = 0, taps = 0, drops = 0, streak = 0, best = 0, W = 400, H = 700, names = ['1'], seed = 0;
const B = [{ x: .5, y: .3, vx: 0, vy: 0, on: 1, k: 0, ph: 0 }, { x: .3, y: -.2, vx: 0, vy: 0, on: 0, k: 1, ph: 2 }];
const CL = [{ x: .15, y: .18, s: .22, v: .006 }, { x: .6, y: .32, s: .3, v: .004 }, { x: .85, y: .12, s: .18, v: .007 }, { x: .35, y: .5, s: .2, v: .005 }];
const STARS = []; for (let i = 0; i < 26; i++) STARS.push([(i * 0.381 + 0.07) % 1, (i * 0.617 + 0.13) % 0.7, 0.6 + (i % 4) * 0.35]);

function spark(x, y, n, ci, spd) {
  for (let k = 0; k < n; k++) {
    let i = 0; for (; i < NP; i++) if (P[i * 7 + 4] <= 0) break; if (i >= NP) return;
    const a = Math.random() * 6.283, s = (0.2 + Math.random()) * spd, o = i * 7;
    P[o] = x; P[o + 1] = y; P[o + 2] = Math.cos(a) * s; P[o + 3] = Math.sin(a) * s - 0.1; P[o + 4] = 0.5 + Math.random() * 0.5; P[o + 5] = 2 + Math.random() * 4; P[o + 6] = ci;
  }
}
function begin() {
  state = 'count'; t = 0; lost = 0; air = 0; taps = 0; drops = 0; streak = 0; best = 0;
  B[0].x = .5; B[0].y = .3; B[0].vx = B[0].vy = 0; B[1].on = 0; B[1].y = -.2;
  ui.countdown(3, () => { state = 'play'; });
}
function nudge(b, f) { b.vy = Math.min(b.vy, 0) - f; }

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; B[0].y = 0.7; const s = api.view.size(); W = s.w; H = s.h;
    ROUND = Math.round(50 * RS); SECOND = by3(1e9, 20 * RS, 12 * RS); G = by3(0.055, 0.1, 0.13); PUSH = by3(14, 11, 10); // سهل: بالون واحد أبطأ سقوطًا
    names = api.players.local({ names: ['1'] }).names;
    mot = api.track.motion({ grid: [GC, GR], threshold: 24 }, d => { cells = d.cells; });
    api.hud.set({ title: 'البالون الطائر', score: '0' });
  },
  onResize(w, h) { W = w; H = h; },
  onTap(x, y) {
    if (state === 'intro') { begin(); return; }
    if (state !== 'play') return;
    for (const b of B) {
      if (!b.on) continue;
      const rr = Math.min(W, H) * 0.11 * 2.2;
      if (Math.hypot((b.x - x) * W, (b.y - y) * H) < rr) { nudge(b, 0.42); b.vx += (b.x - x) * 2.5; taps++; ui.pop(1, b.x * W, b.y * H - rr * 0.5, ui.theme.accent); spark(b.x, b.y, 8, b.k, 0.5); api.audio.tone({ freq: 700, ms: 90, slide: 500, vol: 0.2 }); api.haptic(20); }
    }
  },
  update(dt) {
    seed += dt;
    for (const c of CL) { c.x += c.v * dt; if (c.x > 1.3) c.x = -0.3; }
    for (let i = 0; i < NP; i++) { const o = i * 7; if (P[o + 4] > 0) { P[o + 4] -= dt; P[o] += P[o + 2] * dt; P[o + 1] += P[o + 3] * dt; P[o + 3] += 0.35 * dt; } }
    if (state !== 'play') return;
    t += dt; if (t > SECOND && !B[1].on) { B[1].on = 1; B[1].x = .75; B[1].y = -.08; B[1].vx = B[1].vy = 0; ui.pop('بالون ثانٍ!', W / 2, H * 0.3, ui.theme.warn); api.audio.melody([{ freq: 523, ms: 90 }, { freq: 784, ms: 120 }]); }
    let allUp = true, pushed = 0;
    for (const b of B) {
      if (!b.on) continue;
      let ax = 0, ay = G;
      for (let i = 0; i < cells.length && i < GC * GR; i++) {
        const act = cells[i] - NOISE; if (act <= 0) continue;
        const cx = ((i % GC) + 0.5) / GC, cy = (Math.floor(i / GC) + 0.5) / GR, dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
        if (d > REACH) continue;
        const wgt = (1 - d / REACH) * Math.min(act, 0.35) * PUSH, n = d < 0.001 ? 1 : d;
        ax += dx / n * wgt * 0.8; ay += (dy / n - 0.55) * wgt; pushed += wgt;
      }
      ax = Math.max(-1.6, Math.min(1.6, ax)); ay = Math.max(-2.4, Math.min(1, ay));
      b.vx += ax * dt; b.vy += ay * dt; const f = Math.max(0, 1 - 0.9 * dt); b.vx *= f; b.vy *= f;
      b.vy = Math.max(-0.7, Math.min(0.55, b.vy)); b.vx = Math.max(-0.6, Math.min(0.6, b.vx));
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < 0.08) { b.x = 0.08; b.vx = Math.abs(b.vx) * 0.6; } if (b.x > 0.92) { b.x = 0.92; b.vx = -Math.abs(b.vx) * 0.6; }
      if (b.y < 0.1) { b.y = 0.1; b.vy = Math.abs(b.vy) * 0.3; }
      if (b.y > FLOOR) { // لمس الأرض: ارتداد لطيف وتبدأ السلسلة من جديد
        b.y = FLOOR; b.vy = -0.3; lost = 1.2; if (streak > best) best = streak; streak = 0; drops++; spark(b.x, b.y, 14, b.k, 0.6); api.audio.tone({ freq: 220, ms: 140, vol: 0.18, slide: -80 }); ui.flash(ui.theme.bad, 0.15);
      }
      if (b.y > HIGH) allUp = false;
      b.ph += dt * 2;
    }
    if (pushed > 0.4 && Math.random() < dt * 12) { const b = B[0]; spark(b.x, b.y + 0.08, 1, b.k, 0.25); }
    lost -= dt; if (lost > 0) allUp = false; if (allUp) { air += dt; streak += dt; } else streak = Math.max(0, streak - dt * 0.5);
    api.hud.set({ score: ui.num(Math.floor(air) + taps), time: ui.num(Math.max(0, Math.ceil(ROUND - t))) });
    if (t >= ROUND) {
      state = 'over'; mot.stop(); if (streak > best) best = streak; const sc = Math.floor(air) + taps;
      ui.flash(ui.theme.ok); api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 260 }]);
      api.end({ score: sc, scores: names.map(() => sc), ranks: names.map(() => 1), text: 'أبقيتم البالون في الهواء ' + ui.num(Math.floor(air)) + ' ثانية، وأفضل سلسلة ' + ui.num(Math.floor(best)) + ' ث، و' + ui.num(taps) + ' لمسة' });
    }
  },
  render(c, w, h) {
    const th = ui.theme, u = Math.min(w, h) / 100, R = u * 11; W = w; H = h;
    ui.background(c, 1);
    // سماء الغسق: وهج سفلي وأفق
    const g = c.createLinearGradient(0, h * 0.45, 0, h); g.addColorStop(0, 'rgba(255,107,139,0)'); g.addColorStop(1, 'rgba(255,140,120,0.28)'); c.fillStyle = g; c.fillRect(0, h * 0.45, w, h * 0.55);
    c.fillStyle = '#fff'; for (const s of STARS) { c.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(seed * s[2] + s[0] * 9)); c.beginPath(); c.arc(s[0] * w, s[1] * h, u * 0.35, 0, 7); c.fill(); } c.globalAlpha = 1;
    c.fillStyle = '#ffffff'; for (const k of CL) { const cx = k.x * w, cy = k.y * h, r = k.s * w * 0.5; c.globalAlpha = 0.045; c.beginPath(); c.ellipse(cx, cy, r, r * 0.32, 0, 0, 7); c.ellipse(cx - r * 0.5, cy + r * 0.08, r * 0.55, r * 0.22, 0, 0, 7); c.ellipse(cx + r * 0.55, cy + r * 0.06, r * 0.5, r * 0.2, 0, 0, 7); c.fill(); } c.globalAlpha = 1;
    c.fillStyle = '#fff3d6'; for (let k = 5; k >= 1; k--) { c.globalAlpha = k === 1 ? 0.9 : 0.05; c.beginPath(); c.arc(w * 0.82, h * 0.2, u * (k === 1 ? 5 : 5 + k * 2.2), 0, 7); c.fill(); } c.globalAlpha = 1;
    c.fillStyle = '#2b1740'; c.globalAlpha = 0.8; c.beginPath(); c.moveTo(0, h * 0.97); c.lineTo(0, h * 0.82); c.bezierCurveTo(w * 0.25, h * 0.72, w * 0.45, h * 0.9, w * 0.7, h * 0.8); c.bezierCurveTo(w * 0.85, h * 0.74, w * 0.95, h * 0.8, w, h * 0.78); c.lineTo(w, h * 0.97); c.closePath(); c.fill(); c.globalAlpha = 1;
    // أرضية ناعمة + خط الخطر
    c.fillStyle = th.bg; c.globalAlpha = 0.55; c.fillRect(0, h * (FLOOR + 0.06), w, h); c.globalAlpha = 1;
    c.strokeStyle = th.warn; c.globalAlpha = 0.18; c.lineWidth = 2; c.beginPath(); c.moveTo(0, h * HIGH); c.lineTo(w, h * HIGH); c.stroke();
    c.strokeStyle = th.bad; c.globalAlpha = 0.35; c.lineWidth = 2; c.setLineDash([u * 2, u * 2]); c.beginPath(); c.moveTo(0, h * (FLOOR + 0.06)); c.lineTo(w, h * (FLOOR + 0.06)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    if (state === 'intro') { ui.title(c, 'البالون الطائر', 'حرّكوا أيديكم أمام الكاميرا لتدفعوا البالون للأعلى وأبقوه في الهواء معًا. الكاميرا لا تعرض صورتك.'); balloons(c, w, h, R, 0.9); ui.draw(c); return; }
    // أثر الحركة: توهّج ناعم في الخلايا المتحركة
    for (let i = 0; i < cells.length && i < GC * GR; i++) { const a = cells[i] - NOISE; if (a <= 0) continue; c.globalAlpha = Math.min(0.07, a * 0.3); c.fillStyle = '#ffd2dc'; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(((i % GC) + 0.5) / GC * w, (Math.floor(i / GC) + 0.5) / GR * h, Math.min(w / GC, h / GR) * 0.16 * k, 0, 7); c.fill(); } } c.globalAlpha = 1;
    balloons(c, w, h, R, 1);
    for (let i = 0; i < NP; i++) { const o = i * 7; if (P[o + 4] <= 0) continue; c.globalAlpha = Math.min(1, P[o + 4] * 1.6); c.fillStyle = HUES[P[o + 6]][1]; c.beginPath(); c.arc(P[o] * w, P[o + 1] * h, P[o + 5] * u * 0.4, 0, 7); c.fill(); } c.globalAlpha = 1;
    if (state === 'play' || state === 'over') {
      ui.progress(c, Math.max(0, 1 - t / ROUND));
      ui.bigText(c, ui.num(Math.floor(air) + taps), { y: ui.safe.top + h * 0.07, size: h * 0.075, alpha: 0.95 });
      ui.text(c, 'في الهواء ' + ui.num(Math.floor(streak)) + ' ث   ·   لمسات ' + ui.num(taps), w / 2, ui.safe.top + h * 0.07 + h * 0.06, Math.max(14, u * 3.6), th.mut);
    }
    ui.draw(c);
  }
});

function balloons(c, w, h, R, al) {
  for (const b of B) {
    if (!b.on && state !== 'intro') continue; if (!b.on) continue;
    const x = b.x * w, y = b.y * h, sx = R * 0.88, sy = R * 1.08 + Math.sin(b.ph) * R * 0.03, hu = HUES[b.k];
    c.globalAlpha = al * 0.05; c.fillStyle = hu[0]; for (let k = 8; k >= 1; k--) { c.beginPath(); c.ellipse(x, y, sx * (1 + k * 0.1), sy * (1 + k * 0.09), 0, 0, 7); c.fill(); } c.globalAlpha = al;
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = Math.max(1.5, R * 0.03); c.beginPath(); c.moveTo(x, y + sy); c.bezierCurveTo(x + R * 0.25 * Math.sin(b.ph + 1), y + sy + R * 0.5, x - R * 0.25 * Math.sin(b.ph), y + sy + R * 0.9, x + R * 0.1 * Math.sin(b.ph), y + sy + R * 1.5); c.stroke();
    const g = c.createRadialGradient(x - sx * 0.35, y - sy * 0.4, R * 0.1, x, y, sy * 1.1); g.addColorStop(0, hu[1]); g.addColorStop(0.55, hu[0]); g.addColorStop(1, 'rgba(60,20,70,0.9)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, sx, sy, 0, 0, 7); c.fill();
    c.fillStyle = hu[0]; c.beginPath(); c.moveTo(x, y + sy - 2); c.lineTo(x - R * 0.12, y + sy + R * 0.14); c.lineTo(x + R * 0.12, y + sy + R * 0.14); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.globalAlpha = al * 0.55; c.beginPath(); c.ellipse(x - sx * 0.4, y - sy * 0.42, sx * 0.14, sy * 0.26, -0.5, 0, 7); c.fill(); c.globalAlpha = 1;
  }
}
