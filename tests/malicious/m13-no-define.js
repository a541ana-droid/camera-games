// @title m13 no define
// @engine 0.2
// @capabilities hud audio
const R = {}, V = []; addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0]));
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v),  e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + e.name; } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const x = 1;
