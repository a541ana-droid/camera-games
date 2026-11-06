// @title m06 infinite loop (while(true) after 0.5s, from a timer)
// @engine 0.2
// @capabilities hud
defineGame({ init(api) { api.hud.set({ title: "loop" }); setTimeout(() => { while (true) { } }, 500); }, update() {}, render() {} });
