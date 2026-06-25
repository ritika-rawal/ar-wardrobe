/**
 * Processes user-supplied garment photos into AR-ready transparent PNGs.
 * - Adaptive BFS flood-fill background removal (samples corner pixels for BG colour)
 * - Trim transparent border
 * - Resize to target canvas with `contain` fit (transparent letterbox)
 *
 * Run: node server/scripts/process-user-garments.mjs
 */

import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, writeFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, '..', 'assets');
const DL = '/mnt/c/Users/Acer/Downloads';

const JOBS = [
  { src: '05d647d83eeafe75e3e729d42e08e8f1.jpg', out: 'tshirt-blue.png',  canvas: [512, 768] },
  { src: '316a7e7377dd6b39100017b33ed3476c.jpg', out: 'tshirt-white.png', canvas: [512, 768] },
  { src: '8f1e96dc4890f226bd85870b9bda9c47.jpg',  out: 'tshirt-black.png', canvas: [512, 768] },
  { src: '08ee942b2dca4d0efd1475a93f5f5d47.jpg', out: 'jeans-blue.png',   canvas: [512, 768] },
  { src: '5e2796fee351c9f045b00db1c982718f.jpg',  out: 'jeans-black.png',  canvas: [512, 768] },
];

// ── Adaptive BFS background removal ──────────────────────────────────────────
// Samples the 4 corners of the image to determine the background colour, then
// flood-fills from all border pixels that are close to that colour, making them
// transparent.  Tolerance is raised slightly so anti-aliasing fringe is also
// removed, but kept tight enough that garment shadows survive.

function removeBackground(rawBuf, width, height) {
  const pixels = new Uint8ClampedArray(rawBuf);
  const total = width * height;

  // Average corner colour → background reference
  const sampleCorner = (x, y) => {
    const i = (y * width + x) * 4;
    return { r: pixels[i], g: pixels[i + 1], b: pixels[i + 2] };
  };
  const corners = [
    sampleCorner(0, 0), sampleCorner(width - 1, 0),
    sampleCorner(0, height - 1), sampleCorner(width - 1, height - 1),
  ];
  const bg = {
    r: corners.reduce((s, c) => s + c.r, 0) / 4,
    g: corners.reduce((s, c) => s + c.g, 0) / 4,
    b: corners.reduce((s, c) => s + c.b, 0) / 4,
  };

  // Tolerance: pixels within this distance (per-channel) from bg are background.
  // 45 catches anti-aliasing fringe while leaving garment shadow detail.
  const TOL = 45;
  function isBg(p) {
    const i = p * 4;
    return (
      Math.abs(pixels[i]     - bg.r) < TOL &&
      Math.abs(pixels[i + 1] - bg.g) < TOL &&
      Math.abs(pixels[i + 2] - bg.b) < TOL
    );
  }

  const visited = new Uint8Array(total);

  // Seed every border pixel that matches background colour
  const queue = [];
  for (let x = 0; x < width; x++) {
    const t = x, b = (height - 1) * width + x;
    if (isBg(t)) queue.push(t);
    if (isBg(b)) queue.push(b);
  }
  for (let y = 1; y < height - 1; y++) {
    const l = y * width, r = y * width + (width - 1);
    if (isBg(l)) queue.push(l);
    if (isBg(r)) queue.push(r);
  }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    if (visited[p]) continue;
    visited[p] = 1;
    pixels[p * 4 + 3] = 0;

    const x = p % width, y = (p / width) | 0;
    for (const n of [p - 1, p + 1, p - width, p + width]) {
      if (n < 0 || n >= total || visited[n]) continue;
      const nx = n % width;
      if (nx < 0 || nx >= width) continue;
      if (isBg(n)) queue.push(n);
    }
  }

  return Buffer.from(pixels.buffer);
}

// ── Process one job ───────────────────────────────────────────────────────────

async function processGarment({ src, out, canvas: [cw, ch] }) {
  process.stdout.write(`  ${out}: loading…`);

  const srcBuf = await sharp(`${DL}/${src}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = srcBuf;

  process.stdout.write(' bg-remove…');
  const cleaned = removeBackground(data, info.width, info.height);

  const withAlpha = await sharp(cleaned, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toBuffer();

  process.stdout.write(' trim+resize…');
  const final = await sharp(withAlpha)
    .trim({ threshold: 12 })
    .resize(cw, ch, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const dest = resolve(ASSETS, out);
  writeFileSync(dest, final);

  const m = await sharp(final).metadata();
  console.log(` ✓  (${m.width}×${m.height}, ${(final.length / 1024).toFixed(0)} KB)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('Processing user garment photos…\n');
for (const job of JOBS) {
  await processGarment(job);
}
console.log('\nAll done → ' + ASSETS);
