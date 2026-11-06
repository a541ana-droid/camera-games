// @title mic-nocap
// @desc يستدعي api.mic بلا قدرة
// @engine 0.2
// @capabilities hud
defineGame({ init(api) { try { api.mic.listen({}, () => {}); } catch (e) { this.err = e.message; } this.api = api; }, update(dt, t) { if (t > 0.3 && !this.done) { this.done = 1; this.api.end({ score: 0, text: 'ERR:' + this.err }); } }, render() {} });
