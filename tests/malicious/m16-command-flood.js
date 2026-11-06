// @title m16 command-buffer flood (1e5 draws per frame)
// @engine 0.2
// @capabilities hud
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
let f = 0, A;
defineGame({ init(api) { A = api; }, update() {}, render(c, w, h) { for (let i = 0; i < 100000; i++) { c.fillRect(i % 100, i % 50, 3, 3); c.fillText("x".repeat(500), 0, 0); } if (++f === 30) A.end({ score: f, text: "survived" }); } });
