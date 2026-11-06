// مسبار يدوي: لقطات شاشات البداية (جوال وتلفاز) وتجربة البالون بلا أي حركة (يجب أن يسقط ويرتدّ)
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chrome, BASE, sleep } from './lib.mjs';
const c = await chrome({ port: 9370 });
const shot = async n => { const s = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(tmpdir() + '/probe-' + n + '.png', Buffer.from(s.result.data, 'base64')); console.log('shot', n); };
try {
  for (const [v, w, h, m] of [['phone', 390, 844, true], ['tv', 1920, 1080, false]]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: m });
    await c.nav(BASE + '/index.html?debug=1&mode=auto'); await c.ev(`document.getElementById('synth').checked=true`);
    for (const g of ['balloon-bop', 'simon-zones', 'goalie']) { await c.ev(`__engine.startGame('games/${g}.js')`); await sleep(2000); await shot(g + '-intro-' + v); await c.ev(`__engine.stopGame('exit')`); await sleep(300); }
  }
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await c.nav(BASE + '/index.html?debug=1&mode=auto'); await c.ev(`document.getElementById('synth').checked=true; DebugSynth.state.hand=null; DebugSynth.state.blobs=[]; __engine.events.length=0; __engine.startGame('games/balloon-bop.js')`); await sleep(2000);
  for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: 195, y: 500, button: 'left', clickCount: 1 });
  await sleep(10000); await shot('balloon-still-10s');
  let end = null; for (let i = 0; i < 160 && !end; i++) { await sleep(500); end = await c.ev(`(__engine.events.find(e=>e.n==='end')||{}).d||null`); }
  console.log('balloon no-motion end', JSON.stringify(end));
} finally { c.close(); process.exit(0); }
