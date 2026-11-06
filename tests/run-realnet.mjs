// اتصال Trystero/Nostr حقيقي (يحتاج إنترنت؛ ليس ضمن الحزم الدورية) بين نسختين منفصلتين من Chrome (ملفّا تعريف ومنفذا تصحيح مختلفان):
// زمن الانضمام، زمن الرحلة على قناة البيانات، نوع مرشّح ICE المختار، لعبة حقيقية حتى النهاية، وزمن وصول الضغطة. node tests/run-realnet.mjs
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chrome, BASE, sleep } from './lib.mjs';
const OUT = process.env.SHOTS || tmpdir();
const WRAP = `(()=>{const O=window.RTCPeerConnection; if(!O) return; window.__pcs=[]; window.RTCPeerConnection=function(...a){const p=new O(...a); window.__pcs.push(p); return p}; window.RTCPeerConnection.prototype=O.prototype;})()`;
const STATS = `(async()=>{const out=[]; for(const p of (window.__pcs||[])){ if(p.connectionState!=='connected') continue; const s=await p.getStats(); let pair=null; s.forEach(r=>{ if(r.type==='transport'&&r.selectedCandidatePairId) pair=s.get(r.selectedCandidatePairId); }); if(!pair) s.forEach(r=>{ if(r.type==='candidate-pair'&&r.nominated&&r.state==='succeeded') pair=r; }); if(!pair) continue; const l=s.get(pair.localCandidateId), rm=s.get(pair.remoteCandidateId); out.push({local:l&&l.candidateType, remote:rm&&rm.candidateType, proto:l&&l.protocol, rttMs: pair.currentRoundTripTime!=null? Math.round(pair.currentRoundTripTime*1000*10)/10 : null}); } return out; })()`;
const until = async (f, ms) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await f(); if (v) return v; } catch { } await sleep(250); } return null; };
const host = await chrome({ port: 9490, size: '1920,1080' });
const pad = await chrome({ port: 9491, size: '390,844' });
const res = {};
try {
  await host.send('Page.addScriptToEvaluateOnNewDocument', { source: WRAP }); await pad.send('Page.addScriptToEvaluateOnNewDocument', { source: WRAP });
  await pad.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await host.nav(BASE + '/index.html?nosw=1&debug=1', 1500);
  await host.ev(`document.getElementById('tvBtn').click()`);
  const t0 = Date.now();
  const st = await until(() => host.ev('Pads.state()'), 5000);
  res.kind = st.kind; res.code = st.code;
  res.hostRelays = await until(async () => { const n = await host.ev(`(window.Trystero&&Trystero.getRelaySockets)?Object.values(Trystero.getRelaySockets()).filter(w=>w&&w.readyState===1).length:0`); return n || null; }, 20000); res.netText = await host.ev(`document.getElementById('tvNet').textContent`);
  res.hostRelayMs = Date.now() - t0;
  const t1 = Date.now();
  await pad.nav(st.url, 1500);
  await until(() => pad.ev(`!!document.getElementById('padGo')`), 10000);
  await pad.ev(`document.querySelector('.pname').value='مختبر'`); await pad.ev(`document.getElementById('padGo').click()`);
  const joined = await until(async () => (await host.ev('Pads.state()')).pads.some(p => p.connected), 60000);
  res.joinMs = joined ? Date.now() - t1 : null; res.joined = !!joined;
  if (joined) {
    res.padView = await until(() => pad.ev(`PadApp.state().view==='lobby'?'lobby':null`), 8000);
    const samples = []; for (let i = 0; i < 12; i++) { await sleep(2100); const r = await pad.ev('PadApp.state().rtt'); if (r >= 0) samples.push(r); }
    res.appRttMs = samples; samples.sort((a, b) => a - b); res.appRttMedian = samples[samples.length >> 1];
    res.icePad = await pad.ev(STATS); res.iceHost = await host.ev(STATS);
    // زرّ من الجوال إلى المضيف: عدّاد A يصل
    const s1 = await pad.ev(`(()=>{const s=document.querySelector('.pstart'); return !!s})()`);
    res.leaderStartVisible = s1;
    // لعبة حقيقية عبر الشبكة: مثال §3.4 — عشر ضغطات من الجوال تنهيها؛ ونقيس زمن وصول الضغطة (من إرسال اللمسة إلى رؤية المضيف a=1)
    await host.ev(`Pads._play('tests/games/pad-example.js')`);
    await until(() => pad.ev(`PadApp.state().view==='ctl' && !!document.getElementById('padBtnA')`), 10000); await sleep(800);
    await host.ev(`(()=>{ window.__seen=[]; let prev=0; const f=()=>{ const v=Pads.inputs(); const a=v.length>3?v[3]:0; if(a&&!prev) __seen.push(Date.now()); prev=a; setTimeout(f,0); }; f(); })()`);
    const r = await pad.ev(`(()=>{const e=document.getElementById('padBtnA').getBoundingClientRect(); return [e.x+e.width/2, e.y+e.height/2]})()`);
    const sent = [];
    for (let k = 0; k < 10; k++) { sent.push(Date.now()); await pad.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r[0], y: r[1], button: 'left', buttons: 1, clickCount: 1 }); await sleep(120); await pad.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r[0], y: r[1], button: 'left', buttons: 0, clickCount: 1 }); await sleep(250); }
    const seen = await host.ev('__seen'); res.inputLatencyMs = sent.map((t, k) => seen[k] ? seen[k] - t : null);
    const last = await until(async () => (await host.ev('Pads.state()')).last, 6000); res.realGameEnd = last && { title: last.title, rows: last.rows.map(x => [x.name, x.score]) };
    res.padResultView = await until(() => pad.ev(`PadApp.state().view==='result'?'result':null`), 5000);
    const sh = await host.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(OUT + '/real-tv-lobby.png', Buffer.from(sh.result.data, 'base64'));
    const sp = await pad.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(OUT + '/real-phone-lobby.png', Buffer.from(sp.result.data, 'base64'));
  }
  res.hostLog = host.log.filter(l => /error|exception/i.test(l)).slice(0, 5); res.padLog = pad.log.filter(l => /error|exception/i.test(l)).slice(0, 5);
} catch (e) { res.err = e.stack || e.message; }
console.log(JSON.stringify(res, null, 1));
const pass = res.joined && res.realGameEnd && res.realGameEnd.rows[0][1] === 10 && res.padResultView === 'result';
console.log(pass ? 'PASS real Trystero/Nostr connection + game' : 'FAIL real network');
host.close(); pad.close(); process.exit(pass ? 0 : 1);
