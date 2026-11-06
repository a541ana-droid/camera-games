// @title اضغط بسرعة
// @desc اضغط الزرّ أكبر عدد من المرات في عشر ثوانٍ.
// @engine 0.2
// @capabilities audio hud

let api, ui, state = 'intro', score = 0, left = 10, W = 0, H = 0;
const btn = { x: 0, y: 0, w: 0, h: 90 };

defineGame({
  init(a) { api = a; ui = a.ui; api.hud.set({ title: 'اضغط بسرعة' }); },
  onTap(x, y) {
    if (state === 'intro') { state = 'count'; ui.countdown(3, () => { state = 'play'; score = 0; left = 10; }); }
    else if (state === 'play' && ui.hit(btn, x, y)) { score++; ui.pop(1, W / 2, btn.y - 20); api.audio.beep(660, 60); api.hud.set({ score: ui.num(score) }); }
  },
  update(dt) {
    if (state !== 'play') return;
    left -= dt;
    if (left <= 0) { state = 'over'; ui.flash(); api.end({ score, text: 'ضغطتَ ' + ui.num(score) + ' مرة' }); }
  },
  render(c, w, h) {
    W = w; H = h; btn.w = Math.min(w * 0.7, 320); btn.x = (w - btn.w) / 2; btn.y = h * 0.62;
    ui.background(c);
    if (state === 'intro') ui.title(c, 'اضغط بسرعة', 'اضغط الزرّ أكبر عدد من المرات في عشر ثوانٍ');
    else if (state === 'play') { ui.progress(c, left / 10); ui.bigText(c, ui.num(score), { y: h * 0.3 }); ui.button(c, btn, 'اضغط!', { primary: true }); }
    ui.draw(c);
  }
});
