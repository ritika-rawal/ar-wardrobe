import { quadToQuad, applyH } from './homography.js';
import {
  resolveImageAnchors,
  getStableDestQuad,
  applyFitToQuad,
  getAutoFit,
  combineFit,
  getOcclusionCapsules,
  getCollarCeilingY,
  getArmPoints,
} from './garmentAnchors.js';

// Max arm-occlusion capsules the fragment shader handles per frame (2 sides × upper-arm + forearm).
const MAX_ARM_CAPSULES = 4;

// Mesh resolution: dense enough that the silhouette-conform step (below) reads as a smooth body
// contour rather than a stepped outline, sparse enough to stay trivial on a GPU (~270 triangles).
const GRID_ROWS = 16;
const GRID_COLS = 10;
const GRID_VERTS = GRID_ROWS * GRID_COLS;

// How strongly the garment's left/right edges get pulled toward the live body silhouette per row
// (1 = snap exactly to the mask edge, 0 = pure homography quad / ignore the mask). Kept under 1 so
// a noisy mask frame can't make the garment edge jump wildly.
const SILHOUETTE_BLEND = 0.55;
const MASK_THRESHOLD = 0.4;

const VERTEX_SRC = `
precision mediump float;
attribute vec2 a_position;
attribute vec3 a_texCoordW;
attribute float a_shade;
uniform vec2 u_resolution;
varying vec3 v_texCoordW;
varying float v_shade;
void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_texCoordW = a_texCoordW;
  v_shade = a_shade;
}
`;

// Perspective-correct UV (divide texcoord by w — the standard trick for true perspective
// interpolation when the GPU only does affine interpolation across a triangle), occlusion
// (multiply alpha by the live person-segmentation mask, toggleable via u_occlusion for
// debugging), and cylindrical shading (v_shade darkens toward the garment's left/right edges to
// fake torso roundness).
const FRAGMENT_SRC = `
precision mediump float;
varying vec3 v_texCoordW;
varying float v_shade;
uniform sampler2D u_garment;
uniform sampler2D u_mask;
uniform vec2 u_resolution;
uniform float u_occlusion;
uniform int u_armCount;
uniform vec4 u_arms[${MAX_ARM_CAPSULES}];   // xy = segment start, zw = segment end (canvas px, y-down)
uniform float u_armRadius[${MAX_ARM_CAPSULES}];

// Shortest distance from point p to the line segment a-b.
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
  return distance(p, a + ab * t);
}

void main() {
  vec2 uv = v_texCoordW.xy / v_texCoordW.z;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    discard;
  }
  vec4 color = texture2D(u_garment, uv);
  vec2 screenUV = gl_FragCoord.xy / u_resolution;
  vec2 maskUV = vec2(screenUV.x, 1.0 - screenUV.y);
  // smoothstep cleans up the soft, flickery grey band at the mask boundary into a stable soft edge,
  // which (with the temporal EMA on the CPU side) kills most of the occlusion shimmer artifacts.
  float personMask = smoothstep(0.35, 0.65, texture2D(u_mask, maskUV).r);

  // Arm-in-front occlusion: carve out fragments inside any active arm capsule so the real arm
  // (live video underneath) shows through instead of the garment. Soft edge to avoid jaggies.
  vec2 fragPx = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float armOcc = 1.0;
  for (int i = 0; i < ${MAX_ARM_CAPSULES}; i++) {
    if (i >= u_armCount) break;
    float d = segDist(fragPx, u_arms[i].xy, u_arms[i].zw);
    armOcc = min(armOcc, smoothstep(u_armRadius[i] - 2.0, u_armRadius[i], d));
  }

  float occlusion = mix(1.0, personMask * armOcc, u_occlusion);
  gl_FragColor = vec4(color.rgb * v_shade, color.a * occlusion);
}
`;

const LAYER_ORDER = ['bottom', 'top', 'outerwear'];

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile failed: ' + log);
  }
  return shader;
}

function createProgram(gl) {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Program link failed: ' + log);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

function createTexture(gl) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function loadImage(src) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = src;
  return img;
}

// Builds the static (grid-shape-only, never changes per frame) mesh index buffer + per-column
// lookup tables, computed once: a "fake cylinder" texture-u remap (compresses texture near the
// garment's left/right edges, like a label wrapping around a can) and a brightness falloff
// (brighter center, darker edges) — both standard techniques for selling roundness on a flat quad.
function buildGridTables() {
  const indices = [];
  for (let r = 0; r < GRID_ROWS - 1; r++) {
    for (let c = 0; c < GRID_COLS - 1; c++) {
      const i0 = r * GRID_COLS + c;
      const i1 = r * GRID_COLS + c + 1;
      const i2 = (r + 1) * GRID_COLS + c;
      const i3 = (r + 1) * GRID_COLS + c + 1;
      indices.push(i0, i1, i2, i1, i3, i2);
    }
  }

  const uTexForCol = new Float32Array(GRID_COLS);
  const shadeForCol = new Float32Array(GRID_COLS);
  for (let c = 0; c < GRID_COLS; c++) {
    const u = c / (GRID_COLS - 1);
    const theta = Math.asin(Math.max(-1, Math.min(1, 2 * u - 1)));
    uTexForCol[c] = theta / Math.PI + 0.5;
    shadeForCol[c] = 0.55 + 0.45 * Math.sin(u * Math.PI);
  }
  const vForRow = new Float32Array(GRID_ROWS);
  for (let r = 0; r < GRID_ROWS; r++) vForRow[r] = r / (GRID_ROWS - 1);

  return { indices: new Uint16Array(indices), uTexForCol, shadeForCol, vForRow };
}
const GRID = buildGridTables();

function sampleMaskAt(mask, mx, my) {
  const cx = Math.max(0, Math.min(mask.width - 1, mx));
  const cy = Math.max(0, Math.min(mask.height - 1, my));
  return mask.data[cy * mask.width + cx];
}

// For one mesh row, looks for the body's left/right silhouette edges near where the homography
// quad currently puts that row, searching a margin around it (not the whole frame) so we don't
// accidentally lock onto an unrelated body part or background noise. Returns null (caller keeps
// the homography position unchanged) if no mask, or no body found in range.
function findSilhouetteEdges(mask, canvasW, canvasH, xMinBaseline, xMaxBaseline, rowYCanvas) {
  if (!mask) return null;
  const span = xMaxBaseline - xMinBaseline;
  if (span < 1) return null;
  const margin = span * 0.6;
  const maskY = Math.round((rowYCanvas / canvasH) * mask.height);
  const maskColMin = Math.max(0, Math.floor(((xMinBaseline - margin) / canvasW) * mask.width));
  const maskColMax = Math.min(mask.width - 1, Math.ceil(((xMaxBaseline + margin) / canvasW) * mask.width));
  if (maskColMin >= maskColMax) return null;

  let leftCol = -1;
  for (let mx = maskColMin; mx <= maskColMax; mx++) {
    if (sampleMaskAt(mask, mx, maskY) > MASK_THRESHOLD) {
      leftCol = mx;
      break;
    }
  }
  if (leftCol === -1) return null;

  let rightCol = -1;
  for (let mx = maskColMax; mx >= maskColMin; mx--) {
    if (sampleMaskAt(mask, mx, maskY) > MASK_THRESHOLD) {
      rightCol = mx;
      break;
    }
  }
  if (rightCol === -1 || rightCol <= leftCol) return null;

  return {
    xMin: (leftCol / mask.width) * canvasW,
    xMax: (rightCol / mask.width) * canvasW,
  };
}

// Creates a WebGL-based garment renderer. Throws if WebGL isn't available — callers should
// catch and fall back to the 2D canvas renderer (garmentRenderer.js) on a *separate* canvas
// element (a canvas that already returned a webgl/webgl2 context can never return a '2d' one).
export function createGLRenderer(canvas) {
  const gl =
    canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: true }) ||
    canvas.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, alpha: true });
  if (!gl) throw new Error('WebGL is not available in this browser');

  const program = createProgram(gl);
  const locations = {
    position: gl.getAttribLocation(program, 'a_position'),
    texCoordW: gl.getAttribLocation(program, 'a_texCoordW'),
    shade: gl.getAttribLocation(program, 'a_shade'),
    resolution: gl.getUniformLocation(program, 'u_resolution'),
    garment: gl.getUniformLocation(program, 'u_garment'),
    mask: gl.getUniformLocation(program, 'u_mask'),
    occlusion: gl.getUniformLocation(program, 'u_occlusion'),
    armCount: gl.getUniformLocation(program, 'u_armCount'),
    arms: gl.getUniformLocation(program, 'u_arms[0]'),
    armRadius: gl.getUniformLocation(program, 'u_armRadius[0]'),
  };

  // Scratch buffers for arm-occlusion uniforms, reused each frame.
  const armData = new Float32Array(MAX_ARM_CAPSULES * 4);
  const armRadii = new Float32Array(MAX_ARM_CAPSULES);

  const positionBuffer = gl.createBuffer();
  const texCoordWBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, GRID.indices, gl.STATIC_DRAW);

  // Shade never changes frame-to-frame (depends only on grid column, not on landmarks) — upload
  // once.
  const shadeBuffer = gl.createBuffer();
  const shadeData = new Float32Array(GRID_VERTS);
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) shadeData[r * GRID_COLS + c] = GRID.shadeForCol[c];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, shadeData, gl.STATIC_DRAW);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // 1x1 opaque "no occlusion" mask used before the first real segmentation result arrives.
  const emptyMaskTexture = createTexture(gl);
  gl.bindTexture(gl.TEXTURE_2D, emptyMaskTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([255]));

  const maskTexture = createTexture(gl);
  let maskUploaded = false;
  let lastMaskRef = null;

  // Temporal mask smoothing: the raw segmentation mask edge wobbles frame-to-frame, which makes the
  // silhouette-conform step jitter the garment's left/right edges. An exponential moving average
  // across frames steadies the edge (and therefore the conformed garment) while still keeping up
  // when the body actually moves. The smoothed buffer doubles as the source for both the GPU
  // occlusion texture and the CPU silhouette-edge search, so the two stay consistent.
  const MASK_SMOOTH = 0.35;
  let smoothedMaskData = null;
  let smoothedMaskW = 0;
  let smoothedMaskH = 0;
  let maskBytes = null;
  let renderMask = null; // smoothed { width, height, data }, reused for silhouette conform

  const garmentTextures = new Map(); // src -> { image, texture, uploaded }

  function getOrCreateGarment(src) {
    let entry = garmentTextures.get(src);
    if (!entry) {
      entry = { image: loadImage(src), texture: createTexture(gl), uploaded: false };
      garmentTextures.set(src, entry);
    }
    return entry;
  }

  function updateMask(mask) {
    const { width: w, height: h, data } = mask;
    const len = w * h;
    if (!smoothedMaskData || smoothedMaskW !== w || smoothedMaskH !== h) {
      // First frame (or a resolution change): seed from this frame, no blend.
      smoothedMaskData = new Float32Array(data);
      smoothedMaskW = w;
      smoothedMaskH = h;
      maskBytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        const v = smoothedMaskData[i] * 255;
        maskBytes[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    } else {
      // Steady state: EMA blend and byte-pack in a single pass over the mask.
      for (let i = 0; i < len; i++) {
        const s = smoothedMaskData[i] + (data[i] - smoothedMaskData[i]) * MASK_SMOOTH;
        smoothedMaskData[i] = s;
        const v = s * 255;
        maskBytes[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, maskBytes);
    maskUploaded = true;
    renderMask = { width: w, height: h, data: smoothedMaskData };
  }

  // Scratch buffers reused every frame to avoid per-frame GC churn.
  const scratchPositions = new Float32Array(GRID_VERTS * 2);
  const scratchTexCoordW = new Float32Array(GRID_VERTS * 3);
  const scratchBaselineX = new Float32Array(GRID_COLS);
  const scratchBaselineY = new Float32Array(GRID_COLS);
  const scratchBaselineW = new Float32Array(GRID_COLS);

  // Builds the full garment mesh for one frame.
  // Steps: homography baseline → silhouette conform → collar ceiling clamp → sleeve bend.
  // collarCeilingY: highest Y the top rows may reach (null = unclamped, used for bottoms).
  // leftArm / rightArm: { shoulder, elbow, wrist } in canvas-px (any field may be null).
  function buildMesh(H, mask, canvasW, canvasH, collarCeilingY, leftArm, rightArm) {
    for (let r = 0; r < GRID_ROWS; r++) {
      const v = GRID.vForRow[r];
      let xMinBaseline = Infinity;
      let xMaxBaseline = -Infinity;
      for (let c = 0; c < GRID_COLS; c++) {
        const u = c / (GRID_COLS - 1);
        const p = applyH(H, { x: u, y: v });
        scratchBaselineX[c] = p.x;
        scratchBaselineY[c] = p.y;
        scratchBaselineW[c] = p.w;
        if (p.x < xMinBaseline) xMinBaseline = p.x;
        if (p.x > xMaxBaseline) xMaxBaseline = p.x;
      }

      const rowYCanvas = (scratchBaselineY[0] + scratchBaselineY[GRID_COLS - 1]) / 2;

      // Silhouette conform: pull outer edges toward body mask edges.
      const edges = findSilhouetteEdges(mask, canvasW, canvasH, xMinBaseline, xMaxBaseline, rowYCanvas);
      let xMinFinal = xMinBaseline;
      let xMaxFinal = xMaxBaseline;
      if (edges) {
        xMinFinal = xMinBaseline + (edges.xMin - xMinBaseline) * SILHOUETTE_BLEND;
        xMaxFinal = xMaxBaseline + (edges.xMax - xMaxBaseline) * SILHOUETTE_BLEND;
      }

      const spanBaseline = xMaxBaseline - xMinBaseline;
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = r * GRID_COLS + c;
        const t = spanBaseline > 1e-3 ? (scratchBaselineX[c] - xMinBaseline) / spanBaseline : 0;
        let finalX = xMinFinal + t * (xMaxFinal - xMinFinal);
        let finalY = scratchBaselineY[c];

        // Collar ceiling clamp: prevents the top of the garment from crawling onto the face.
        // Clamps Y upward (screen-Y increases downward, so max() keeps vertices below ceiling).
        if (collarCeilingY !== null) {
          finalY = Math.max(finalY, collarCeilingY);
        }

        // Sleeve bending: offset outer-column vertices in the top half of the mesh toward the
        // user's elbow/wrist direction, weighted by how close they are to the sleeve corner and
        // how far the arm is raised from its resting (hanging-down) position.
        if (v < 0.55) {
          // Left sleeve: rightmost columns in image-space (large c) correspond to the user's left
          // arm (image is mirrored in a front-facing webcam).
          const arm = c >= GRID_COLS - 3 ? leftArm : (c <= 2 ? rightArm : null);
          if (arm && arm.shoulder && arm.elbow) {
            // Direction from shoulder toward elbow (normalised).
            const dx = arm.elbow.x - arm.shoulder.x;
            const dy = arm.elbow.y - arm.shoulder.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / len, ny = dy / len;

            // Refine direction with wrist if available (more accurate when arm is raised).
            let dirX = nx, dirY = ny;
            if (arm.wrist && arm.elbow) {
              const wx = arm.wrist.x - arm.elbow.x;
              const wy = arm.wrist.y - arm.elbow.y;
              const wl = Math.sqrt(wx * wx + wy * wy) || 1;
              // Blend shoulder→elbow and elbow→wrist directions 50/50.
              dirX = (nx + wx / wl) * 0.5;
              dirY = (ny + wy / wl) * 0.5;
              const dl = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
              dirX /= dl; dirY /= dl;
            }

            // Raise factor: how much the arm is lifted above the resting (straight-down) position.
            // ny negative means elbow is above shoulder — arm is raised.
            const raiseFactor = Math.max(0, -ny); // 0 when arm hangs down, →1 when raised sideways

            // Proximity weight: strongest at outermost column (c=0 or c=COLS-1), fades inward.
            const colDist = c >= GRID_COLS - 3 ? (c - (GRID_COLS - 3)) / 2 : (2 - c) / 2;
            const rowWeight = 1 - v / 0.55; // strongest at the very top (v=0)
            const weight = colDist * rowWeight * raiseFactor;

            // Max offset = half the shoulder width to prevent extreme distortion.
            const maxOffset = (xMaxBaseline - xMinBaseline) * 0.35;
            const offset = Math.min(weight * len * 0.6, maxOffset);
            finalX += dirX * offset;
            finalY += dirY * offset;
          }
        }

        const w = scratchBaselineW[c];
        scratchPositions[idx * 2]     = finalX;
        scratchPositions[idx * 2 + 1] = finalY;
        scratchTexCoordW[idx * 3]     = GRID.uTexForCol[c] * w;
        scratchTexCoordW[idx * 3 + 1] = v * w;
        scratchTexCoordW[idx * 3 + 2] = w;
      }
    }
  }

  function drawGarment(entry, layer, anchors, landmarks, mask, canvasW, canvasH, fit) {
    const img = entry.image;
    if (!img.complete || img.naturalWidth === 0) return;
    if (!entry.uploaded) {
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      entry.uploaded = true;
    }

    const destQuad = getStableDestQuad(landmarks, layer, canvasW, canvasH);
    if (!destQuad) return;
    // Auto-fit (per-category baseline) composed with the user's slider fit.
    const fittedQuad = applyFitToQuad(destQuad, combineFit(getAutoFit(layer), fit));
    const H = quadToQuad(anchors, fittedQuad);

    // Collar ceiling and arm points only matter for tops/outerwear, not bottoms.
    const isTorso = layer === 'top' || layer === 'outerwear';
    const collarCeilingY = isTorso ? getCollarCeilingY(landmarks, canvasW, canvasH) : null;
    const leftArm  = isTorso ? getArmPoints(landmarks, 'left',  canvasW, canvasH) : null;
    const rightArm = isTorso ? getArmPoints(landmarks, 'right', canvasW, canvasH) : null;

    buildMesh(H, mask, canvasW, canvasH, collarCeilingY, leftArm, rightArm);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, scratchPositions, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.position);
    gl.vertexAttribPointer(locations.position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordWBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, scratchTexCoordW, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(locations.texCoordW);
    gl.vertexAttribPointer(locations.texCoordW, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, shadeBuffer);
    gl.enableVertexAttribArray(locations.shade);
    gl.vertexAttribPointer(locations.shade, 1, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.uniform1i(locations.garment, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskUploaded ? maskTexture : emptyMaskTexture);
    gl.uniform1i(locations.mask, 1);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElements(gl.TRIANGLES, GRID.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  return {
    render(landmarks, mask, items, fit, occlusionEnabled = true) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!landmarks) return;

      if (mask && mask !== lastMaskRef) {
        updateMask(mask);
        lastMaskRef = mask;
      }

      gl.useProgram(program);
      gl.uniform2f(locations.resolution, canvas.width, canvas.height);
      gl.uniform1f(locations.occlusion, occlusionEnabled ? 1.0 : 0.0);

      // Arm-in-front occlusion capsules (shared by every garment this frame).
      const caps = getOcclusionCapsules(landmarks, canvas.width, canvas.height);
      gl.uniform1i(locations.armCount, caps.length);
      if (caps.length) {
        for (let i = 0; i < caps.length; i++) {
          const c = caps[i];
          armData[i * 4] = c.ax;
          armData[i * 4 + 1] = c.ay;
          armData[i * 4 + 2] = c.bx;
          armData[i * 4 + 3] = c.by;
          armRadii[i] = c.r;
        }
        gl.uniform4fv(locations.arms, armData);
        gl.uniform1fv(locations.armRadius, armRadii);
      }

      const sorted = [...items].sort(
        (a, b) => LAYER_ORDER.indexOf(a.category) - LAYER_ORDER.indexOf(b.category)
      );
      for (const item of sorted) {
        const src = item.tryOnAssetUrl || item.imageUrl;
        if (!src) continue;
        const layer = item.category === 'bottom' ? 'bottom' : item.category;
        const anchors = resolveImageAnchors(item, layer);
        // Pass the smoothed mask (not the raw frame mask) to the silhouette conform so the garment
        // edges don't inherit the raw mask's per-frame wobble.
        drawGarment(getOrCreateGarment(src), layer, anchors, landmarks, renderMask, canvas.width, canvas.height, fit);
      }
    },
    destroy() {
      for (const entry of garmentTextures.values()) gl.deleteTexture(entry.texture);
      garmentTextures.clear();
      gl.deleteTexture(maskTexture);
      gl.deleteTexture(emptyMaskTexture);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(texCoordWBuffer);
      gl.deleteBuffer(shadeBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
    },
  };
}
