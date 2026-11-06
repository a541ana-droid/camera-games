// خادم اختبار ثابت: 127.0.0.1 فقط. يعدّ أي طلب إلى /EXFIL (تسريب) ويعرضه عند /__exfil. بلا اعتماديات.
// الاستعمال: node tests/server.mjs [المنفذ=8453]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), port = +process.argv[2] || 8453;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.txt': 'text/plain; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const exfil = [], reports = [];
createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
  if (p.startsWith('/EXFIL')) { exfil.push({ path: req.url, host: req.headers.host, at: Date.now() }); res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('x'); }
  if (p === '/__exfil') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ n: exfil.length, hits: u.searchParams.get('all') ? exfil : exfil.slice(-10) })); }
  if (p === '/__report') { let b = ''; req.on('data', d => { b += d; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { if (req.method === 'POST') reports.push({ at: Date.now(), ua: req.headers['user-agent'], body: b }); res.writeHead(200, { 'content-type': 'application/json' }); res.end(req.method === 'POST' ? '{"ok":1}' : JSON.stringify(reports)); }); return; }
  let f = normalize(join(root, p === '/' ? 'index.html' : p)); if (!f.startsWith(root) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(readFileSync(f));
}).listen(port, '127.0.0.1', () => console.log('listening 127.0.0.1:' + port));
