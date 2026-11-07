// @title pack probe (test)
// @engine 0.6
// @capabilities hud
// @pack quiz
// يقرأ api.pack ويحاول تغييره، ثم ينتهي بتقرير JSON في نص النهاية.
let api, rep = null, t = 0;
defineGame({
  init(a) {
    api = a; const p = api.pack; let threw = false;
    if (p) { try { p.title = 'x'; p.questions.push({}); p.questions[0].q = 'hacked'; p.questions[0].choices[0] = 'x'; } catch (e) { threw = true; } }
    rep = p ? { id: p.id, title: p.title, n: p.questions.length, order: p.questions.map(q => q.q), first: p.questions[0], frozen: Object.isFrozen(p) && Object.isFrozen(p.questions) && Object.isFrozen(p.questions[0]) && Object.isFrozen(p.questions[0].choices), threw, keys: Object.keys(p).sort(), qkeys: [...new Set(p.questions.flatMap(q => Object.keys(q)))].sort(), kid: p.questions.filter(q => q.kid).length } : { none: true, has: 'pack' in api };
  },
  update(dt) { t += dt; if (t > 0.3 && rep) { api.end({ score: 1, text: JSON.stringify(rep) }); rep = null; } },
  render(c, w, h) { api.ui.background(c); }
});
