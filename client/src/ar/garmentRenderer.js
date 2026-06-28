import { resolveImageAnchors, getStableDestQuad, applyFitToQuad } from './garmentAnchors.js';

// Cache loaded <img> elements by src so we don't reload every frame.
const imageCache = new Map();

function loadImage(src) {
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  imageCache.set(src, img);
  return img;
}

/**
 * 2D-canvas fallback for browsers without WebGL (see webglRenderer.js for the real perspective
 * warp + occlusion path). This approximates the same quad correspondence with a single
 * translate+rotate+scale: the image is positioned so its first two anchor points (e.g. both
 * shoulders, or both hips for bottoms — see garmentAnchors.js) land exactly on their matching
 * landmarks; the rest of the garment follows along via uniform scale, so it can't shear/taper
 * the way the WebGL path can, but stays visually close for modest poses.
 */
function drawGarment(ctx, img, item, landmarks, canvasW, canvasH, layer, fit = {}) {
  if (!img.complete || img.naturalWidth === 0) return; // not loaded yet, skip this frame

  const destQuad = getStableDestQuad(landmarks, layer, canvasW, canvasH);
  if (!destQuad) return;
  const quad = applyFitToQuad(destQuad, fit);
  const anchors = resolveImageAnchors(item, layer);

  const screenAngle = Math.atan2(quad[1].y - quad[0].y, quad[1].x - quad[0].x);
  const anchorAngle = Math.atan2(anchors[1].y - anchors[0].y, anchors[1].x - anchors[0].x);
  const topEdgePx = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
  const anchorEdgeFrac = Math.hypot(anchors[1].x - anchors[0].x, anchors[1].y - anchors[0].y);

  const widthPx = topEdgePx / anchorEdgeFrac;
  const aspect = img.naturalHeight / img.naturalWidth;
  const heightPx = widthPx * aspect;

  ctx.save();
  ctx.translate(quad[0].x, quad[0].y);
  ctx.rotate(screenAngle - anchorAngle);
  ctx.drawImage(img, -anchors[0].x * widthPx, -anchors[0].y * heightPx, widthPx, heightPx);
  ctx.restore();
}

/**
 * Renders all selected garments for one frame.
 * items: array of { tryOnAssetUrl | imageUrl, category }
 * fit: { scale, yOffset } -> shared fit-adjustment applied to every garment this frame
 */
export function renderGarments(ctx, landmarks, canvasW, canvasH, items, fit = {}) {
  ctx.clearRect(0, 0, canvasW, canvasH);
  if (!landmarks) return;

  const layerOrder = ['bottom', 'top', 'outerwear'];
  const sorted = [...items].sort(
    (a, b) => layerOrder.indexOf(a.category) - layerOrder.indexOf(b.category)
  );

  for (const item of sorted) {
    const src = item.tryOnAssetUrl || item.imageUrl;
    if (!src) continue;
    const img = loadImage(src);
    const layer = item.category === 'bottom' ? 'bottom' : item.category;
    drawGarment(ctx, img, item, landmarks, canvasW, canvasH, layer, fit);
  }
}
