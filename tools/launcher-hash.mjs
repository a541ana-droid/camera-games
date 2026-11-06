#!/usr/bin/env node
// يحسب SHA-256 لـlauncher.js ويقارنه بما في index.html وengine.js. مع --write يحدّثهما. (الحاضن مثبّت بتجزئة في CSP؛ تعديله بلا تحديث التجزئة يعطّل وضع iframe فيتراجع المحرك إلى Worker من المضيف.)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), h = 'sha256-' + createHash('sha256').update(readFileSync(join(root, 'launcher.js'))).digest('base64');
let bad = 0;
for (const f of ['index.html', 'engine.js']) {
  const p = join(root, f), s = readFileSync(p, 'utf8'), m = s.match(/sha256-[A-Za-z0-9+/=]{44}/g) || [];
  if (m.length && m.every(x => x === h)) { console.log('ok   ' + f + ' ' + h); continue; }
  if (process.argv.includes('--write')) { writeFileSync(p, s.replace(/sha256-[A-Za-z0-9+/=]{44}/g, h)); console.log('wrote ' + f + ' ' + h); } else { console.log('MISMATCH ' + f + ' (' + m.join(',') + ') != ' + h); bad = 1; }
}
process.exit(bad);
