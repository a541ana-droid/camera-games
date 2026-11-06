// @title motion-count (test)
// @engine 0.2
// @capabilities motion.device hud
let n = 0, sh = 0, h;
defineGame({ init(api) { h = api.sensors.motion(d => { n++; if (d.shake) sh++; api.hud.set({ title: [d.x, d.y, d.mag, sh, n].join('|') }); }); globalThis.__h = h; api.hud.set({ title: 'ready' }); }, update() {}, render(c, w, h) { c.fillStyle = '#123'; c.fillRect(0, 0, w, h); } });
