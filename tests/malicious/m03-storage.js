// @title m03 storage
// @engine 0.2
// @capabilities hud
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
defineGame({ init(api) {
  T("localStorage", () => localStorage.setItem("x", "1")); T("indexedDB", () => indexedDB.open("x")); T("IDBFactory", () => new IDBFactory());
  T("caches", () => caches.open("x")); T("serviceWorker", () => navigator.serviceWorker.register("/sw.js")); T("navigator.storage", () => navigator.storage.estimate());
  T("openDatabase", () => openDatabase("x", "1", "x", 1)); T("fs", () => webkitRequestFileSystem(0, 1, () => {}, () => {})); T("fsHandle", () => navigator.storage.getDirectory());
  done(api, 500);
}, update() {}, render() {} });
