// Projective (perspective) quad-to-quad mapping, no dependency.
// Standard approach (Heckbert, "Fundamentals of Texture Mapping and Image Warping"): map the unit
// square to each quad, then compose H = squareToQuad(dst) * inverse(squareToQuad(src)).
//
// 3x3 matrices are flat row-major arrays: [a,b,c, d,e,f, g,h,i].

function squareToQuad(quad) {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  let g = 0;
  let h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const denom = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / denom;
    h = (dx1 * dy3 - dx3 * dy1) / denom;
  }

  const a = p1.x - p0.x + g * p1.x;
  const b = p3.x - p0.x + h * p3.x;
  const c = p0.x;
  const d = p1.y - p0.y + g * p1.y;
  const e = p3.y - p0.y + h * p3.y;
  const f = p0.y;

  return [a, b, c, d, e, f, g, h, 1];
}

function mat3Multiply(A, B) {
  const r = new Array(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      r[row * 3 + col] =
        A[row * 3 + 0] * B[0 * 3 + col] + A[row * 3 + 1] * B[1 * 3 + col] + A[row * 3 + 2] * B[2 * 3 + col];
    }
  }
  return r;
}

function mat3Invert(m) {
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8] = m;
  const c00 = m4 * m8 - m5 * m7;
  const c01 = -(m3 * m8 - m5 * m6);
  const c02 = m3 * m7 - m4 * m6;
  const c10 = -(m1 * m8 - m2 * m7);
  const c11 = m0 * m8 - m2 * m6;
  const c12 = -(m0 * m7 - m1 * m6);
  const c20 = m1 * m5 - m2 * m4;
  const c21 = -(m0 * m5 - m2 * m3);
  const c22 = m0 * m4 - m1 * m3;

  const det = m0 * c00 + m1 * c01 + m2 * c02;
  const invDet = 1 / det;

  return [
    c00 * invDet, c10 * invDet, c20 * invDet,
    c01 * invDet, c11 * invDet, c21 * invDet,
    c02 * invDet, c12 * invDet, c22 * invDet,
  ];
}

// src, dst: arrays of 4 points {x,y} in unit-square order: (0,0), (1,0), (1,1), (0,1).
// Returns a 3x3 homography H mapping points in src-quad space to dst-quad space.
export function quadToQuad(src, dst) {
  const mSrc = squareToQuad(src);
  const mDst = squareToQuad(dst);
  return mat3Multiply(mDst, mat3Invert(mSrc));
}

// Applies H to a point, returning the homogeneous w alongside x/y so callers needing
// perspective-correct interpolation (e.g. per-vertex texture coords in WebGL) can divide by it.
export function applyH(H, p) {
  const X = H[0] * p.x + H[1] * p.y + H[2];
  const Y = H[3] * p.x + H[4] * p.y + H[5];
  const W = H[6] * p.x + H[7] * p.y + H[8];
  return { x: X / W, y: Y / W, w: W };
}
