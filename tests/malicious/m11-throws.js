// @title m11 uncaught throw
// @engine 0.2
// @capabilities hud
defineGame({ init() { setTimeout(() => { throw new Error("boom من داخل اللعبة"); }, 300); }, update() {}, render() {} });
