// @title camera motion probe (test)
// @engine 0.5
// @capabilities camera.motion hud
// يتتبّع الحركة بعتبة 24؛ المضيف يحفظ آخر قياس (tr.last) فيقارن الاختبار حساسية الكاميرا.
defineGame({ init(api) { api.track.motion({ grid: [1, 1], threshold: 24 }, d => api.hud.set({ title: String(d.energy) })); }, update() {}, render(c, w, h) { c.fillStyle = '#123'; c.fillRect(0, 0, w, h); } });
