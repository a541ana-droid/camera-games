// @title m09 api tamper + forge
// @engine 0.2
// @capabilities hud
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
defineGame({ init(api) {
  T("hud_huge", () => { api.hud.set({ title: "A".repeat(1e6), score: "9".repeat(1e6) }); return "sent(truncated by runtime)"; });
  T("forge_ready", () => self.postMessage({ t: "ready" })); T("forge_end", () => self.postMessage({ t: "end", score: 1e9, text: "OWNED" }));
  T("undeclared_cam", () => api.track.color({ name: "red" })); T("undeclared_motion", () => api.track.motion({})); T("undeclared_lanes", () => api.track.lanes({ count: 2 })); T("undeclared_players", () => api.track.colorPerPlayer([{ id: "a", color: { name: "red" } }]));
  T("planned_qr", () => api.qr.show("x")); T("planned_hand", () => api.hand.start());
  T("api_overwrite", () => { api.hud.set = null; return typeof api.hud.set; }); T("defineGame_twice", () => defineGame({}));
  done(api, 800);
}, update() {}, render() {} });
