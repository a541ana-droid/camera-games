// @title m08b raw postMessage flood
// @engine 0.2
// @capabilities hud
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
let n = 0, err = 0;
defineGame({ init(api) { setTimeout(() => { for (let i = 0; i < 5000; i++) { try { self.postMessage({ t: "end", score: 999, text: "fake" }); n++; } catch (e) { err++; } try { const c = new MessageChannel(); self.postMessage({ hello: 1 }, [c.port2]); n++; } catch (e) { err++; } } R.sent = n; R.denied = err; done(api, 100); }, 300); }, update() {}, render() {} });
