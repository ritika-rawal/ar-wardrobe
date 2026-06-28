import { LAYER_IMAGE_ANCHORS } from './garmentAnchors.js';

// Per-garment anchor auto-detection.
//
// The WebGL/2D renderers map four "image anchor" points (where the shoulders/hips sit *inside the
// garment image*) onto the matching body landmarks. The hardcoded LAYER_IMAGE_ANCHORS only line up
// for the seed flat-lay PNGs, which were authored so the garment occupies a known region of the
// canvas. A user-uploaded or camera-captured garment can sit anywhere in its frame at any scale, so
// those fixed anchors land in the wrong place and the overlay is misaligned.
//
// This derives anchors per garment by detecting the cutout's actual opaque bounding box, then
// remapping the calibrated template anchors into that box. It corrects the dominant real-world
// failures — garment off-centre, different padding, different scale/aspect — while preserving the
// hand-tuned shoulder/hip inset ratios baked into the template (so e.g. sleeves aren't pulled in to
// the shoulder joints). For a seed item the detected box ≈ the template box, so anchors come out
// essentially unchanged.

// The bounding box each layer's LAYER_IMAGE_ANCHORS were calibrated against (normalized 0..1 of the
// source image). Every template anchor lies inside its box, so the remap stays within the detected
// box (and therefore within [0,1]).
const TEMPLATE_BOX = {
  top:       { minX: 0.12, maxX: 0.88, minY: 0.25, maxY: 0.75 },
  outerwear: { minX: 0.10, maxX: 0.90, minY: 0.22, maxY: 0.78 },
  bottom:    { minX: 0.22, maxX: 0.78, minY: 0.25, maxY: 0.75 },
};

const DETECT_WIDTH = 128; // downscale for a fast alpha scan
const ALPHA_THRESHOLD = 40; // a pixel counts as garment if alpha exceeds this

function layerFor(category) {
  return TEMPLATE_BOX[category] ? category : 'top';
}

// Analyzes a transparent-PNG cutout blob and returns 4 image-anchor points [{x,y}, …] (normalized
// 0..1, in the same order as LAYER_IMAGE_ANCHORS), or null if detection isn't possible (empty
// cutout, degenerate box, or any decode error — caller then falls back to the template anchors).
export async function detectGarmentAnchors(blob, category) {
  const layer = layerFor(category);
  try {
    const bitmap = await createImageBitmap(blob);
    const w = DETECT_WIDTH;
    const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const { data } = ctx.getImageData(0, 0, w, h);
    let minX = w, maxX = -1, minY = h, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null; // fully transparent — nothing to anchor to

    const box = {
      minX: minX / w,
      maxX: (maxX + 1) / w,
      minY: minY / h,
      maxY: (maxY + 1) / h,
    };
    // Reject implausibly tiny detections (stray speckles) — template anchors are safer there.
    if (box.maxX - box.minX < 0.05 || box.maxY - box.minY < 0.05) return null;

    const tmpl = TEMPLATE_BOX[layer];
    const tW = tmpl.maxX - tmpl.minX;
    const tH = tmpl.maxY - tmpl.minY;
    const dW = box.maxX - box.minX;
    const dH = box.maxY - box.minY;

    return LAYER_IMAGE_ANCHORS[layer].map((p) => ({
      x: box.minX + ((p.x - tmpl.minX) / tW) * dW,
      y: box.minY + ((p.y - tmpl.minY) / tH) * dH,
    }));
  } catch (err) {
    console.warn('[ar] garment anchor detection failed, using template anchors:', err);
    return null;
  }
}
