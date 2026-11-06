// يشغّل ألعاب tests/malicious في Chrome headless حقيقي عبر CDP، بلا إعادة تحميل الصفحة بين الألعاب (إعادة التحميل لم تعد لازمة).
// الاستعمال: node tests/run-headless.mjs        (خادم node tests/server.mjs على 8453 يجب أن يعمل)
// بيئة: MODE=auto|iframe|host  NOGATE=1 (يعطّل طبقة التعطيل داخل Worker لإظهار ما تغطيه CSP وحدها)  ONLY=m01,m21  JSON=1
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chrome, BASE, sleep, exfilCount } from './lib.mjs';
const dir = join(dirname(fileURLToPath(import.meta.url)), 'malicious'), MODE = process.env.MODE || 'auto', NOGATE = process.env.NOGATE === '1';
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort().filter(f => !only || only.some(o => f.startsWith(o)));
const c = await chrome({ fake: false });
const rows = [];
try {
  await c.nav(BASE + '/index.html?debug=1&mode=' + MODE + (NOGATE ? '&nogate=1' : ''));
  await c.ev(`document.getElementById('synth').checked=true`);
  const ex0 = await exfilCount();
  for (const f of files) {
    const before = await exfilCount();
    const r = await c.ev(`__engine.runTest('tests/malicious/${f}?'+Date.now(), 14000)`);
    let res = null; try { res = r.detail && r.detail.text && JSON.parse(r.detail.text); } catch { }
    const bad = res ? Object.entries(res).filter(([k, v]) => typeof v === 'string' && /^(OPEN|.*FOUND|REPLACED|REDEFINED)/.test(v)).map(([k, v]) => k + '=' + v) : [];
    const row = { f, outcome: r.outcome, ms: r.ms, lag: r.hostMaxLagMs, intact: r.hostIntact, launcherGone: r.iframeGone, camClosed: r.cameraClosed, modes: r.modes.join('>'), fallback: r.fallback, viol: r.viol, exfil: (await exfilCount()) - before, openOrFound: bad, text: r.detail && r.detail.text, overlay: r.outcome.startsWith('stopped') ? r.overlay : undefined };
    rows.push(row); console.log(JSON.stringify(row));
  }
  console.log(JSON.stringify({ summary: { mode: MODE, nogate: NOGATE, games: rows.length, totalExfilHits: (await exfilCount()) - ex0, allIntact: rows.every(r => r.intact), maxLag: Math.max(...rows.map(r => r.lag)), pageErrors: c.log.filter(l => l.startsWith('exception')).length } }));
  if (process.env.LOG) console.log(c.log.join('\n'));
} catch (e) { console.log(e); } finally { c.close(); process.exit(0); }
