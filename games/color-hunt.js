// @title صيد الألوان
// @desc أمسك أمام الكاميرا شيئًا بلون المطلوب (بلا إظهار وجهك — الصورة لا تُعرض) وثبّته قليلًا. 20 ثانية لكل لون.
// @accent #ffc145
// @engine 0.2
// @capabilities camera.color audio haptic hud
// سلوك مطابق لنموذج colorhunt/index.html: 5 ألوان، منطقة مركزية، تثبيت 0.6 ث، جولة 20 ث، نقاط 10+الثواني المتبقية.

const COLORS = [
  { id: 'red', n: 'أحمر', hex: '#e5484d' },
  { id: 'green', n: 'أخضر', hex: '#4cc38a' },
  { id: 'blue', n: 'أزرق', hex: '#3b82f6' },
  { id: 'yellow', n: 'أصفر', hex: '#f5d90a' },
  { id: 'orange', n: 'برتقالي', hex: '#f97316' }
];
const ROUND_S = 20, HOLD_S = 0.6, FULL = 0.4;
let api, ui, track, cur = null, state = 'intro', score = 0, left = ROUND_S, hold = 0, hit = false, ratio = 0, W = 400, H = 700;

// لا صورة كاميرا على الشاشة، فلا معنى لمربع مركزي لا يراه اللاعب: نحلّل الإطار كله، واللاعب يملأ جزءًا منه بالشيء الملوّن.
const ZONE = { x: 0, y: 0, w: 1, h: 1 };

function pick() {
  let c; do { c = COLORS[Math.floor(Math.random() * COLORS.length)]; } while (c === cur);
  cur = c; left = ROUND_S; hold = 0;
  track.set({ name: c.id, zone: ZONE, minRatio: 0.12 });
}

defineGame({
  init(a) {
    api = a; ui = a.ui;
    track = api.track.color({ name: 'red' }, d => { hit = d.present; ratio = d.ratio; });
    api.hud.set({ score: 'النقاط 0', time: String(ROUND_S) });
  },
  onTap() {
    if (state === 'intro') { state = 'count'; score = 0; ui.countdown(3, () => { state = 'play'; pick(); }); }
  },
  update(dt) {
    if (state !== 'play') return;
    hold = hit ? hold + dt : Math.max(0, hold - dt * 2);
    if (hold >= HOLD_S) {
      const gain = 10 + Math.ceil(left); score += gain; api.haptic(60); api.audio.tone({ freq: 523, ms: 120, slide: 400 });
      api.hud.set({ score: 'النقاط ' + score }); ui.pop(gain, W / 2, H * 0.3); ui.flash(ui.theme.ok); pick();
    }
    left -= dt; api.hud.set({ time: String(Math.max(0, Math.ceil(left))) });
    if (left <= 0) { state = 'over'; track.stop(); api.audio.tone({ freq: 300, ms: 400, slide: -150 }); api.end({ score, text: 'انتهى الوقت' }); }
  },
  render(ctx, w, h) {
    W = w; H = h; const th = ui.theme;
    ui.background(ctx);
    if (state === 'intro') { ui.title(ctx, 'صيد الألوان', 'أمسك أمام الكاميرا شيئًا بلون المطلوب وثبّته قليلًا. صورتك لا تظهر ولا تُحفظ.'); ui.draw(ctx); return; }
    if (state === 'play') {
      // لوحة بلا كاميرا: لون المطلوب كبير، ومقياس «ما تراه الكاميرا من هذا اللون» مع خط الحدّ، وحلقة تخضرّ عند الالتقاط
      ctx.globalAlpha = 0.2 + (hit ? 0.14 : 0); ctx.fillStyle = cur.hex; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      const r = Math.min(w, h) * 0.2, cx = w / 2, cy = h * 0.42;
      ctx.fillStyle = cur.hex; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = hit ? th.ok : th.fg; ctx.stroke();
      ui.bigText(ctx, 'أمسك شيئًا ' + cur.n, { y: cy + r + h * 0.07, size: h * 0.045 });
      ui.text(ctx, 'صورتك لا تظهر ولا تُحفظ', cx, cy + r + h * 0.115, 15, th.mut);
      ui.meter(ctx, ratio, { max: FULL, threshold: 0.12, label: hit ? 'ملتقَط — ثبّته' : 'يُلتقط…', });
      ui.progress(ctx, left / ROUND_S);
      ui.progress(ctx, hold / HOLD_S, { y: h - 8, color: th.ok, h: 8 });
    }
    ui.draw(ctx);
  }
});
