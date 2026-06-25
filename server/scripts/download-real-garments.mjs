/**
 * Downloads real flat-lay clothing photos from Unsplash, removes white/light
 * backgrounds via BFS flood-fill from image borders, then centres the garment
 * in a portrait canvas sized to match garmentAnchors.js expectations.
 *
 * Run: node server/scripts/download-real-garments.mjs
 */

import sharp from 'sharp';
import https from 'https';
import http from 'http';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = resolve(__dirname, '..', 'assets');
mkdirSync(ASSETS, { recursive: true });

// Unsplash free-tier CDN — no key needed for direct image access (CC0 licence).
// w=900 gives enough resolution for garment detail; q=88 for good quality.
const BASE = 'https://images.unsplash.com/photo-';
const Q = '?w=900&q=88&auto=format&fit=clip';

const GARMENTS = [
  { name: 'tshirt-blue',   id: '1620799139507-2a76f79a2f4d', canvas: [512, 768] },
  { name: 'tshirt-white',  id: '1505308105194-5f5be740d93d', canvas: [512, 768] },
  { name: 'tshirt-black',  id: '1618354691229-88d47f285158', canvas: [512, 768] },
  { name: 'hoodie-grey',   id: '1620799140188-3b2a02fd9a77', canvas: [512, 768] },
  { name: 'jacket-black',  id: '1551028719-00167b16eac5',    canvas: [512, 768] },
  { name: 'jeans-blue',    id: '1637069585336-827b298fe84a', canvas: [512, 768] },
  { name: 'shorts-grey',   id: '1621198059871-0d5f9b449233', canvas: [512, 768] },
  { name: 'shoes-white',   id: '1560769629-975ec94e6a86',    canvas: [512, 400] },
];

// ── HTTP download ─────────────────────────────────────────────────────────────

function download(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ── Background removal: BFS flood-fill from border pixels ────────────────────
//
// Starts from every border pixel that looks like background (light / neutral /
// white) and expands inward through connected similar pixels, making them
// transparent.  The garment stops the fill because its pixels differ clearly
// from the background colour.

function removeBackground(rawBuf, width, height, threshold = 230) {
  const pixels = new Uint8ClampedArray(rawBuf);
  const total = width * height;
  const visited = new Uint8Array(total);

  function pos(x, y) { return y * width + x; }

  function isBackground(p) {
    const i = p * 4;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    // Bright neutral pixels = background
    const bright = r > threshold && g > threshold && b > threshold;
    // OR low-saturation light-grey (handles off-white)
    const lo = Math.min(r, g, b), hi = Math.max(r, g, b);
    const neutral = hi > 180 && (hi - lo) < 35 && lo > 160;
    return bright || neutral;
  }

  // Seed queue with all border pixels that look like background
  const queue = [];
  for (let x = 0; x < width; x++) {
    const t = pos(x, 0), b = pos(x, height - 1);
    if (isBackground(t)) queue.push(t);
    if (isBackground(b)) queue.push(b);
  }
  for (let y = 1; y < height - 1; y++) {
    const l = pos(0, y), r = pos(width - 1, y);
    if (isBackground(l)) queue.push(l);
    if (isBackground(r)) queue.push(r);
  }

  // BFS — intentionally iterative to avoid stack overflow on large images
  let head = 0;
  while (head < queue.length) {
    const p = queue[head++];
    if (visited[p]) continue;
    visited[p] = 1;
    pixels[p * 4 + 3] = 0; // transparent

    const x = p % width, y = (p / width) | 0;
    const ns = [p - 1, p + 1, p - width, p + width];
    for (const n of ns) {
      if (n >= 0 && n < total && !visited[n]) {
        const nx = n % width, ny = (n / width) | 0;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && isBackground(n)) {
          queue.push(n);
        }
      }
    }
  }

  return Buffer.from(pixels.buffer);
}

// ── Process one garment ───────────────────────────────────────────────────────

async function processGarment({ name, id, canvas: [cw, ch] }) {
  const url = `${BASE}${id}${Q}`;
  process.stdout.write(`  ${name}: downloading…`);

  let srcBuf;
  try {
    srcBuf = await download(url);
  } catch (e) {
    console.log(` FAILED (${e.message})`);
    return false;
  }
  process.stdout.write(' removing background…');

  // Decode to raw RGBA
  const { data, info } = await sharp(srcBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleaned = removeBackground(data, info.width, info.height);

  // Re-encode as PNG, trim transparent border, contain in target canvas
  const out = await sharp(cleaned, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();

  const final = await sharp(out)
    .trim({ threshold: 10 })            // crop tight around the garment
    .resize(cw, ch, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // transparent letterbox
    })
    .png()
    .toBuffer();

  const dest = resolve(ASSETS, `${name}.png`);
  writeFileSync(dest, final);

  const meta = await sharp(final).metadata();
  console.log(` ✓  (${meta.width}×${meta.height}, ${(final.length / 1024).toFixed(0)} KB)`);
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('Downloading real garment photos from Unsplash…\n');
let ok = 0;
for (const g of GARMENTS) {
  const success = await processGarment(g);
  if (success) ok++;
}
console.log(`\n${ok}/${GARMENTS.length} garments ready in ${ASSETS}`);
if (ok < GARMENTS.length) {
  console.log('  Failed items kept their previous PNG — run again to retry.');
}
