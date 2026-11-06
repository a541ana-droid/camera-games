// @title كرة الميزان
// @desc أمِل الجوال لتدحرج الكرة وتجمع النجوم الخمس قبل انتهاء الوقت. هزّ الجوال لإعادة الكرة إلى الوسط.
// @accent #7c6cff
// @engine 0.2
// @capabilities motion.device audio haptic hud
// يحتاج مستشعر حركة (جوال/لوح). الميل يصل جاهزًا من المضيف: x يمين/يسار، y أمام/خلف، من -1 إلى 1.

const STARS = [[.8, .5], [.8, .2], [.2, .2], [.2, .8], [.8, .8]];   // مواضع النجوم (نسبة من الشاشة) بالترتيب
const HOLES = [[.5, .3], [.5, .7]];                                  // ثقوب تُعيد الكرة وتخصم ثانيتين
const TOTAL = 45, R = 16, ACC = 2.2, FRICTION = 1.6;
let api, ui, state = 'intro', bx = .5, by = .5, vx = 0, vy = 0, tx = 0, ty = 0, got = 0, left = TOTAL, W = 360, H = 640;

function reset() { bx = .5; by = .5; vx = vy = 0; }

defineGame({
  init(a) {
    api = a; ui = a.ui;
    api.sensors.motion(d => {
      tx = d.x; ty = d.y;
      if (d.shake && state === 'play') { reset(); ui.pop('هزّة! عادت الكرة', W / 2, H * .5, ui.theme.warn); api.haptic(40); }
    });
    api.hud.set({ score: 'نجوم 0/' + STARS.length, time: String(TOTAL) });
  },
  onTap() {
    if (state === 'intro') { state = 'play'; got = 0; left = TOTAL; reset(); api.audio.beep(660, 80); } // بلا عدّ تنازلي: الكرة ساكنة في الوسط حتى تميل الجوال
  },
  update(dt) {
    const s = api.view.size(); W = s.w || W; H = s.h || H;
    if (state !== 'play') return;
    left -= dt;
    // التسارع نسبة إلى الشاشة (ثانية⁻²)؛ احتكاك خطي
    vx += tx * ACC * dt; vy += ty * ACC * dt;
    const f = Math.max(0, 1 - FRICTION * dt); vx *= f; vy *= f;
    bx += vx * dt; by += vy * dt;
    const mx = R / W, my = R / H;
    if (bx < mx) { bx = mx; vx = -vx * .4; } if (bx > 1 - mx) { bx = 1 - mx; vx = -vx * .4; }
    if (by < my) { by = my; vy = -vy * .4; } if (by > 1 - my) { by = 1 - my; vy = -vy * .4; }
    const hit = (p, rr) => Math.hypot((bx - p[0]) * W, (by - p[1]) * H) < rr;
    if (hit(STARS[got], R + 14)) {
      ui.pop(1, STARS[got][0] * W, STARS[got][1] * H - 24); got++; api.audio.tone({ freq: 523, ms: 120, slide: 300 }); api.haptic(30);
      api.hud.set({ score: 'نجوم ' + got + '/' + STARS.length });
      if (got >= STARS.length) { state = 'done'; ui.flash(ui.theme.ok); api.end({ score: Math.round(left * 10), text: 'جمعت كل النجوم! الوقت المتبقي ' + Math.ceil(left) + ' ثانية' }); return; }
    }
    for (const h of HOLES) if (hit(h, R + 6)) { reset(); left -= 2; ui.pop('−2 ث', h[0] * W, h[1] * H - 30, ui.theme.bad); ui.flash(ui.theme.bad); api.audio.beep(180, 160); api.haptic(60); }
    api.hud.set({ time: String(Math.max(0, Math.ceil(left))) });
    if (left <= 0) { state = 'done'; api.end({ score: got * 100, text: 'انتهى الوقت — جمعت ' + got + ' من ' + STARS.length }); }
  },
  render(ctx, w, h) {
    const th = ui.theme; ui.background(ctx);
    ctx.strokeStyle = th.line; ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(i * w / 8, 0); ctx.lineTo(i * w / 8, h); ctx.stroke(); }
    for (const p of HOLES) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(p[0] * w, p[1] * h, R + 6, 0, 6.2832); ctx.fill(); ctx.strokeStyle = th.bad; ctx.lineWidth = 2; ctx.stroke(); }
    STARS.forEach((p, i) => { if (i < got) return; ctx.globalAlpha = i === got ? 1 : 0.3; ctx.fillStyle = th.warn; ctx.beginPath(); ctx.arc(p[0] * w, p[1] * h, i === got ? 14 : 9, 0, 6.2832); ctx.fill(); }); ctx.globalAlpha = 1;
    ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(bx * w, by * h, R, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(bx * w - 5, by * h - 5, 4, 0, 6.2832); ctx.fill();
    if (state === 'play') ui.progress(ctx, left / TOTAL);
    if (state === 'intro') ui.title(ctx, 'كرة الميزان', 'أمِل الجوال لتدحرج الكرة إلى النجوم الصفراء بالترتيب، وتجنّب الثقوب. هزّ الجوال لإعادة الكرة إلى الوسط.');
    ui.draw(ctx);
  }
});
