// @title m17 bad drawing arguments (NaN, negative radius, huge, hostile strings)
// @engine 0.2
// @capabilities hud
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
let f = 0, api0;
defineGame({ init(api) { api0 = api; }, update() {}, render(c, w, h) {
  c.fillRect(NaN, 0, 1, 1); c.fillRect(Infinity, 0, 1, 1); c.arc(0, 0, -5, 0, 7); c.arc("x", 0, 5, 0, 7); c.fillRect(1e300, 1e300, 1e300, 1e300); c.fillRect(undefined, null, {}, []);
  c.fillStyle = "url(javascript:alert(1))"; c.fillStyle = "x".repeat(1e5); c.fillStyle = { toString() { return "red"; } }; c.font = "bold 10px; background:url(http://localhost:8453/EXFIL/font)"; c.font = "999999px sans-serif"; c.textAlign = "bogus"; c.globalCompositeOperation = "bogus"; c.globalAlpha = 99; c.lineWidth = -1;
  c.setLineDash(new Array(1e6).fill(2)); c.setLineDash([1, NaN, -3, "a"]); for (let i = 0; i < 1000; i++) c.save(); for (let i = 0; i < 1005; i++) c.restore();
  const g = c.createLinearGradient(0, 0, 10, 10); g.addColorStop(0, "not-a-color"); g.addColorStop(5, "red"); c.fillStyle = g; c.fillRect(0, 0, 5, 5);
  c.drawImage({ id: 99 }, 0, 0); c.drawImage(null, 0, 0); c.fillText({ toString() { return "obj"; } }, 1, 1); c.fillText(undefined, 1, 1); c.measureText("abc"); c.roundRect(0, 0, 10, 10, [5, 5]); c.roundRect(0, 0, -10, 10, -4);
  if (++f === 40) { R.frames = f; R.mt = c.measureText("hello").width > 0; api0.end({ score: f, text: JSON.stringify(R) }); } } });
