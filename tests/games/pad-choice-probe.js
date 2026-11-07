// @title مسبار شاشات الجوال
// @desc لعبة اختبار 0.6: أزرار اختيار على كل جوال، ثم مصباح في الظلام على الجوال الأول، وتنتهي حين يجد الكنز.
// @engine 0.6
// @capabilities players.pads hud
// @pads 1-8 free
// @players 1-8
// @minutes 1
// @age 6
// @play pads
// @style versus
let api, ui, phase = 0, t = 0, picks = [], finds = [], fx = 0, fy = 0, downs = 0, wasDown = false, maxFx = 0, keys = '', ids = [], choiceIn = [], doneAt = -1;
const Q = { prompt: '7 × 6 = ؟', items: [{ text: '42', shape: 0 }, { text: '36', shape: 1 }, { text: '48', shape: 2 }, { text: '🍎', color: '#ffffff' }], id: 11 };
defineGame({
  init(a) {
    api = a; ui = a.ui;
    api.pads.onChoice(e => { picks.push(e); });
    api.pads.onFind(e => { finds.push(e); if (doneAt < 0) doneAt = t + 0.3; });
    ids.push(api.pads.choices(-1, Q));
  },
  update(dt) {
    t += dt; const L = api.pads.list;
    if (phase === 0 && picks.length >= 2) { // الجولة الثانية: الجوال 1 يعود ذراعًا، والجوال 0 مصباح في الظلام
      phase = 1; for (const p of L) choiceIn[p.index] = api.pads.input(p.index).choice;
      api.pads.choices(1, null);
      ids.push(api.pads.touch(0, { dark: true, hint: true, light: 0.2, id: 21, items: [{ x: 0.8, y: 0.25, r: 0.08, shape: 'star', color: '#ffc145', goal: true }, { x: 0.2, y: 0.7, r: 0.07, shape: 'square', color: '#4da3ff' }, { x: 0.5, y: 0.5, r: 0.06, text: '🔑' }] }));
      api.pads.say(0, 'ابحث عن النجمة');
    }
    const s = api.pads.input(0); keys = Object.keys(s).sort().join();
    if (s.finger) { fx = s.fx; fy = s.fy; maxFx = Math.max(maxFx, s.fx); if (!wasDown) downs++; } wasDown = s.finger;
    api.hud.set({ score: 'f' + (s.finger ? 'd' : 'u') + s.fx.toFixed(2) + ',' + s.fy.toFixed(2), time: String(phase) });
    if (doneAt >= 0 && t > doneAt) { doneAt = 1e9;
      api.end({ scores: L.map(p => p.index === 0 ? 1 : 0), text: JSON.stringify({ picks, finds, choiceIn, downs, maxFx, keys, ids, last: [fx, fy] }) }); }
  },
  render(c, w, h) { ui.background(c); let i = 0; for (const p of api.pads.list) { const s = api.pads.input(p.index); ui.shape(c, p.colorIndex, w * (++i) / (api.pads.list.length + 1), h * 0.4, 60);
    if (s.finger) { c.fillStyle = p.color; c.beginPath(); c.arc(s.fx * w, s.fy * h, 20, 0, 6.283); c.fill(); } } ui.draw(c); }
});
