// @title m07b memory churn (20MB allocated and dropped every 50ms, 40 times = 800MB total, never more than ~40MB alive) — must NOT be stopped
// @engine 0.2
// @capabilities hud
let k = 0, cur = null;
defineGame({ init(api) { api.hud.set({ title: "churn" }); const iv = setInterval(() => { cur = new Float64Array(2.5e6); cur[0] = k; k++; if (k >= 40) { clearInterval(iv); setTimeout(() => api.end({ text: 'survived', score: k }), 300); } }, 50); }, update() {}, render() {} });
