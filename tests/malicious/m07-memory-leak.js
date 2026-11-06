// @title m07 memory leak (20MB every 50ms up to 500MB, bounded by the test itself)
// @engine 0.2
// @capabilities hud
const keep = []; let k = 0;
defineGame({ init(api) { api.hud.set({ title: "leak" }); const iv = setInterval(() => { if (k >= 25) return clearInterval(iv); keep.push(new Array(2.5e6).fill(k + 0.5)); k++; }, 50); }, update() {}, render() {} });
