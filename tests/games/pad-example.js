// @title أسرع ضغطة
// @desc أول من يضغط عشر مرات يفوز.
// @engine 0.5
// @capabilities players.pads audio hud
// @pads 1-8 free 2v2 teams
// @series no
let api, ui, n = [], done = false;
defineGame({
  init(a) { api = a; ui = a.ui; api.pads.controls({ stick: false, a: 'اضغط!' }); api.pads.say(-1, 'اضغط عشر مرات!'); },
  update() {
    if (done) return;
    for (const p of api.pads.list) {
      const s = api.pads.input(p.index); if (!s.aTaps) continue;
      n[p.index] = (n[p.index] || 0) + s.aTaps; api.pads.vibrate(p.index, 20);
      if (n[p.index] >= 10) { // انتهت: درجة كل مقعد في خانة index، ودرجة الفريق = أعلى أعضائه
        done = true; const scores = [], team = [0, 0];
        for (const q of api.pads.list) { scores[q.index] = n[q.index] || 0; const t = api.teams.of(q.index); if (t >= 0) team[t] = Math.max(team[t], scores[q.index]); }
        api.end({ scores, teamScores: api.teams.on ? team : undefined, text: p.name + ' أولًا!' });
      }
    }
  },
  render(c, w, h) {
    ui.background(c); const L = api.pads.list, sz = Math.min(160, w * 0.8 / Math.max(1, L.length));
    L.forEach((p, k) => { const x = w / 2 + (k - (L.length - 1) / 2) * sz * 1.2, y = h * 0.5;
      c.globalAlpha = p.connected ? 1 : 0.35; ui.shape(c, p.colorIndex, x, y, sz * ((n[p.index] || 0) >= 10 ? 0.4 : 0.32)); // اللاعب = لونه وشكله
      ui.text(c, p.name + '  ' + ui.num(n[p.index] || 0), x, y + sz * 0.65, Math.max(16, sz * 0.14), ui.theme.fg, true); c.globalAlpha = 1; });
    ui.draw(c);
  }
});
