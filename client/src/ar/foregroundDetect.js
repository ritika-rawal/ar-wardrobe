// Lightweight client-side foreground (garment) detector for the live capture preview.
//
// Estimates the background colour from the frame border, flood-fills the connected background-
// coloured region inward, and treats whatever's left as the foreground subject. Returns a downscaled
// mask (to highlight the detected region, iPhone "lift-subject" style), its bounding box, and
// coverage — so the UI can offer "garment detected — capture?" only when a clean, centred object is
// actually present, instead of forcing a countdown. Cheap enough to run a few times a second on a
// downscaled frame.

const DEFAULT_W = 160;
const TOLERANCE = 42; // per-channel background-match tolerance

let scratch = null;
function getCanvas(w, h) {
  if (!scratch) scratch = document.createElement('canvas');
  if (scratch.width !== w || scratch.height !== h) {
    scratch.width = w;
    scratch.height = h;
  }
  return scratch;
}

export function detectForeground(video, sampleW = DEFAULT_W) {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;
  const w = sampleW;
  const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * sampleW));
  const canvas = getCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);

  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null; // tainted canvas
  }

  // Background reference = mean of the border pixels.
  let br = 0, bg = 0, bb = 0, bn = 0;
  const addBorder = (x, y) => {
    const i = (y * w + x) * 4;
    br += data[i]; bg += data[i + 1]; bb += data[i + 2]; bn++;
  };
  for (let x = 0; x < w; x++) { addBorder(x, 0); addBorder(x, h - 1); }
  for (let y = 0; y < h; y++) { addBorder(0, y); addBorder(w - 1, y); }
  br /= bn; bg /= bn; bb /= bn;

  const isBg = (p) => {
    const i = p * 4;
    return (
      Math.abs(data[i] - br) < TOLERANCE &&
      Math.abs(data[i + 1] - bg) < TOLERANCE &&
      Math.abs(data[i + 2] - bb) < TOLERANCE
    );
  };

  // Flood-fill background inward from every border pixel that matches the background colour.
  const bgMask = new Uint8Array(w * h);
  const stack = [];
  const pushIf = (x, y) => {
    const p = y * w + x;
    if (!bgMask[p] && isBg(p)) { bgMask[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) pushIf(x - 1, y);
    if (x < w - 1) pushIf(x + 1, y);
    if (y > 0) pushIf(x, y - 1);
    if (y < h - 1) pushIf(x, y + 1);
  }

  // Foreground = everything the background flood didn't reach.
  const mask = new Uint8Array(w * h);
  let count = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!bgMask[p]) {
        mask[p] = 1;
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const coverage = count / (w * h);
  // A plausible single, centred garment: enough area but not the whole frame, and not glued to all
  // four edges (which usually means a cluttered / non-uniform background, not a cutout-able object).
  const touchesAll = minX <= 0 && minY <= 0 && maxX >= w - 1 && maxY >= h - 1;
  const ok = coverage > 0.05 && coverage < 0.85 && !touchesAll && maxX > minX && maxY > minY;

  return { w, h, mask, coverage, ok, bbox: { minX, minY, maxX, maxY } };
}

// Renders the detected foreground mask into an offscreen canvas as opaque white (transparent
// elsewhere), for use as a stencil when highlighting the region over the live preview. Cached by
// detection object so the per-frame draw loop doesn't rebuild it 60×/sec (detection only updates a
// few times a second).
let stencil = null;
let stencilFor = null;
export function maskToStencil(det) {
  if (det === stencilFor && stencil) return stencil;
  const { w, h, mask } = det;
  if (!stencil) stencil = document.createElement('canvas');
  if (stencil.width !== w || stencil.height !== h) { stencil.width = w; stencil.height = h; }
  const ctx = stencil.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      const o = i * 4;
      img.data[o] = 255; img.data[o + 1] = 255; img.data[o + 2] = 255; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  stencilFor = det;
  return stencil;
}
