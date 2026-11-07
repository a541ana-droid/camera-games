// لقطات الشرح القصير قبل اللعب (0.5.1) منتصف الحركة، على جوال 390×844 وتلفاز 1920×1080.
// الاستعمال: SHOTS=/مسار node tests/howto-shots.mjs [لعبة...]
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { chrome, BASE, sleep } from './lib.mjs';
const SHOTS = process.env.SHOTS || tmpdir(); mkdirSync(SHOTS, { recursive: true });
const ALL = ['color-hunt', 'freeze', 'mole-air', 'multi-lane', 'tilt-balance', 'balloon-bop', 'simon-zones', 'goalie', 'lane-dodger', 'bubble-mirror', 'tilt-maze', 'pad-stars', 'pad-tug', 'pad-quick'];
const TAPY = { 'multi-lane': 0.69, 'bubble-mirror': 0.7 }; // زرّ البدء في شاشة الاختيار
const games = process.argv.slice(2).length ? process.argv.slice(2) : ALL, AT = (process.env.AT || '1.4').split(',').map(Number);
const c = await chrome({ port: +process.env.CDP_PORT || 9391, size: '1920,1080' });
try {
  for (const [tag, w, h, mob] of [['phone', 390, 844, true], ['tv', 1920, 1080, false]]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob });
    await c.nav(BASE + '/index.html?debug=1&sensors=1&net=bc&nosw=1', 1500); await c.ev(`document.getElementById('synth').checked=true`);
    for (const g of games) {
      for (const at of AT) {
        await c.ev(`__engine.stopGame('exit'); __engine.events.length=0`); await sleep(200);
        await c.ev(`__engine.startGame('${g.includes('/') ? g : 'games/' + g}.js')`); await sleep(1800);
        for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: w / 2, y: h * (TAPY[g] || 0.62), button: 'left', clickCount: 1 });
        await sleep(at * 1000); // ألعاب الجوالات تبدأ العدّ وحدها أو بنقرة؛ اللقطة منتصف الشرح
        const s = await c.send('Page.captureScreenshot', { format: 'png' }); const f = `${SHOTS}/${g.split('/').pop()}-${tag}${AT.length > 1 ? '-' + at : ''}.png`;
        writeFileSync(f, Buffer.from(s.result.data, 'base64')); console.log(f);
      }
    }
  }
} finally { c.close(); process.exit(0); }
