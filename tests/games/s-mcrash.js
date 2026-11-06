// @title سلسلة: جماعية تنهار (اختبار)
// @desc جماعية ترمي خطأ بعد لحظة.
// @engine 0.2
// @capabilities hud players.local
let t = 0;
defineGame({ init(a) { a.players.local(); a.hud.set({ title: 'mc' }); }, update(dt) { t += dt; if (t > 0.4) throw new Error('boom-multi'); }, render() {} });
