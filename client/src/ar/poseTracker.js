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

let landmarkerPromise = null;

async function createLandmarker(delegate) {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
  );
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      // 'full' (vs 'lite'): noticeably more accurate landmarks for anchoring the garment mesh,
      // at the cost of a heavier first load + per-frame cost — acceptable on a normal laptop/phone,
      // revisit if low-end devices struggle.
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
      delegate,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    outputSegmentationMasks: true,
  });
}

// Loads the model once and reuses it (heavy to init, cheap to reuse).
// Tries GPU first (faster); some machines/browsers lack WebGL support for it, so falls back to CPU.
export function getPoseLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker('GPU').catch((err) => {
      console.warn('[ar] GPU delegate failed, falling back to CPU:', err.message);
      return createLandmarker('CPU');
    });
  }
  return landmarkerPromise;
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
