import { LANDMARK } from './poseTracker.js';

// Which 4 body landmarks define the destination quad for each garment category, in a consistent
// perimeter order: [topSideA, topSideB, bottomSideB, bottomSideA] (no self-crossing quad).
// Tops/outerwear drape from the shoulders to the hips; bottoms have nothing to do with shoulders,
// so they drape from the hips to the knees instead.
export const LAYER_LANDMARKS = {
  top: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'RIGHT_HIP', 'LEFT_HIP'],
  outerwear: ['LEFT_SHOULDER', 'RIGHT_SHOULDER', 'RIGHT_HIP', 'LEFT_HIP'],
  bottom: ['LEFT_HIP', 'RIGHT_HIP', 'RIGHT_KNEE', 'LEFT_KNEE'],
};

// Where each of the above landmarks sits inside the garment's source image, as fractions
// (0..1, x right / y down) — same order as LAYER_LANDMARKS. These four correspondence points are
// what both the WebGL perspective warp (exact homography) and the 2D fallback (approximated
// translate+rotate+scale) are built from, so the two renderers stay visually consistent.
// Anchor positions calibrated for real flat-lay product photos (512×768):
// garment is vertically centred in the canvas with ~25% transparent padding top and bottom.
// top of garment ≈ y=0.25, shoulders ≈ y=0.30, hips ≈ y=0.65, hem ≈ y=0.75.
export const LAYER_IMAGE_ANCHORS = {
  top: [
    { x: 0.78, y: 0.30 }, // left shoulder
    { x: 0.22, y: 0.30 }, // right shoulder
    { x: 0.28, y: 0.65 }, // right hip
    { x: 0.72, y: 0.65 }, // left hip
  ],
  outerwear: [
    { x: 0.82, y: 0.27 }, // left shoulder (outerwear sits slightly wider)
    { x: 0.18, y: 0.27 }, // right shoulder
    { x: 0.22, y: 0.72 }, // right hip
    { x: 0.78, y: 0.72 }, // left hip
  ],
  bottom: [
    { x: 0.76, y: 0.30 }, // left hip (waistband sits at ~30% of canvas)
    { x: 0.24, y: 0.30 }, // right hip
    { x: 0.30, y: 0.68 }, // right knee
    { x: 0.70, y: 0.68 }, // left knee
  ],
};

export function getLayer(category) {
  return LAYER_IMAGE_ANCHORS[category] ? category : 'top';
}

function toPx(lm, w, h) {
  return lm ? { x: lm.x * w, y: lm.y * h } : null;
}

// Returns the Y-coordinate of the collar ceiling for tops/outerwear: the highest the garment mesh
// top may reach, so the collar never climbs onto the neck or chin. Derived from shoulder landmarks
// (no neck landmark in the 33-point MediaPipe model) — the ceiling sits one neck-length above the
// shoulder midpoint, scaled to shoulder width so it adapts as the user moves closer/farther.
// Returns null if landmarks are insufficient.
export function getCollarCeilingY(landmarks, canvasW, canvasH) {
  const ls = toPx(landmarks[LANDMARK.LEFT_SHOULDER], canvasW, canvasH);
  const rs = toPx(landmarks[LANDMARK.RIGHT_SHOULDER], canvasW, canvasH);
  if (!ls || !rs) return null;
  const shoulderWidth = distPts(ls, rs);
  const midY = (ls.y + rs.y) / 2;
  // 0.18 × shoulderWidth ≈ one neck-height; collar ceiling sits just above the shoulder centre.
  return midY - shoulderWidth * 0.18;
}

// Returns the screen-pixel elbow and wrist points for a given side ('left'/'right'), or null if
// the landmark is missing/low-visibility. Used by the renderer for sleeve bending.
export function getArmPoints(landmarks, side, canvasW, canvasH) {
  const elbowKey = side === 'left' ? LANDMARK.LEFT_ELBOW  : LANDMARK.RIGHT_ELBOW;
  const wristKey = side === 'left' ? LANDMARK.LEFT_WRIST  : LANDMARK.RIGHT_WRIST;
  const shldrKey = side === 'left' ? LANDMARK.LEFT_SHOULDER : LANDMARK.RIGHT_SHOULDER;
  const elbow = landmarks[elbowKey];
  const wrist = landmarks[wristKey];
  const shoulder = landmarks[shldrKey];
  // Require reasonable visibility; MediaPipe visibility is 0–1.
  const ok = (lm) => lm && (lm.visibility ?? 1) > 0.35;
  return {
    shoulder: ok(shoulder) ? toPx(shoulder, canvasW, canvasH) : null,
    elbow:    ok(elbow)    ? toPx(elbow,    canvasW, canvasH) : null,
    wrist:    ok(wrist)    ? toPx(wrist,    canvasW, canvasH) : null,
  };
}

// Bottoms anchor to hips+knees, but a typical desk webcam frames chest-up — knees are very
// often out of shot. Rather than letting bottoms silently disappear, extrapolate a
// knee-equivalent point by continuing the shoulder->hip line further down.
function getBottomQuadPx(landmarks, canvasW, canvasH) {
  const lh = toPx(landmarks[LANDMARK.LEFT_HIP], canvasW, canvasH);
  const rh = toPx(landmarks[LANDMARK.RIGHT_HIP], canvasW, canvasH);
  if (!lh || !rh) return null;

  let lk = toPx(landmarks[LANDMARK.LEFT_KNEE], canvasW, canvasH);
  let rk = toPx(landmarks[LANDMARK.RIGHT_KNEE], canvasW, canvasH);
  if (!lk || !rk) {
    const ls = toPx(landmarks[LANDMARK.LEFT_SHOULDER], canvasW, canvasH);
    const rs = toPx(landmarks[LANDMARK.RIGHT_SHOULDER], canvasW, canvasH);
    if (!ls || !rs) return null;
    const EXTEND = 0.9; // knees are roughly this fraction of a torso-length below the hips
    lk = { x: lh.x + (lh.x - ls.x) * EXTEND, y: lh.y + (lh.y - ls.y) * EXTEND };
    rk = { x: rh.x + (rh.x - rs.x) * EXTEND, y: rh.y + (rh.y - rs.y) * EXTEND };
  }
  return [lh, rh, rk, lk];
}

// Resolves the destination quad (in canvas pixels) for a category from the live landmarks.
// Returns null if required landmarks are missing entirely (e.g. nobody in frame).
export function getDestQuadPx(landmarks, category, canvasW, canvasH) {
  const layer = getLayer(category);
  if (layer === 'bottom') return getBottomQuadPx(landmarks, canvasW, canvasH);

  const keys = LAYER_LANDMARKS[layer];
  const points = [];
  for (const key of keys) {
    const lm = landmarks[LANDMARK[key]];
    if (!lm) return null;
    points.push({ x: lm.x * canvasW, y: lm.y * canvasH });
  }
  return points;
}

function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distPts(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Reproduces the old "size slider + vertical nudge" UX on top of the quad-correspondence
// renderers: inflate the destination quad around its own centroid (scale) and shift it
// vertically by a fraction of its own height (yOffset). Shared by the WebGL and 2D-fallback
// renderers so a slider drag looks the same in both.
export function applyFitToQuad(quad, fit = {}) {
  const { scale = 1, yOffset = 0 } = fit;
  const cx = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
  const cy = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
  const quadHeight = distPts(mid(quad[0], quad[1]), mid(quad[2], quad[3]));
  const yOffsetPx = yOffset * quadHeight;
  return quad.map((p) => ({
    x: cx + (p.x - cx) * scale,
    y: cy + (p.y - cy) * scale + yOffsetPx,
  }));
}
