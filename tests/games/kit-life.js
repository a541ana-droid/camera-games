// @title اختبار عمر العدّ والنقاط والوميض
// @desc يرسم ui.draw وحدها؛ المضيف يقيس عدد الأوامر المرسومة في كل إطار فيعرف متى كان شيء طافيًا. الزمن يُعلَن في عنوان HUD.
// @series no
// @engine 0.2
// @capabilities hud
let ui, api, done = 0, st = 0;
defineGame({
  init(a) { api = a; ui = a.ui; ui.still = false; },
  update(dt, t) {
    api.hud.set({ title: t.toFixed(2) + '|' + done });
    if (st === 0 && t >= 0.5) { st = 1; ui.pop(5, 100, 200); }
    else if (st === 1 && t >= 2) { st = 2; ui.flash(ui.theme.ok, 0.25); }
    else if (st === 2 && t >= 3) { st = 3; ui.countdown(2, () => { done++; }); }
    else if (st === 3 && t >= 5.5) { st = 4; ui.pop(1, 100, 200); }
    else if (st === 4 && t >= 5.7) { st = 5; ui.cancel(); }
  },
  render(c) { ui.draw(c); }
});
