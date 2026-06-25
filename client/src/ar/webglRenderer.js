import { quadToQuad, applyH } from './homography.js';
import { LAYER_IMAGE_ANCHORS, getLayer, getDestQuadPx, applyFitToQuad } from './garmentAnchors.js';

// Mesh resolution: dense enough that the silhouette-conform step (below) reads as a smooth body
// contour rather than a stepped outline, sparse enough to stay trivial on a GPU (~270 triangles).
const GRID_ROWS = 16;
const GRID_COLS = 10;
const GRID_VERTS = GRID_ROWS * GRID_COLS;

// How strongly the garment's left/right edges get pulled toward the live body silhouette per row
// (1 = snap exactly to the mask edge, 0 = pure homography quad / ignore the mask). Kept under 1 so
// a noisy mask frame can't make the garment edge jump wildly.
const SILHOUETTE_BLEND = 0.75;
const MASK_THRESHOLD = 0.4;

const VERTEX_SRC = `
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
void main() {
  vec2 uv = v_texCoordW.xy / v_texCoordW.z;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    discard;
  }
  vec4 color = texture2D(u_garment, uv);
  vec2 screenUV = gl_FragCoord.xy / u_resolution;
  vec2 maskUV = vec2(screenUV.x, 1.0 - screenUV.y);
  float personMask = texture2D(u_mask, maskUV).r;
  float occlusion = mix(1.0, personMask, u_occlusion);
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
  };

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

  const garmentTextures = new Map(); // src -> { image, texture, uploaded }

  function getOrCreateGarment(src) {
    let entry = garmentTextures.get(src);
    if (!entry) {
      entry = { image: loadImage(src), texture: createTexture(gl), uploaded: false };
      garmentTextures.set(src, entry);
    }
    return entry;
  }

  function uploadMask(mask) {
    const { width: w, height: h, data } = mask;
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      bytes[i] = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
    }
    gl.bindTexture(gl.TEXTURE_2D, maskTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);
    maskUploaded = true;
  }

  // Scratch buffers reused every frame to avoid per-frame GC churn.
  const scratchPositions = new Float32Array(GRID_VERTS * 2);
  const scratchTexCoordW = new Float32Array(GRID_VERTS * 3);
  const scratchBaselineX = new Float32Array(GRID_COLS);
  const scratchBaselineY = new Float32Array(GRID_COLS);
  const scratchBaselineW = new Float32Array(GRID_COLS);

  // Builds the full garment mesh for one frame: per-row homography baseline, then pulled toward
  // the live body silhouette (mask permitting), then packed into the scratch buffers.
  function buildMesh(H, mask, canvasW, canvasH) {
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
        const finalX = xMinFinal + t * (xMaxFinal - xMinFinal);
        const w = scratchBaselineW[c];

        scratchPositions[idx * 2] = finalX;
        scratchPositions[idx * 2 + 1] = scratchBaselineY[c];
        scratchTexCoordW[idx * 3] = GRID.uTexForCol[c] * w;
        scratchTexCoordW[idx * 3 + 1] = v * w;
        scratchTexCoordW[idx * 3 + 2] = w;
      }
    }
  }

  function drawGarment(entry, layer, landmarks, mask, canvasW, canvasH, fit) {
    const img = entry.image;
    if (!img.complete || img.naturalWidth === 0) return;
    if (!entry.uploaded) {
      gl.bindTexture(gl.TEXTURE_2D, entry.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      entry.uploaded = true;
    }

    const destQuad = getDestQuadPx(landmarks, layer, canvasW, canvasH);
    if (!destQuad) return;
    const fittedQuad = applyFitToQuad(destQuad, fit);
    const H = quadToQuad(LAYER_IMAGE_ANCHORS[getLayer(layer)], fittedQuad);

    buildMesh(H, mask, canvasW, canvasH);

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
        uploadMask(mask);
        lastMaskRef = mask;
      }

      gl.useProgram(program);
      gl.uniform2f(locations.resolution, canvas.width, canvas.height);
      gl.uniform1f(locations.occlusion, occlusionEnabled ? 1.0 : 0.0);

      const sorted = [...items].sort(
        (a, b) => LAYER_ORDER.indexOf(a.category) - LAYER_ORDER.indexOf(b.category)
      );
      for (const item of sorted) {
        const src = item.tryOnAssetUrl || item.imageUrl;
        if (!src) continue;
        const layer = item.category === 'bottom' ? 'bottom' : item.category;
        drawGarment(getOrCreateGarment(src), layer, landmarks, mask, canvas.width, canvas.height, fit);
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
