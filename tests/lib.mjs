// أدوات مشتركة لاختبارات Chrome headless عبر CDP. بلا اعتماديات.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export const BASE = process.env.BASE || 'http://127.0.0.1:8453';
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function chrome(opts = {}) {
  const port = opts.port || +process.env.CDP_PORT || 9353;
  const prof = mkdtempSync(join(tmpdir(), 'eng2-')); // ملف تعريف مؤقت يُحذف عند الإغلاق (كان يبقى: 186 ملفًا = 6.2GB ملأت القرص)
  process.on('exit', () => { try { proc.kill('SIGKILL'); rmSync(prof, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { } });
  const proc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--no-first-run', '--window-size=' + (opts.size || '900,700'), ...(opts.fake ? ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] : []), 'about:blank'], { stdio: 'ignore' });
  let ws, id = 0; const pend = new Map(), log = [];
  for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find(x => x.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; }); break; } } catch { } await sleep(200); }
  if (!ws) throw new Error('no chrome');
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method === 'Runtime.consoleAPICalled') log.push('console.' + m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' ')); else if (m.method === 'Runtime.exceptionThrown') log.push('exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300)); else if (m.method === 'Log.entryAdded') log.push('log.' + m.params.entry.level + ': ' + m.params.entry.text.slice(0, 200)); };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result.result.value; };
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable');
  const nav = async (url, wait = 1200) => { await send('Page.navigate', { url }); await sleep(wait); };
  return { send, ev, nav, log, close() { try { ws.close(); } catch { } proc.kill(); }  };
}
export const exfilCount = async () => (await (await fetch(BASE + '/__exfil')).json()).n;
