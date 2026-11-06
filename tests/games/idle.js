// @title idle (test)
// @engine 0.2
// @capabilities hud
defineGame({ init(api) { api.hud.set({ title: 'idle' }); }, update() {}, render(c, w, h) { c.fillStyle = '#123'; c.fillRect(0, 0, w, h); } });
