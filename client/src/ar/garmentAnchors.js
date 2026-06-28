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

// Returns the per-garment image anchors detected at upload time (garmentAnchorDetect.js) if the
// item carries a valid set, else the calibrated template anchors for the layer. Lets uploaded /
// captured garments — whose shoulders/hips sit at different pixels than the seed flat-lays — warp
// correctly instead of all assuming the seed layout.
export function resolveImageAnchors(item, layer) {
  const a = item?.imageAnchors;
  if (
    Array.isArray(a) &&
    a.length === 4 &&
    a.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
  ) {
    return a;
  }
  return LAYER_IMAGE_ANCHORS[getLayer(layer)];
}

// MediaPipe reports per-landmark visibility 0..1; below this we treat a landmark as unreliable and
// either synthesize a replacement or hold the last good quad, rather than anchoring to noise.
const VIS_THRESHOLD = 0.5;
// How long a stale-but-good destination quad may keep being reused after tracking is lost/occluded,
// so the garment doesn't flicker out on a single dropped or low-confidence frame.
const QUAD_HOLD_MS = 500;
const lastGoodQuad = {}; // layer -> { quad, ts }

function lmOk(lm) {
  return lm && (lm.visibility ?? 1) >= VIS_THRESHOLD;
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

// Tops/outerwear anchor to shoulders+hips. Shoulders are the critical, almost-always-visible anchor
// (they set scale + rotation), so they're gated strictly. Hips are often low-confidence or below the
// frame edge in chest-up desk framing — rather than dropping the garment, synthesize a hip line one
// torso-length below the shoulders. The WebGL silhouette-conform pulls the width to the real body
// anyway, so a synthesized hip line is a fine starting point and beats noisy/garbage hip landmarks.
function getTopQuadPx(landmarks, canvasW, canvasH) {
  const lsLm = landmarks[LANDMARK.LEFT_SHOULDER];
  const rsLm = landmarks[LANDMARK.RIGHT_SHOULDER];
  if (!lmOk(lsLm) || !lmOk(rsLm)) return null;
  const ls = toPx(lsLm, canvasW, canvasH);
  const rs = toPx(rsLm, canvasW, canvasH);

  const lhLm = landmarks[LANDMARK.LEFT_HIP];
  const rhLm = landmarks[LANDMARK.RIGHT_HIP];
  let lh, rh;
  if (lmOk(lhLm) && lmOk(rhLm)) {
    lh = toPx(lhLm, canvasW, canvasH);
    rh = toPx(rhLm, canvasW, canvasH);
  } else {
    const torso = distPts(ls, rs) * 1.5; // ~torso length relative to shoulder width
    lh = { x: ls.x, y: ls.y + torso };
    rh = { x: rs.x, y: rs.y + torso };
  }
  return [ls, rs, rh, lh]; // order matches LAYER_LANDMARKS.top: LS, RS, RH, LH
}

// Bottoms anchor to hips+knees, but a typical desk webcam frames chest-up — knees are very
// often out of shot. Rather than letting bottoms silently disappear, extrapolate a
// knee-equivalent point by continuing the shoulder->hip line further down.
function getBottomQuadPx(landmarks, canvasW, canvasH) {
  const lhLm = landmarks[LANDMARK.LEFT_HIP];
  const rhLm = landmarks[LANDMARK.RIGHT_HIP];
  if (!lmOk(lhLm) || !lmOk(rhLm)) return null;
  const lh = toPx(lhLm, canvasW, canvasH);
  const rh = toPx(rhLm, canvasW, canvasH);

  const lkLm = landmarks[LANDMARK.LEFT_KNEE];
  const rkLm = landmarks[LANDMARK.RIGHT_KNEE];
  let lk = lmOk(lkLm) ? toPx(lkLm, canvasW, canvasH) : null;
  let rk = lmOk(rkLm) ? toPx(rkLm, canvasW, canvasH) : null;
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

// Resolves the destination quad (in canvas pixels) for a category from the live landmarks, with
// visibility gating. Returns null if the critical landmarks are missing/low-confidence.
export function getDestQuadPx(landmarks, category, canvasW, canvasH) {
  if (!landmarks) return null;
  const layer = getLayer(category);
  return layer === 'bottom'
    ? getBottomQuadPx(landmarks, canvasW, canvasH)
    : getTopQuadPx(landmarks, canvasW, canvasH);
}

// Same as getDestQuadPx but adds short-lived hysteresis: a freshly-resolved quad is cached per
// layer, and if the next frame can't resolve one (a single dropped/occluded/low-confidence frame),
// the last good quad keeps being used for up to QUAD_HOLD_MS so the garment doesn't flicker out.
export function getStableDestQuad(landmarks, category, canvasW, canvasH) {
  const layer = getLayer(category);
  const quad = getDestQuadPx(landmarks, category, canvasW, canvasH);
  const now = (typeof performance !== 'undefined' ? performance : Date).now();
  if (quad) {
    lastGoodQuad[layer] = { quad, ts: now };
    return quad;
  }
  const cached = lastGoodQuad[layer];
  if (cached && now - cached.ts < QUAD_HOLD_MS) return cached.quad;
  return null;
}

function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function distPts(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Per-category auto-fit: a sensible default scale + vertical nudge applied *before* the user's fit
// sliders, so a freshly-selected garment drapes naturally without anyone touching the controls. The
// homography already lands the garment's shoulder/hip anchors exactly on the body joints, but real
// clothes sit a bit wider than the joint centres and hang slightly below the hip line — these
// multipliers express that. The user's slider value then scales/offsets relative to this baseline.
const AUTO_FIT = {
  top:       { scale: 1.16, yOffset: 0.04 },
  outerwear: { scale: 1.26, yOffset: 0.02 },
  bottom:    { scale: 1.10, yOffset: 0.05 },
};

export function getAutoFit(layer) {
  return AUTO_FIT[getLayer(layer)] || AUTO_FIT.top;
}

// Composes the per-category auto-fit with the user's slider fit (scale multiplies, offset adds).
export function combineFit(auto, user = {}) {
  return {
    scale: auto.scale * (user.scale ?? 1),
    yOffset: auto.yOffset + (user.yOffset ?? 0),
  };
}

// Builds screen-space "occlusion capsules" (line segment + radius, in canvas px) for any arm
// segment that is in front of the torso, using MediaPipe's per-landmark z (depth; smaller = closer
// to camera). The renderer punches these out of the garment alpha so a hand/arm crossing the chest
// occludes the clothing — something the binary person-segmentation mask alone can't do, since it
// only separates person from background, not arm-in-front-of-torso. Capped at 4 capsules.
export function getOcclusionCapsules(landmarks, canvasW, canvasH) {
  const ls = landmarks[LANDMARK.LEFT_SHOULDER];
  const rs = landmarks[LANDMARK.RIGHT_SHOULDER];
  if (!lmOk(ls) || !lmOk(rs)) return [];
  const shoulderW = distPts(toPx(ls, canvasW, canvasH), toPx(rs, canvasW, canvasH));
  const radius = Math.max(8, shoulderW * 0.13);

  // Torso reference depth = mean z of the visible shoulder/hip landmarks.
  const zs = [ls.z, rs.z];
  const lh = landmarks[LANDMARK.LEFT_HIP];
  const rh = landmarks[LANDMARK.RIGHT_HIP];
  if (lmOk(lh)) zs.push(lh.z);
  if (lmOk(rh)) zs.push(rh.z);
  const torsoZ = zs.reduce((a, b) => a + (b ?? 0), 0) / zs.length;
  const MARGIN = 0.04; // how much closer than the torso a joint must be to count as "in front"

  const caps = [];
  const sides = [
    { sh: ls, el: landmarks[LANDMARK.LEFT_ELBOW], wr: landmarks[LANDMARK.LEFT_WRIST] },
    { sh: rs, el: landmarks[LANDMARK.RIGHT_ELBOW], wr: landmarks[LANDMARK.RIGHT_WRIST] },
  ];
  for (const { sh, el, wr } of sides) {
    if (lmOk(el) && (el.z ?? 0) < torsoZ - MARGIN) {
      const a = toPx(sh, canvasW, canvasH);
      const b = toPx(el, canvasW, canvasH);
      caps.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r: radius });
    }
    if (lmOk(el) && lmOk(wr) && (wr.z ?? 0) < torsoZ - MARGIN) {
      const a = toPx(el, canvasW, canvasH);
      const b = toPx(wr, canvasW, canvasH);
      caps.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, r: radius * 0.85 });
    }
    if (caps.length >= 4) break;
  }
  return caps.slice(0, 4);
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
