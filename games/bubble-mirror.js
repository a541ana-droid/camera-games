// @title فقاعات
// @desc فقاعات ملوّنة تطفو أمامك وصورتك خلفها كالمرآة. لوّح بيدك أو حرّك جسمك عند الفقاعة لتنفجر! لعبة هادئة لكل العائلة: كلنا معًا بنقاط مشتركة، أو لكل لاعب لونه وحارته. ثبّت الجهاز على حامل.
// @howto فجّر الفقاعات بيدك
// @howto-act pop
// @accent #4dc3ff
// @engine 0.2
// @capabilities camera.view camera.motion audio haptic hud players.local
// هنا عرض الكاميرا هو لبّ اللعبة: تُظهر الصورة خافتة خلف الفقاعات (إن أطفأها المستخدم من القائمة تبقى اللعبة تعمل على خلفية المحرك).

// إعدادات الأسرة (ENGINE.md §3.5): RS يضرب مدة الجولة، DIFF 0 سهل / 1 عادي (سلوك ما قبلها حرفيًا) / 2 صعب. by3(سهل، عادي، صعب).
let RS = 1, DIFF = 1; const by3 = (e, m, h) => DIFF === 0 ? e : DIFF === 2 ? h : m;
const TAU = 6.2832, GOLD_EVERY = 9; let ROUND = 50, BSPD = 1, BSZ = 1, POPE = 0.1;
const PASTEL = ['#7fd4ff', '#ff9ed2', '#ffe27a', '#9af0c4', '#c3a6ff'];
let api, ui, state = 'intro', mode = 'shared', count = 2, handle = null, cells = [], GC = 8, GR = 12, t = 0, left = ROUND, W = 400, H = 700, spawnN = 0, endIn = -1;
const score = [0, 0, 0, 0], B = [], P = [], PN = 160; let pi = 0, BN = 7;
const modeR = [], cntR = [], startR = { x: 0, y: 0, w: 220, h: 58 };
for (let i = 0; i < 14; i++) B.push({ on: false, x: 0, y: 0, r: 40, vy: 50, ph: 0, sw: 0, col: '#fff', gold: false, lane: 0, age: 0 });
for (let i = 0; i < PN; i++) P.push({ x: 0, y: 0, vx: 0, vy: 0, l: 0, s: 3, c: '#fff', ring: 0 });

function emit(x, y, col, n, spd, size, ring) {
  for (let k = 0; k < n; k++) { const p = P[pi], a = Math.random() * TAU, v = spd * (0.3 + Math.random() * 0.7); pi = (pi + 1) % PN; p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 30; p.l = 0.6 + Math.random() * 0.5; p.s = size * (0.6 + Math.random() * 0.8); p.c = col; p.ring = ring || 0; }
}
function laneOf(x) { return mode === 'split' ? Math.min(count - 1, Math.floor(x / (W / count))) : 0; }
function colorOf(b) { return mode === 'split' ? ui.theme.players[b.lane].color : PASTEL[spawnN % PASTEL.length]; }
function spawn(b, lane) {
  const m = Math.min(W, H), lw = mode === 'split' ? W / count : W; b.r = Math.min(150 * BSZ, m * (0.12 + Math.random() * 0.05) * BSZ); if (mode === 'split') b.r = Math.min(b.r, lw * 0.36);
  const l0 = mode === 'split' ? (lane == null ? Math.floor(Math.random() * count) : lane) : 0, x0 = mode === 'split' ? l0 * lw : 0;
  b.y = H + b.r + Math.random() * H * 0.12; for (let k = 0; k < 6; k++) { b.x = x0 + b.r + Math.random() * Math.max(1, lw - 2 * b.r); let free = true; for (const o of B) if (o !== b && o.on && Math.hypot(o.x - b.x, o.y - b.y) < (o.r + b.r) * 0.95) free = false; if (free) break; }
  b.vy = H * (0.07 + Math.random() * 0.05) * BSPD; b.ph = Math.random() * TAU; b.sw = b.r * (0.2 + Math.random() * 0.3);
  b.lane = l0; spawnN++; b.gold = spawnN % GOLD_EVERY === 0; b.col = b.gold ? '#ffd24a' : colorOf(b); b.on = true; b.age = 0;
}
function popB(b) {
  b.on = false; const v = b.gold ? 3 : 1, col = b.col; score[b.lane] += v;
  emit(b.x, b.y, col, b.gold ? 26 : 14, b.r * 3.2, b.r * 0.1); emit(b.x, b.y, '#ffffff', 6, b.r * 2, b.r * 0.07); emit(b.x, b.y, '#ffffff', 1, 0, b.r, b.r);
  ui.pop(v, b.x, b.y - b.r * 0.4, col); api.haptic(20); api.audio.tone({ freq: 480 + Math.random() * 420, ms: 130, slide: 400, vol: 0.22, type: 'sine' });
  if (b.gold) { api.audio.melody([{ freq: 660, ms: 80 }, { freq: 880, ms: 80 }, { freq: 1100, ms: 140 }]); ui.flash('#ffd24a', 0.2); }
  api.hud.set({ score: mode === 'split' ? '' : ui.num(score[0]) });
}
function layout(w, h) { ui.row(modeR, 2, h * 0.4, 54, 10, 420); ui.row(cntR, 3, h * 0.53, 50, 8, 330); startR.w = Math.min(w * 0.7, 280); startR.x = (w - startR.w) / 2; startR.y = h * 0.67; }
function start() {
  for (const b of B) b.on = false; for (let i = 0; i < 4; i++) score[i] = 0;
  BN = mode === 'split' ? 3 + count * 2 : 8; t = 0; left = ROUND; endIn = -1; spawnN = 0;
  for (let i = 0; i < BN; i++) { spawn(B[i], mode === 'split' ? i % count : null); B[i].y = H * (0.25 + 0.7 * (i / BN)); }
  if (handle) handle.stop(); handle = api.track.motion({ grid: [GC, GR], threshold: 22 }, d => { cells = d.cells; });
  state = 'count'; api.hud.set({ title: 'فقاعات', time: String(ROUND), score: mode === 'split' ? '' : '0' }); ui.countdown(3, () => { state = 'play'; });
}
function energyAt(b) { // أقوى حركة تحت الفقاعة: حد أقصى للخلايا المغطّاة أو متوسطها
  if (!cells || cells.length < GC * GR) return 0;
  const cw = W / GC, ch = H / GR, c0 = Math.max(0, Math.floor((b.x - b.r * 0.8) / cw)), c1 = Math.min(GC - 1, Math.floor((b.x + b.r * 0.8) / cw)), r0 = Math.max(0, Math.floor((b.y - b.r * 0.8) / ch)), r1 = Math.min(GR - 1, Math.floor((b.y + b.r * 0.8) / ch));
  let mx = 0, sum = 0, n = 0; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const v = cells[r * GC + c] || 0; if (v > mx) mx = v; sum += v; n++; }
  return Math.max(mx * 0.55, n ? sum / n : 0);
}

defineGame({
  init(a) {
    api = a; ui = a.ui; RS = (a.prefs && a.prefs.roundScale) || 1; DIFF = a.prefs ? a.prefs.difficulty : 1; api.view.showCamera(true); ROUND = Math.round(50 * RS); left = ROUND; BSPD = by3(0.6, 1, 1.35); BSZ = by3(1.25, 1, 0.9); POPE = by3(0.06, 0.1, 0.14); const s = api.view.size(); W = s.w; H = s.h; if (W > H) { GC = 12; GR = 8; }
    count = Math.max(2, Math.min(4, api.players.local({ names: ['1', '2'] }).names.length)); layout(W, H); api.hud.set({ title: 'فقاعات' });
  },
  onResize(w, h) { W = w; H = h; layout(w, h); },
  onTap(x, y) {
    if (state !== 'intro') return;
    for (let i = 0; i < 2; i++) if (ui.hit(modeR[i], x, y)) { mode = i ? 'split' : 'shared'; api.audio.beep(700, 50); }
    if (mode === 'split') for (let i = 0; i < 3; i++) if (ui.hit(cntR[i], x, y)) { count = i + 2; api.audio.beep(700, 50); }
    if (ui.hit(startR, x, y)) start();
  },
  update(dt) {
    for (let k = 0; k < PN; k++) { const p = P[k]; if (p.l > 0) { p.l -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; if (!p.ring) p.vy += 120 * dt; } }
    if (state !== 'play') return;
    t += dt; left -= dt;
    for (let i = 0; i < BN; i++) {
      const b = B[i]; if (!b.on) { spawn(b, mode === 'split' ? i % count : null); continue; }
      b.age += dt; b.y -= b.vy * dt; b.ph += dt * 1.3; const sx = Math.sin(b.ph) * b.sw * dt * 1.3; b.x += sx;
      if (b.y < -b.r * 1.2) { b.on = false; continue; }
      if (b.age > 0.5 && b.y < H + b.r * 0.2 && energyAt(b) > POPE) popB(b);
    }
    api.hud.set({ time: String(Math.max(0, Math.ceil(left))) });
    if (endIn < 0 && left <= 0) endIn = 0.5;
    if (endIn >= 0) {
      endIn -= dt; if (endIn > 0) return;
      state = 'over'; if (handle) { handle.stop(); handle = null; }
      const sc = score.slice(0, mode === 'split' ? count : 1), best = Math.max(...sc), win = sc.indexOf(best);
      api.audio.melody([{ freq: 523, ms: 110 }, { freq: 659, ms: 110 }, { freq: 784, ms: 220 }]);
      if (mode === 'split') api.end({ score: best, scores: sc, text: sc.filter(v => v === best).length > 1 ? 'تعادل جميل!' : 'الفائز: اللاعب ' + ui.num(win + 1) + ' بـ ' + ui.num(best) + ' فقاعة' });
      else api.end({ score: sc[0], scores: [sc[0]], text: 'فجّرتم ' + ui.num(sc[0]) + ' نقطة من الفقاعات!' });
    }
  },
  render(ctx, w, h) {
    const th = ui.theme; W = w; H = h;
    if (state === 'intro') {
      ui.background(ctx, 0.6); ui.bigText(ctx, 'فقاعات', { y: h * 0.17 }); ui.text(ctx, 'لوّح بيدك لتفجير الفقاعات', w / 2, h * 0.26, Math.min(20, w * 0.055), th.fg);
      ui.text(ctx, 'صورتك تظهر خلف الفقاعات على شاشتك فقط', w / 2, h * 0.31, 14, th.mut);
      ui.button(ctx, modeR[0], 'كلنا معًا', { on: mode === 'shared' }); ui.button(ctx, modeR[1], 'لكل لاعب لونه', { on: mode === 'split' });
      if (mode === 'split') for (let i = 0; i < 3; i++) ui.button(ctx, cntR[i], ui.num(i + 2) + ' لاعبين', { on: count === i + 2 });
      ui.button(ctx, startR, 'ابدأ', { primary: true });
      for (let i = 0; i < 5; i++) { const x = w * (0.12 + i * 0.19), y = h * 0.88 - (i % 2) * h * 0.04; ctx.globalAlpha = 0.5; ctx.strokeStyle = PASTEL[i]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, w * 0.05 + (i % 3) * 5, 0, TAU); ctx.stroke(); ctx.globalAlpha = 0.12; ctx.fillStyle = PASTEL[i]; ctx.fill(); }
      ctx.globalAlpha = 1; ui.draw(ctx); return;
    }
    ui.background(ctx, 0.5); // الكاميرا تبقى خافتة خلف الفقاعات
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(120,200,255,0.20)'); g.addColorStop(1, 'rgba(255,150,210,0.22)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (mode === 'split') for (let i = 0; i < count; i++) {
      const lw = w / count; ctx.globalAlpha = 0.09; ctx.fillStyle = th.players[i].color; ctx.fillRect(i * lw, 0, lw, h); ctx.globalAlpha = 1;
      if (i) { ctx.strokeStyle = th.line; ctx.lineWidth = 2; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(i * lw, ui.safe.top); ctx.lineTo(i * lw, h); ctx.stroke(); ctx.setLineDash([]); }
      ui.playerChip(ctx, i, i * lw + lw / 2, ui.safe.top + 30, { label: '', score: score[i], size: Math.min(40, lw * 0.5) });
    } else ui.bigText(ctx, ui.num(score[0]), { y: ui.safe.top + 46, size: h * 0.06, alpha: 0.9 });
    for (let i = 0; i < 12; i++) { const x = (i * 0.37 + 0.1) % 1 * w, y = h - ((t * 14 + i * 97) % (h + 20)); ctx.globalAlpha = 0.25; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, TAU); ctx.fill(); } ctx.globalAlpha = 1;
    for (let i = 0; i < BN; i++) {
      const b = B[i]; if (!b.on) continue; const r = b.r * (1 + Math.sin(t * 2 + i) * 0.025), pop = Math.min(1, b.age * 3);
      ctx.save(); ctx.globalAlpha = pop;
      ctx.fillStyle = b.col; ctx.globalAlpha = 0.1 * pop; ctx.beginPath(); ctx.arc(b.x, b.y, r * 1.28, 0, TAU); ctx.fill();
      ctx.globalAlpha = (b.gold ? 0.4 : 0.24) * pop; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.85 * pop; ctx.strokeStyle = b.col; ctx.lineWidth = Math.max(3, r * 0.07); ctx.stroke();
      ctx.globalAlpha = 0.55 * pop; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(3, r * 0.09); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.72, 3.5, 4.5); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.8 * pop; ctx.beginPath(); ctx.arc(b.x - r * 0.42, b.y - r * 0.5, r * 0.09, 0, TAU); ctx.fill();
      if (b.gold) { ctx.strokeStyle = '#fff6c9'; ctx.lineWidth = 3; ctx.globalAlpha = 0.9; for (let k = 0; k < 4; k++) { const a = t * 1.5 + k * 1.5708, c = Math.cos(a), s = Math.sin(a); ctx.beginPath(); ctx.moveTo(b.x + c * r * 0.2, b.y + s * r * 0.2); ctx.lineTo(b.x + c * r * 0.55, b.y + s * r * 0.55); ctx.stroke(); } }
      ctx.restore();
    }
    for (let k = 0; k < PN; k++) {
      const p = P[k]; if (p.l <= 0) continue;
      if (p.ring) { ctx.globalAlpha = Math.max(0, p.l * 1.5); ctx.strokeStyle = p.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.ring * (1 + (1 - Math.max(0, p.l)) * 0.8) , 0, TAU); ctx.stroke(); continue; }
      ctx.globalAlpha = Math.min(1, p.l * 2); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (state === 'play' && t < 7) ui.text(ctx, 'لوّح بيدك عند الفقاعة', w / 2, h - 90, Math.min(22, w * 0.06), th.fg, true);
    if (state === 'play') ui.progress(ctx, left / ROUND);
    ui.draw(ctx);
  }
});
