// @title سلسلة: رتب (اختبار)
// @desc تنتهي فورًا برتب: الثاني أولًا ثم الثالث ثم الأول.
// @engine 0.2
// @capabilities hud players.local
let api, t = 0, done = false, pl;
defineGame({ init(a) { api = a; pl = api.players.local(); api.hud.set({ title: 'r' }); },
  update(dt) { t += dt; if (t > 0.4 && !done) { done = true; api.end({ score: 0, ranks: [3, 1, 2, 4], text: 'ranks' }); } }, render() {} });
