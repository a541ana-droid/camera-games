// @title سلسلة: فردية تنهار (اختبار)
// @desc تنهار بخطأ إن لم تُلمس خلال 2.5 ث؛ وإلا تنتهي بعدد اللمسات.
// @engine 0.2
// @capabilities hud
let api, taps = 0, t = 0, t1 = -1, done = false;
defineGame({ init(a) { api = a; api.hud.set({ title: 'crash' }); }, onTap() { if (t1 < 0) t1 = t; taps++; },
  update(dt) { t += dt; if (t1 < 0 && t > 2.5) throw new Error('boom-solo'); if (!done && t1 >= 0 && t - t1 > 0.7) { done = true; api.end({ score: taps, text: 'ok' }); } }, render() {} });
