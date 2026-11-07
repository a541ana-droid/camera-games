// @title اختبار العُدّة بلا أي قدرة
// @desc لا يعلن قدرة واحدة: كل مساعدات api.ui تعمل (الصوت يُتجاهل بصمت). يرسم كل المساعدات كل إطار ويقيس زمن العدّ ويفحص الدوال الصغيرة ثم ينهي بنتيجة JSON.
// @series no
// @engine 0.2
// @capabilities
// @accent #ff7a45
let report = null, ui, api, t0 = -1, tDone = -1, rects = null, T = 0, checks = null, ended = false;
const R = { x: 100, y: 100, w: 100, h: 40 };
function selfCheck() {
  const bad = [], ok = (n, v) => { if (!v) bad.push(n); };
  ok('num0', ui.num(0) === '0'); ok('num1234', ui.num(1234) === '1234'); ok('numNeg', ui.num(-5) === '‎−5'); ok('numRound', ui.num(2.6) === '3'); ok('numNaN', ui.num(NaN) === '0'); ok('numBig', ui.num(1e30).length < 20);
  ok('frozen', Object.isFrozen(ui) && Object.isFrozen(ui.theme) && Object.isFrozen(ui.theme.players));
  ok('accent', ui.theme.accent === '#ff7a45' && ui.theme.onAccent === '#0c0d10'); ok('players', ui.theme.players.length === 4 && ui.theme.players[2].shape === 'square' && ui.theme.players[0].color === '#4da3ff');
  const s = api.view.size(); ok('hitIn', ui.hit(R, 150 / s.w, 120 / s.h)); ok('hitOut', !ui.hit(R, 20 / s.w, 20 / s.h)); ok('hitSlop', ui.hit({ x: 100, y: 100, w: 100, h: 20 }, 150 / s.w, 92 / s.h)); // مدى لمس ≥ 48px
  const rw = ui.row(null, 3, 50, 40); ok('row', rw.length === 3 && rw[0].w > 0 && rw[0].x + rw[0].w <= rw[1].x && rw[2].x + rw[2].w <= s.w + 0.001);
  ok('rowReuse', ui.row(rw, 2, 50, 40) === rw && rw.length === 2);
  ok('noEngineLeak', typeof ui['update'] === 'undefined' && typeof ui['_step'] === 'undefined'); // الخطوة داخلية؛ المفاتيح كلها معلنة
  report = Object.keys(ui).sort();
  try { ui.theme.bg = '#fff'; ok('themeImmutable', ui.theme.bg === '#0c0d10'); } catch (e) { /* التجميد في وضع صارم يرمي: مقبول */ }
  return bad;
}
defineGame({
  init(a) { api = a; ui = a.ui; ui.still = false; checks = selfCheck(); },
  update(dt, t) {
    T = t;
    if (t0 < 0 && t > 0.3) { t0 = t; ui.countdown(3, () => { tDone = T; }); ui.pop(1, 150, 250); ui.pop(-2, 250, 250); ui.pop('جيد!', 200, 300); ui.flash(); }
    if (!ended && t > 4.5) { ended = true; api.end({ score: 1, text: JSON.stringify({ keys: report, checks, cd: tDone < 0 ? -1 : +(tDone - t0).toFixed(2), counting: ui.counting }) }); }
  },
  render(c, w, h) {
    ui.background(c); ui.progress(c, 0.5); ui.title(c, 'عنوان', 'وصف قصير جدًا للتجربة');
    ui.bigText(c, 'رسالة كبيرة', { y: h * 0.3 }); ui.meter(c, 0.5, { threshold: 0.4, label: 'م' }); ui.meter(c, 0.9, { y: h * 0.7, threshold: 0.4, limit: true });
    for (let i = 0; i < 4; i++) { ui.playerChip(c, i, w / 2, h * 0.4 + i * 50, { label: 'لاعب', score: i, active: i === 2 }); ui.shape(c, i, 30 + i * 36, h - 30, 12); }
    rects = ui.row(rects, 3, h * 0.85, 50); ui.button(c, rects[0], 'أ'); ui.button(c, rects[1], 'ب', { on: true }); ui.button(c, rects[2], 'ج', { primary: true });
    ui.text(c, 'نص', 40, 40, 16, '#fff'); ui.draw(c);
    if (T > 3.6) ui.results(c, { title: 'ن', score: 9, label: 'ن', lines: ['أ', 'ب'], players: [{ score: 1 }, { score: 2 }], winner: 1 });
  }
});
