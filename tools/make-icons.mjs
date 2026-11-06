#!/usr/bin/env node
// يولّد icon-192.png وicon-512.png (نفس رسم icon.svg) بلا اعتماديات: node tools/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const L = [[150 + 12, '#f0a53a'], [150 - 12, '#211c18'], [84, '#f0a53a'], [34, '#14110f']]; // دوائر مركزية بإحداثيات 512
function px(x, y) { // x,y في 0..512؛ تنعيم 3x3
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const X = x + (i + .5) / 3 - .5, Y = y + (j + .5) / 3 - .5; let col = hex('#14110f'); const d = Math.hypot(X - 256, Y - 256);
    for (const [rad, c] of L) if (d <= rad) col = hex(c);
    if (Math.hypot(X - 292, Y - 220) <= 14) col = hex('#f3ede4');
    r += col[0]; g += col[1]; b += col[2];
  }
  return [r / 9, g / 9, b / 9];
}
for (const n of [192, 512]) {
  const raw = Buffer.alloc((n * 3 + 1) * n); let o = 0;
  for (let y = 0; y < n; y++) { raw[o++] = 0; for (let x = 0; x < n; x++) { const c = px(x * 512 / n, y * 512 / n); raw[o++] = c[0]; raw[o++] = c[1]; raw[o++] = c[2]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(n, 0); ih.writeUInt32BE(n, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync(join(root, 'icon-' + n + '.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
