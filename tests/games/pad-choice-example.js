// @title الأكبر يفوز
// @desc ثلاثة أرقام على كل جوال: اضغط الأكبر قبل الجميع.
// @engine 0.6
// @capabilities players.pads audio hud
// @pads 1-8 free
// @players 1-8
// @minutes 1
// @age 5
// @play pads
// @style versus
// @series no
const ROUNDS = [[3, 8, 5], [9, 2, 4], [1, 6, 7]];
let api, ui, round = -1, pts = [], got = false, wait = 0;
function next() {
  round++; got = false;
  if (round >= ROUNDS.length) { const scores = []; for (const p of api.pads.list) scores[p.index] = pts[p.index] || 0; return api.end({ scores, text: 'انتهت الجولات' }); }
  api.pads.choices(-1, { prompt: 'اضغط الأكبر', items: ROUNDS[round].map((n, k) => ({ text: String(n), shape: k })), id: round }); // id = رقم الجولة: ضغطة متأخرة من جولة سابقة لا تُحسب
}
defineGame({
  init(a) {
    api = a; ui = a.ui; next();
    api.pads.onChoice(e => {
      if (e.id !== round || got) return;
      const q = ROUNDS[round];
      if (q[e.choice] === Math.max(...q)) { got = true; pts[e.index] = (pts[e.index] || 0) + 1; api.pads.vibrate(e.index, 60); api.audio.beep(880, 90); wait = 0.8; }
    });
  },
  update(dt) { if (got && wait > 0 && (wait -= dt) <= 0) next(); },
  render(c, w, h) {
    ui.background(c); const L = api.pads.list, q = ROUNDS[Math.min(round, ROUNDS.length - 1)];
    ui.text(c, q.map(String).join('   '), w / 2, h * 0.3, h * 0.12, ui.theme.fg, true);
    L.forEach((p, k) => { const x = w * (k + 1) / (L.length + 1); ui.shape(c, p.colorIndex, x, h * 0.62, 40);
      ui.text(c, p.name + '  ' + ui.num(pts[p.index] || 0), x, h * 0.78, 28, ui.theme.fg, true); });
    ui.draw(c);
  }
});
