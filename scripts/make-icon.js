// One-off icon generator. Run with `node scripts/make-icon.js`.
// Produces assets/icon.png (512x512), which electron-builder converts to .ico.
import { Jimp } from 'jimp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SIZE = 512;

// Color helpers (force unsigned 32-bit results everywhere)
const rgba = (r, g, b, a = 255) => (((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff)) >>> 0;
function lerp(a, b, t) { return a + (b - a) * t; }
function blend(c1, c2, t) {
  const r1 = (c1 >>> 24) & 0xff, g1 = (c1 >>> 16) & 0xff, b1 = (c1 >>> 8) & 0xff, a1 = c1 & 0xff;
  const r2 = (c2 >>> 24) & 0xff, g2 = (c2 >>> 16) & 0xff, b2 = (c2 >>> 8) & 0xff, a2 = c2 & 0xff;
  return rgba(
    Math.round(lerp(r1, r2, t)),
    Math.round(lerp(g1, g2, t)),
    Math.round(lerp(b1, b2, t)),
    Math.round(lerp(a1, a2, t))
  );
}

const img = new Jimp({ width: SIZE, height: SIZE, color: 0x00000000 });

// Background: rounded-square with green→teal gradient (Spotify-ish accent)
const radius = SIZE * 0.22; // corner radius
const c1 = rgba(29, 185, 84);    // spotify green
const c2 = rgba(6, 195, 167);    // teal
const cx = SIZE / 2, cy = SIZE / 2;

function inRoundedSquare(x, y) {
  const dx = Math.max(Math.abs(x - cx) - (cx - radius), 0);
  const dy = Math.max(Math.abs(y - cy) - (cy - radius), 0);
  return Math.sqrt(dx * dx + dy * dy) <= radius;
}

// Anti-aliased rounded-square distance (returns alpha 0..1 inside, 0 outside)
function aaRSquare(x, y) {
  const dx = Math.max(Math.abs(x - cx) - (cx - radius), 0);
  const dy = Math.max(Math.abs(y - cy) - (cy - radius), 0);
  const d = Math.sqrt(dx * dx + dy * dy) - radius;
  return Math.max(0, Math.min(1, 0.5 - d)); // 1px AA band
}

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const aa = aaRSquare(x, y);
    if (aa <= 0) continue;
    // Diagonal gradient
    const t = ((x + y) / (SIZE * 2));
    const color = blend(c1, c2, t);
    // Apply AA to alpha
    const baseA = color & 0xff;
    const a = Math.round(baseA * aa);
    img.setPixelColor(((color & 0xffffff00) | a) >>> 0, x, y);
  }
}

// Draw a centered play triangle (slightly offset right so it looks balanced)
const triCx = SIZE / 2 + SIZE * 0.04;
const triH = SIZE * 0.42;
const triW = triH * 0.866; // equilateral-ish proportion
const triTopY = SIZE / 2 - triH / 2;
const triLeftX = triCx - triW / 2;

// Triangle vertices (pointing right)
const v1 = [triLeftX, triTopY];
const v2 = [triLeftX, triTopY + triH];
const v3 = [triLeftX + triW, triTopY + triH / 2];

function signTri(p, a, b) {
  return (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
}
function inTriangle(p, a, b, c) {
  const d1 = signTri(p, a, b);
  const d2 = signTri(p, b, c);
  const d3 = signTri(p, c, a);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

const triangleColor = rgba(255, 255, 255, 255);

// Supersample the triangle for smooth edges (4x)
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let count = 0;
    for (let sy = 0; sy < 4; sy++) {
      for (let sx = 0; sx < 4; sx++) {
        const px = x + (sx + 0.5) / 4 - 0.5;
        const py = y + (sy + 0.5) / 4 - 0.5;
        if (inTriangle([px, py], v1, v2, v3)) count++;
      }
    }
    if (count === 0) continue;
    const triAlpha = count / 16;
    // Only draw where background exists
    const existing = img.getPixelColor(x, y);
    if ((existing & 0xff) === 0) continue;
    // Blend triangle over background
    const out = blend(existing, triangleColor, triAlpha);
    img.setPixelColor(((out & 0xffffff00) | (existing & 0xff)) >>> 0, x, y);
  }
}

const outPath = process.argv[2] || 'assets/icon.png';
mkdirSync(dirname(outPath), { recursive: true });
const buf = await img.getBuffer('image/png');
writeFileSync(outPath, buf);
console.log(`Wrote ${outPath} (${SIZE}x${SIZE})`);
