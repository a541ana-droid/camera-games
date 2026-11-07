// @title سباق الحارات
// @desc من 2 إلى 4 لاعبين: تُقسَّم الشاشة إلى حارات بعدد اللاعبين. كل لاعب في حارته يلوّح بيده (حركة) أو يهزّ شيئًا بلونه (لون) ليدفع متسابقه إلى الخط. ثبّت الجهاز على حامل.
// @howto لوّح بيدك ليجري متسابقك
// @howto-act wave-lane
// @accent #3ddc97
// @engine 0.2
// @capabilities camera.view camera.lanes camera.playercolors audio haptic hud players.local
// مرجع القدرتين الجديدتين: api.track.lanes (حارات بحسب الحركة) و api.track.colorPerPlayer (لون لكل لاعب).
// داخل سلسلة (دوري) تُلعب مرة واحدة بعدد حاراتها = عدد لاعبي السلسلة، وتُبلغ بالمراكز عبر api.end({ranks, scores}) فتُحتسب النقاط.

const NAMES = ['1', '2', '3', '4'], COLORS = ['red', 'green', 'blue', 'yellow'], COLOR_AR = ['أحمر', 'أخضر', 'أزرق', 'أصفر'], HEX = ['#e5484d', '#4cc38a', '#3b82f6', '#f5d90a'];
const FULL_WAVE = 0.08, SPEED = 0.13; // طاقة حارة تعدّ "تلويحًا كاملًا"، وأقصى سرعة (حصة من الطريق/ث)
let api, ui, state = 'intro', count = 2, mode = 'motion', handle = null, lanes = [], pos = [], speed = [], last = [], t = 0, winner = -1, cd = 0, W = 400, H = 700;
const cntR = [], modeR = [], startR = { x: 0, y: 0, w: 180, h: 56 };

function stopTrack() { if (handle) { handle.stop(); handle = null; } }
function start() {
  stopTrack(); pos = []; speed = []; last = []; lanes = [];
  for (let i = 0; i < count; i++) { pos.push(0); speed.push(0); last.push(null); lanes.push({ present: false, energy: 0 }); }
  if (mode === 'motion') handle = api.track.lanes({ count, by: 'motion', threshold: 24 }, d => { lanes = d.lanes; });
  else handle = api.track.colorPerPlayer(COLORS.slice(0, count).map((c, i) => ({ id: 'p' + i, color: { name: c } })), d => { lanes = d.players; });
  state = 'count'; t = 0; winner = -1; api.hud.set({ title: mode === 'motion' ? 'بالحركة' : 'باللون' });
  ui.countdown(3, () => { state = 'race'; });
}
function laneSpeed(i, dt) { // سرعة المتسابق من قياس حارته
  const L = lanes[i]; if (!L) return 0;
  if (mode === 'motion') return Math.min(1, L.energy / FULL_WAVE) * SPEED;
  if (!L.present) { last[i] = null; return 0; }
  const p = last[i]; last[i] = [L.cx, L.cy]; if (!p) return 0;
  return Math.min(1, Math.hypot(L.cx - p[0], L.cy - p[1]) / Math.max(dt, 0.016) / 1.5) * SPEED;
}
function layout(w, h) { // مستطيلات أزرار القائمة (تُحسب عند تغيّر الحجم لأن الشاشة قد تدور)
  const bw = Math.min(110, (w - 60) / 3), gap = 10, x0 = w / 2 - (3 * bw + 2 * gap) / 2, bw2 = Math.min(160, (w - 50) / 2);
  for (let i = 0; i < 3; i++) cntR[i] = { x: x0 + i * (bw + gap), y: h * 0.4, w: bw, h: 50 };
  modeR[0] = { x: w / 2 - bw2 - gap / 2, y: h * 0.52, w: bw2, h: 50 }; modeR[1] = { x: w / 2 + gap / 2, y: h * 0.52, w: bw2, h: 50 };
  startR.x = w / 2 - 90; startR.y = h * 0.66; startR.w = 180; startR.h = 56;
}
function results() { // مراكز اللاعبين: الأقرب إلى الخط أولًا، والتعادل بتكرار الرقم
  const ranks = [], scores = [];
  for (let i = 0; i < count; i++) { let r = 1; for (let j = 0; j < count; j++) if (pos[j] > pos[i]) r++; ranks.push(r); scores.push(Math.round(pos[i] * 1000) / 10); }
  return { ranks, scores };
}

defineGame({
  init(a) { api = a; ui = a.ui; api.view.showCamera(true); const s = api.view.size(); W = s.w; H = s.h; layout(W, H); count = Math.max(2, Math.min(4, api.players.local({ names: ['1', '2'] }).names.length)); },
  onResize(w, h) { W = w; H = h; layout(w, h); },
  onTap(x, y) {
    if (state !== 'intro') return;
    for (let i = 0; i < 3; i++) if (ui.hit(cntR[i], x, y)) { count = i + 2; api.audio.beep(700, 50); }
    for (let i = 0; i < 2; i++) if (ui.hit(modeR[i], x, y)) { mode = i ? 'color' : 'motion'; api.audio.beep(700, 50); }
    if (ui.hit(startR, x, y)) start();
  },
  update(dt) {
    if (state !== 'race') return;
    t += dt;
    for (let i = 0; i < count; i++) {
      speed[i] += (laneSpeed(i, dt) - speed[i]) * Math.min(1, dt * 6); pos[i] = Math.min(1, pos[i] + speed[i] * dt);
      if (pos[i] >= 1 && winner < 0) winner = i;
    }
    api.hud.set({ time: String(Math.floor(t)) });
    if (winner >= 0) {
      state = 'over'; stopTrack(); api.haptic(120); ui.flash(ui.theme.players[winner].color); api.audio.melody([{ freq: 523, ms: 120 }, { freq: 659, ms: 120 }, { freq: 784, ms: 240 }]);
      const r = results(); api.end({ score: Math.round(t * 10) / 10, scores: r.scores, ranks: r.ranks, text: 'الفائز: اللاعب ' + NAMES[winner] });
    }
  },
  render(ctx, w, h) {
    const th = ui.theme; W = w; H = h;
    if (state === 'intro') {
      ui.background(ctx, 0.9); ui.bigText(ctx, 'سباق الحارات', { y: h * 0.2, size: Math.min(h * 0.07, w * 0.12) });
      ui.text(ctx, 'اختر عدد اللاعبين وطريقة التتبع', w / 2, h * 0.29, 16, th.mut);
      for (let i = 0; i < 3; i++) ui.button(ctx, cntR[i], ['2 لاعبان', '3 لاعبين', '4 لاعبين'][i], { on: count === i + 2 });
      ui.button(ctx, modeR[0], 'بالحركة', { on: mode === 'motion' }); ui.button(ctx, modeR[1], 'باللون', { on: mode === 'color' });
      ui.button(ctx, startR, 'ابدأ السباق', { primary: true }); ui.draw(ctx); return;
    }
    ui.background(ctx, 0.35);
    const lw = w / count, top = ui.safe.top + 22, bottom = h - 120, run = bottom - top;
    for (let i = 0; i < count; i++) {
      const x = i * lw, cx = x + lw / 2, act = lanes[i] ? (mode === 'motion' ? lanes[i].energy : (lanes[i].present ? 0.3 : 0)) : 0, pc = th.players[i].color;
      ctx.globalAlpha = i % 2 ? 0.14 : 0.24; ctx.fillStyle = th.bg; ctx.fillRect(x, 0, lw, h); ctx.globalAlpha = 1;
      if (i) { ctx.strokeStyle = th.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      ui.meter(ctx, act, { x: x + lw * 0.1, w: lw * 0.8, h: 12, y: h - 74, max: mode === 'motion' ? FULL_WAVE : 0.3, color: pc }); // نشاط الحارة
      const py = bottom - pos[i] * run, r = Math.min(26, lw * 0.28);
      ctx.globalAlpha = 0.35; ctx.fillStyle = pc; ctx.fillRect(cx - 5, py, 10, bottom - py); ctx.globalAlpha = 1; // أثر المتسابق
      ui.shape(ctx, i, cx, py, r); ui.text(ctx, NAMES[i], cx, py + (i === 1 ? r * 0.2 : 0), r * 0.95, th.bg, true);
      if (mode === 'color' && lanes[i] && !lanes[i].present) { ctx.fillStyle = HEX[i]; ctx.beginPath(); ctx.arc(cx, h - 122, 7, 0, 7); ctx.fill(); ui.text(ctx, 'أرِ شيئًا ' + COLOR_AR[i], cx, h - 100, 14, th.fg); }
    }
    ctx.setLineDash([12, 8]); ctx.strokeStyle = th.fg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(w, top); ctx.stroke(); ctx.setLineDash([]); // خط النهاية
    ui.text(ctx, 'النهاية', w / 2, top - 14, 14, th.fg);
    ui.draw(ctx);
  }
});
