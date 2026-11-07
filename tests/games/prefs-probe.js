// @title prefs probe (test)
// @engine 0.5
// @capabilities audio haptic hud
// يقرأ api.prefs ويحاول تغييرها، ويصدر نغمات واهتزازًا كل 0.2 ث، ثم ينتهي بعد 1.6 ث بتقرير JSON في نص النهاية.
let api, t = 0, k = 0, rep = null;
defineGame({
  init(a) {
    api = a; const p = api.prefs, before = JSON.stringify(p);
    let threw1 = false, threw2 = false; try { p.roundScale = 99; p.difficulty = 9; p.extra = 1; } catch (e) { threw1 = true; }
    try { api.prefs = { roundScale: 42 }; } catch (e) { threw2 = true; }
    rep = { prefs: JSON.parse(before), frozen: Object.isFrozen(api.prefs), afterMutate: JSON.stringify(api.prefs) === before, sameObj: api.prefs === p, still: api.ui.still, threw1, threw2 };
  },
  update(dt) {
    t += dt; if (t > k * 0.2) { k++; api.audio.beep(660, 60, 0.4); api.audio.melody([{ freq: 500, ms: 40 }]); api.haptic(20); }
    if (t > 1.6 && rep) { api.ui.flash('#ffffff'); api.end({ score: 1, text: JSON.stringify(rep) }); rep = null; }
  },
  render(c, w, h) { api.ui.background(c); api.ui.text(c, 'probe', w / 2, h / 2, 30); api.ui.draw(c); }
});
