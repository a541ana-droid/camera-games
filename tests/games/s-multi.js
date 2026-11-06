// @title سلسلة: جماعية (اختبار)
// @desc تنتهي فورًا بدرجات لكل لاعب: الثاني أعلى ثم الأول ثم الباقي.
// @engine 0.2
// @capabilities hud players.local
let api, t = 0, done = false, pl;
defineGame({ init(a) { api = a; pl = api.players.local({ names: ['x', 'y'] }); api.hud.set({ title: pl.names.join('|') }); },
  update(dt) { t += dt; if (t > 0.4 && !done) { done = true; api.end({ score: 1, scores: pl.names.map((_, i) => i === 1 ? 9 : i === 0 ? 5 : 1), text: 'names=' + pl.names.join(',') }); } }, render(c, w, h) { c.fillStyle = '#123'; c.fillRect(0, 0, w, h); } });
