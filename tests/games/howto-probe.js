// @title مسبار الشرح القصير
// @desc اختبار 0.5.1: أول ui.countdown يعرض الشرح القصير (≈3.5ث) والثاني أرقامًا عادية (≈2.1ث)؛ onDone مرة واحدة لكل عدّ.
// @howto المس الشاشة لتجمع النقاط
// @howto-act tap
// @engine 0.5
// @capabilities hud
let api, ui, t = 0, phase = 0, d1 = -1, d2 = -1, n1 = 0, n2 = 0, mid = null, t2 = 0;
defineGame({
  init(a) { api = a; ui = a.ui; ui.countdown(3, () => { n1++; d1 = t; }); },
  update(dt) {
    t += dt;
    if (mid === null && t > 2.6) mid = ui.counting; // بعد زمن العدّ القديم (2.1ث) وما زال الشرح جاريًا؟
    if (phase === 0 && d1 >= 0 && t > d1 + 0.8) { phase = 1; t2 = t; ui.countdown(3, () => { n2++; d2 = t - t2; }); }
    if (phase === 1 && d2 >= 0 && t > t2 + d2 + 0.5) { phase = 2; api.end({ score: 0, text: JSON.stringify({ d1: +d1.toFixed(2), d2: +d2.toFixed(2), n1, n2, mid }) }); }
  },
  render(c) { ui.background(c); ui.draw(c); }
});
