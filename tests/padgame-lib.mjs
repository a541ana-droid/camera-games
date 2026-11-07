// أدوات مشتركة لاختبارات ألعاب الجوالات (مسابقة، سباق الحل، المصباح الخفي) عبر BroadcastChannel (?net=bc): تلفاز 1920×1080 وجوالات 390×844.
// SHOTS=<مجلد> للّقطات (الافتراضي ~/game-lab/team/review-0.6)، CDP_PORT لمنفذ Chrome الخاص بكل مجموعة.
import { writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { chrome, BASE, sleep } from './lib.mjs';
export { sleep };
export const SHOTS = process.env.SHOTS || homedir() + '/game-lab/team/review-0.6'; mkdirSync(SHOTS, { recursive: true });
export async function padSuite(port, names) {
  let fails = 0, total = 0;
  const ok = (n, cond, i) => { total++; if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + n + '  ' + JSON.stringify(i === undefined ? '' : i).slice(0, 400)); return cond; };
  const until = async (f, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await f(); if (v) return v; } catch { } await sleep(100); } return null; };
  const c = await chrome({ port: +process.env.CDP_PORT || port, size: '1920,1080' });
  const Q = '?debug=1&net=bc&nosw=1', pads = [];
  const shot = async (p, n) => { const s = await p.send('Page.captureScreenshot', { format: 'png' }); const f = `${SHOTS}/${n}.png`; writeFileSync(f, Buffer.from(s.result.data, 'base64')); return f; };
  const mouse = async (p, type, x, y) => p.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1 });
  const rect = async (p, sel) => p.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2, r.width, r.height, r.x, r.y]})()`);
  const tapEl = async (p, sel) => { const r = await rect(p, sel); if (!r) throw new Error('no ' + sel); await mouse(p, 'mousePressed', r[0], r[1]); await sleep(40); await mouse(p, 'mouseReleased', r[0], r[1]); await sleep(60); };
  const host = () => c.ev('Pads.state()');
  const ps = p => p.ev('PadApp.state()');
  const endEv = () => c.ev(`(__engine.events.filter(e=>e.n==='end').pop()||{}).d||null`);
  async function boot(roundPref = 0) {
    await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await c.nav(BASE + '/index.html' + Q, 1500);
    await c.ev(`localStorage.setItem('engine-prefs', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('engine-prefs')||'{}'), {round:${roundPref}})))`);
    await c.nav(BASE + '/index.html' + Q, 1500);
    await c.ev(`document.getElementById('tvBtn').click()`); await sleep(800);
    // سجلّ الشاشات التي يرسلها التلفاز إلى الجوالات (للاختبار فقط: أين النجوم، ما الأزرار)
    await c.ev(`(()=>{ window.__scr={}; const o=BroadcastChannel.prototype.postMessage; BroadcastChannel.prototype.postMessage=function(d){ try{ const m=d&&d.d; if(m&&m.t==='scr') window.__scr[m.s]=m; }catch(e){} return o.call(this,d); }; })()`);
    const st = await host();
    for (let i = 0; i < names.length; i++) {
      const p = await c.tab('about:blank');
      await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
      await p.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      await p.nav(st.url, 1500); await until(() => p.ev(`!!document.getElementById('padGo')`), 8000);
      await p.ev(`document.querySelector('.pname').value=${JSON.stringify(names[i])}`); await tapEl(p, `.pch:nth-child(${(i % 4) + 1})`); await tapEl(p, '#padGo');
      pads.push(p);
    }
    return !!(await until(async () => (await host()).pads.filter(p => p.connected).length === names.length, 8000));
  }
  async function play(src) {
    await c.ev(`__engine.events.length=0; Pads._play(${JSON.stringify(src)})`);
    return !!(await until(async () => (await c.ev(`(()=>{const s=__engine.state(); return !!s&&s.ready})()`)) && (await Promise.all(pads.map(p => p.ev('PadApp.state().view')))).every(v => v === 'ctl'), 12000));
  }
  const scrOf = async p => { const s = await ps(p); return s && s.screen ? Object.assign({}, await c.ev(`window.__scr[${s.screen.s}]||null`), { s: s.screen.s, k: s.screen.k, picked: s.screen.picked, found: s.screen.found }) : null; }; // الحالة من الجوال، والمحتوى من سجلّ التلفاز
  async function toLobby(mode) {
    await c.ev(`[...document.querySelectorAll('#tv .row button')].find(b=>b.textContent.includes('الردهة')).click()`); await sleep(400);
    if (mode) { await c.ev(`[...document.querySelectorAll('#tvModes button')].find(b=>b.querySelector('b').textContent===${JSON.stringify(mode)}).click()`); await sleep(300); }
  }
  async function finishChecks() {
    const errs = [...c.log, ...pads.flatMap(p => p.log)].filter(l => l.startsWith('exception'));
    ok('no page exceptions on TV or phones', errs.length === 0, errs.slice(0, 3));
    ok('no violations/game errors on the host', !(await c.ev(`__engine.events.some(e=>e.n==='violation'||e.n==='game-error')`)), await c.ev(`__engine.events.filter(e=>e.n==='violation'||e.n==='game-error').map(e=>e.d)`));
  }
  const done = () => { c.close(); console.log(`\n${total - fails}/${total} passed`); process.exit(fails ? 1 : 0); };
  const fail = e => { fails++; total++; console.log('FAIL ERR', e.stack || e.message); };
  return { c, pads, ok, until, shot, mouse, rect, tapEl, host, ps, endEv, boot, play, scrOf, toLobby, finishChecks, done, fail };
}
