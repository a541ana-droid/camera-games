// @title m02 realm access (no parent/DOM/host)
// @engine 0.2
// @capabilities hud
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
defineGame({ init(api) {
  T("window", () => typeof window === "undefined" ? (() => { throw { name: "absent" }; })() : 1); T("document", () => typeof document === "undefined" ? (() => { throw { name: "absent" }; })() : 1);
  T("parent", () => typeof parent === "undefined" ? (() => { throw { name: "absent" }; })() : 1); T("top", () => typeof top === "undefined" ? (() => { throw { name: "absent" }; })() : 1);
  T("self.postMessage", () => self.postMessage({ t: "end", score: 999, text: "forged" })); T("postMessage", () => postMessage({ t: "ready" }));
  T("proto.postMessage", () => Object.getPrototypeOf(self).postMessage({ t: "end" })); T("onmessage_set", () => { self.onmessage = () => {}; if (self.onmessage !== null) throw new Error("FOUND:handler-stored"); return "inert"; });
  T("addEventListener_message_after", () => { let seen = 0; addEventListener("message", () => seen++); return "registered"; });
  T("close", () => self.close()); T("__SPEC", () => self.__SPEC ? "present" : (() => { throw { name: "absent" }; })());
  T("location_set", () => { const h = self.location.href; self.location.href = "data:text/html,x"; if (self.location.href !== h) throw new Error("FOUND:changed"); return "inert"; }); T("location_assign", () => self.location.assign("http://localhost:8453/EXFIL/nav"));
  done(api, 800);
}, update() {}, render() {} });
