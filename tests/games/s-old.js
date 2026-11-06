// @title سلسلة: قديمة (اختبار)
// @desc لعبة جماعية بالطراز القديم: api.end({score,text}) بلا نتائج لكل لاعب.
// @engine 0.2
// @capabilities hud players.local
let api, t = 0, done = false;
defineGame({ init(a) { api = a; api.players.local(); api.hud.set({ title: 'old' }); },
  update(dt) { t += dt; if (t > 0.4 && !done) { done = true; api.end({ score: 3, text: 'old style' }); } }, render() {} });
