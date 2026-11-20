// Generates the app icons with no dependencies: node scripts/make-icons.mjs
// One design (a clock on blue), drawn in unit coordinates so every size and the SVG stay identical.
// Opaque RGB PNGs: iOS rejects transparent home-screen icons. The glyph sits inside the middle 80%,
// so the same artwork also works as a maskable icon.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const BG = [10, 96, 214];
const FG = [255, 255, 255];

const RING = { cx: 0.5, cy: 0.5, outer: 0.32, inner: 0.26 };
const HUB_RADIUS = 0.032;
const HANDS = [
  { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.33, half: 0.022 },
  { x1: 0.5, y1: 0.5, x2: 0.62, y2: 0.56, half: 0.022 },
];

function distToSegment(px, py, { x1, y1, x2, y2 }) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function isGlyph(px, py) {
  const d = Math.hypot(px - RING.cx, py - RING.cy);
  if (d <= RING.outer && d >= RING.inner) return true;
  if (d <= HUB_RADIUS) return true;
  return HANDS.some(h => distToSegment(px, py, h) <= h.half);
}

const SAMPLES = 4;
function pixel(x, y, size) {
  let hits = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      if (isGlyph((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size)) hits++;
    }
  }
  const a = hits / (SAMPLES * SAMPLES);
  return BG.map((bg, i) => Math.round(bg + (FG[i] - bg) * a));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function png(size) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size);
      raw.set([r, g, b], y * stride + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit, RGB, deflate, no filter, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="rgb(${BG})"/>
  <circle cx="256" cy="256" r="148.5" fill="none" stroke="#fff" stroke-width="30.7"/>
  <g stroke="#fff" stroke-width="22.5" stroke-linecap="round">
    <line x1="256" y1="256" x2="256" y2="169"/>
    <line x1="256" y1="256" x2="317.4" y2="286.7"/>
  </g>
  <circle cx="256" cy="256" r="16.4" fill="#fff"/>
</svg>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon.svg'), svg);
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(join(outDir, name), png(size));
  console.log(`wrote icons/${name}`);
}
