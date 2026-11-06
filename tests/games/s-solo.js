// @title سلسلة: فردية (اختبار)
// @desc درجتك = عدد اللمسات؛ تنتهي بعد 0.7 ث من أول لمسة أو 4 ث.
// @engine 0.2
// @capabilities hud
let api, taps = 0, t = 0, t1 = -1, done = false;
defineGame({ init(a) { api = a; api.hud.set({ title: 'solo' }); }, onTap() { if (t1 < 0) t1 = t; taps++; },
  update(dt) { t += dt; if (!done && ((t1 >= 0 && t - t1 > 0.7) || t > 4)) { done = true; api.end({ score: taps, text: 'taps=' + taps }); } }, render(c, w, h) { c.fillStyle = '#321'; c.fillRect(0, 0, w, h); } });
