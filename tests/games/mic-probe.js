// @title mic-probe
// @desc يجمع عيّنات الميكروفون ويبلّغ بها
// @engine 0.2
// @capabilities audio.mic hud
let keys = '', n = 0, maxL = 0, onsets = 0, loud = 0, pitch = 0, t0 = 0, err = '', h;
defineGame({
  init(api) { h = api.mic.listen({ hz: 30, threshold: 0.4, pitch: true }, d => { n++; maxL = Math.max(maxL, d.level); if (d.onset) onsets++; if (d.loud) loud++; if (d.pitch > pitch) pitch = d.pitch; if (d.error) err = d.error; keys = Object.keys(d).join(); }); this.api = api; },
  update(dt, t) { if (t > 2.6) { h.stop(); this.api.end({ score: 0, text: JSON.stringify({ n, maxL, onsets, loud, pitch, err, keys }) }); this.update = null; } },
  render(c, w, h2) { c.fillStyle = '#123'; c.fillRect(0, 0, w, h2); }
});
