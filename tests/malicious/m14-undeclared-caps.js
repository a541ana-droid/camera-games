// @title m14 undeclared caps
// @engine 0.2
// @capabilities hud
const R = {}, V = []; addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0]));
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v),  e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + e.name; } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
// (declares only hud)
defineGame({ init(api) { T("audio_undeclared", () => api.audio.beep(440, 100)); T("haptic_undeclared", () => api.haptic(50)); T("cam_view", () => api.view.showCamera(true)); T("lowres", () => api.camera.lowres(() => {})); T("calib", () => api.calibrate.pickColor()); done(api, 300); }, update() {}, render() {} });
