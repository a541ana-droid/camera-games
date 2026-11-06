// @title m08 flood through the legit API (100k messages in one tick)
// @engine 0.2
// @capabilities hud audio
defineGame({ init(api) { setTimeout(() => { for (let i = 0; i < 50000; i++) { api.audio.beep(440, 10); api.hud.set({ title: "f" + i }); } }, 300); }, update() {}, render() {} });
