// @title مسبار الأذرع
// @desc لعبة اختبار: تعدّ ضغطات كل جوال وتسجّل العصا والانضمام والمغادرة، وتنتهي عند ضغط B من أول جوال.
// @engine 0.5
// @capabilities players.pads hud
// @pads 1-8 free 1v1 2v2 teams
let api, ui, taps = [], maxX = [], joins = 0, leaves = 0, t = 0, done = false, lastLeft = -1;
defineGame({
  init(a) { api = a; ui = a.ui; api.pads.onJoin(p => { joins++; api.pads.say(p.index, 'مرحبا ' + p.name); }); api.pads.onLeave(p => { leaves++; lastLeft = p.index; });
    api.pads.controls({ stick: true, a: 'نقطة', b: 'إنهاء' }); api.pads.say(-1, 'مرحبا بالجميع'); },
  update(dt) {
    if (done) return; t += dt;
    for (const p of api.pads.list) { const s = api.pads.input(p.index); taps[p.index] = (taps[p.index] || 0) + s.aTaps; maxX[p.index] = Math.max(maxX[p.index] || 0, Math.abs(s.x)); if (s.aDown) api.pads.vibrate(p.index, 20); }
    const first = api.pads.list.find(p => p.connected), s0 = first ? api.pads.input(first.index) : null;
    api.hud.set({ score: 'x' + (s0 ? s0.x.toFixed(2) : '-') + ' a' + (taps[first ? first.index : 0] || 0), time: String(api.pads.count) });
    if ((s0 && s0.bDown) || t > 90) {
      done = true; const n = 8, scores = [], ts = [0, 0];
      for (let i = 0; i < n; i++) scores[i] = taps[i] || 0;
      for (const p of api.pads.list) if (api.teams.of(p.index) >= 0) ts[api.teams.of(p.index)] += taps[p.index] || 0;
      api.end({ score: scores.reduce((a, b) => a + b, 0), scores, teamScores: api.teams.on ? ts : undefined,
        text: JSON.stringify({ list: api.pads.list, taps, maxX, joins, leaves, lastLeft, mode: api.teams.mode, teamsOn: api.teams.on, teamOf: api.pads.list.map(p => api.teams.of(p.index)), count: api.pads.count, hasMascot: typeof ui.mascot === 'function' }) });
    }
  },
  render(c, w, h) { ui.background(c); let i = 0; for (const p of api.pads.list) ui.mascot(c, p.character, w * (i++ + 1) / (api.pads.list.length + 1), h / 2, 120, { mood: p.connected ? 'cheer' : 'sad' }); ui.draw(c); }
});
