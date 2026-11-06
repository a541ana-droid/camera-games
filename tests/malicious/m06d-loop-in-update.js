// @title m06d infinite loop inside update() (needs frames)
// @engine 0.2
// @capabilities hud
let n = 0;
defineGame({ init(api) { api.hud.set({ title: "loop" }); }, update() { if (++n === 120) { while (true) { } } }, render() {} });
