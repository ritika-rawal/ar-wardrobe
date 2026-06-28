import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

// MediaPipe pose landmark indices we care about for garment anchoring.
// Shoulders+hips anchor tops/outerwear; hips+knees anchor bottoms (pants don't relate to shoulders);
// elbows+wrists drive sleeve bending in the mesh renderer.
export const LANDMARK = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
};

// Asset locations. Default to the public CDNs (cached after first run), but allow a deployment to
// self-host the MediaPipe WASM fileset + .task models for an offline / faster-first-load demo by
// setting these Vite env vars (see README "AR accuracy notes").
const WASM_BASE =
  import.meta.env?.VITE_MEDIAPIPE_WASM_BASE ||
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm';

// Two model tiers. 'full' = more accurate landmarks (better garment anchoring) but a heavier first
// load (~9MB) and per-frame cost; 'lite' = ~3MB, noticeably faster on low-end phones at some
// accuracy cost. Both emit segmentation masks. The active tier is chosen per-device (see
// pickDefaultTier) and can be overridden by the user's quality control in the UI.
const MODEL_URLS = {
  full:
    import.meta.env?.VITE_POSE_MODEL_FULL ||
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  lite:
    import.meta.env?.VITE_POSE_MODEL_LITE ||
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
};

// Heuristic default model tier: low core count / low memory / mobile → 'lite' (the heavy full model
// + always-on segmentation is the most GPU-intensive the app gets, and low-end phones are exactly
// where that bites). Falls back to 'full' on capable desktops. navigator.deviceMemory is
// Chromium-only; absent values are treated as mid-range.
export function pickDefaultTier() {
  if (typeof navigator === 'undefined') return 'full';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  return mobile || cores <= 4 || mem <= 4 ? 'lite' : 'full';
}

const landmarkerCache = new Map(); // tier -> Promise<PoseLandmarker>

async function createLandmarker(tier, delegate) {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URLS[tier] || MODEL_URLS.full, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    outputSegmentationMasks: true,
  });
}

// Loads (and caches per tier) the pose model. Heavy to init, cheap to reuse; switching tiers in the
// UI just resolves a different cached promise. Tries the GPU delegate first (faster); some
// machines/browsers lack WebGL support for it, so it falls back to CPU.
export function getPoseLandmarker(tier = 'full') {
  const key = MODEL_URLS[tier] ? tier : 'full';
  if (!landmarkerCache.has(key)) {
    const promise = createLandmarker(key, 'GPU').catch((err) => {
      console.warn('[ar] GPU delegate failed, falling back to CPU:', err.message);
      return createLandmarker(key, 'CPU');
    });
    landmarkerCache.set(key, promise);
  }
  return landmarkerCache.get(key);
}

let lastTimestampMs = -1;

// Returns { landmarks, mask } for the first detected pose, or null landmarks/mask if nobody's in
// frame. landmarks are normalized (0..1) image coords. mask is a plain { width, height, data }
// (per-pixel person-likelihood, used for garment occlusion) — we copy the pixel data out of
// MediaPipe's MPMask and immediately close() the result, since MPMask holds WASM/GPU-backed
// resources that leak every tick (~24fps) if not explicitly freed.
export function detectPose(landmarker, videoEl, timestampMs) {
  // MediaPipe requires strictly-increasing timestamps; guard against duplicate/out-of-order frames.
  const ts = timestampMs > lastTimestampMs ? timestampMs : lastTimestampMs + 1;
  lastTimestampMs = ts;

  const result = landmarker.detectForVideo(videoEl, ts);
  const landmarks = result.landmarks?.[0] ?? null;

  let mask = null;
  const mpMask = result.segmentationMasks?.[0];
  if (mpMask) {
    mask = { width: mpMask.width, height: mpMask.height, data: mpMask.getAsFloat32Array() };
  }

  result.close();
  return { landmarks, mask };
}
