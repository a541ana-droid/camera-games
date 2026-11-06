// @title سلسلة: لا تنتهي (اختبار)
// @desc لعبة جماعية لا تنتهي ما لم يخرج اللاعب.
// @engine 0.2
// @capabilities hud players.local
defineGame({ init(a) { a.players.local(); a.hud.set({ title: 'hold' }); }, update() {}, render() {} });
