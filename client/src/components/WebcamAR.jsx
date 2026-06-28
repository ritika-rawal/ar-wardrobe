import { useEffect, useMemo, useRef, useState } from 'react';
import { Bug, Camera, Gauge, RefreshCw, User, Video } from 'lucide-react';
import { getPoseLandmarker, detectPose, LANDMARK, pickDefaultTier } from '../ar/poseTracker.js';
import { LandmarkOneEuro } from '../ar/oneEuroFilter.js';
import { createGLRenderer } from '../ar/webglRenderer.js';
import { renderGarments } from '../ar/garmentRenderer.js';

// Debug markers: shoulders/hips/knees drawn as colored dots so pose tracking can be visually
// verified independent of whether garment rendering itself is working.
const DEBUG_POINTS = [
  [LANDMARK.LEFT_SHOULDER, '#ef4444', 'LS'],
  [LANDMARK.RIGHT_SHOULDER, '#ef4444', 'RS'],
  [LANDMARK.LEFT_HIP, '#22c55e', 'LH'],
  [LANDMARK.RIGHT_HIP, '#22c55e', 'RH'],
  [LANDMARK.LEFT_KNEE, '#3b82f6', 'LK'],
  [LANDMARK.RIGHT_KNEE, '#3b82f6', 'RK'],
];

function drawDebugOverlay(canvas, landmarks, w, h, mirrored) {
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (!landmarks) {
    ctx.fillStyle = '#facc15';
    ctx.font = '14px sans-serif';
    ctx.fillText('no pose landmarks detected', 10, 20);
    return;
  }
  ctx.font = '12px sans-serif';
  for (const [idx, color, label] of DEBUG_POINTS) {
    const lm = landmarks[idx];
    if (!lm) continue;
    // Canvas itself isn't CSS-mirrored (so labels stay readable) — flip x manually to match
    // where the dot should appear relative to the (CSS-mirrored) video underneath.
    const x = mirrored ? w - lm.x * w : lm.x * w;
    const y = lm.y * h;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.fillText(label, x + 8, y - 8);
  }
}

const MAX_CANVAS_WIDTH = 720; // cap render resolution so pose detection + drawing stay smooth on phones
const POSE_INTERVAL_MS = 1000 / 24; // pose detection runs ~24fps; canvas still redraws every rAF using the latest known pose
const POSE_LANDMARK_COUNT = 33; // full MediaPipe pose output, so LANDMARK indices line up directly

function describeError(err) {
  if (err?.name === 'NotAllowedError') {
    return 'Camera access was blocked — allow camera permission in your browser and reload.';
  }
  if (err?.name === 'NotFoundError') {
    return 'No camera was found on this device.';
  }
  return err?.message || 'Failed to start AR try-on';
}

export default function WebcamAR({ selectedItems, fit, onSnapshot }) {
  const videoRef = useRef(null);
  // Two separate canvas elements, not one swapped between context types: once a canvas
  // successfully returns a 'webgl'/'webgl2' context, getContext('2d') on that SAME element
  // permanently returns null, even if WebGL setup later fails. Keeping the WebGL attempt and the
  // 2D fallback on separate elements means a failed WebGL init can never break the fallback.
  const glCanvasRef = useRef(null);
  const fallback2DCanvasRef = useRef(null);
  const debugCanvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const glRendererRef = useRef(null);
  const renderBrokenRef = useRef(false);
  const oneEuroRef = useRef(null);
  const lastPoseAtRef = useRef(0);
  const smoothedLandmarksRef = useRef(null);
  const maskRef = useRef(null);
  const workingFacingModeRef = useRef('user');
  // Perf HUD counters (refs so the 60fps loop never triggers a re-render; surfaced to state on a
  // ~500ms cadence instead).
  const frameCountRef = useRef(0);
  const fpsWindowStartRef = useRef(0);
  const poseMsRef = useRef(0);
  // Clip recording
  const mediaRecorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordRafRef = useRef(null);
  const recordTimerRef = useRef(null);

  const [status, setStatus] = useState('Loading AR model...');
  const [error, setError] = useState('');
  const [renderError, setRenderError] = useState('');
  const [rendererInfo, setRendererInfo] = useState('Initializing renderer...');
  const [noPose, setNoPose] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [aspect, setAspect] = useState(4 / 3);
  const [showDebug, setShowDebug] = useState(false);
  const [usingGL, setUsingGL] = useState(true); // optimistic default; corrected once init resolves
  // Default OFF: mask-based body/arm occlusion looks more realistic when clean, but the segmentation
  // mask edge introduces shimmer on some devices — the plain overlay is steadier, so opt-in.
  const [occlusionEnabled, setOcclusionEnabled] = useState(false);
  const [quality, setQuality] = useState('auto'); // 'auto' | 'high' | 'fast'
  const [modelLoading, setModelLoading] = useState(true);
  const [perf, setPerf] = useState({ fps: 0, poseMs: 0 });
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  // Resolve the user-facing quality choice to a concrete model tier. 'auto' picks per-device.
  const tier = useMemo(
    () => (quality === 'auto' ? pickDefaultTier() : quality === 'fast' ? 'lite' : 'full'),
    [quality]
  );
  const showDebugRef = useRef(false);
  useEffect(() => {
    showDebugRef.current = showDebug;
  }, [showDebug]);
  const occlusionEnabledRef = useRef(false);
  useEffect(() => {
    occlusionEnabledRef.current = occlusionEnabled;
  }, [occlusionEnabled]);
  const mirroredRef = useRef(true);
  useEffect(() => {
    mirroredRef.current = facingMode === 'user';
  }, [facingMode]);

  // Kept in refs so selecting a garment or dragging a fit slider never restarts the camera —
  // the render loop below always reads the latest value without re-running the setup effect.
  const selectedItemsRef = useRef(selectedItems);
  const fitRef = useRef(fit);
  useEffect(() => {
    selectedItemsRef.current = selectedItems;
  }, [selectedItems]);
  useEffect(() => {
    fitRef.current = fit;
  }, [fit]);

  // Load the pose model for the active tier; the render loop picks it up via the ref once ready.
  // Re-runs when the user changes quality (auto/high/fast) — the old landmarker is dropped from the
  // ref so the loop idles on the last frame until the new tier resolves (cached after first load).
  useEffect(() => {
    let stopped = false;
    setModelLoading(true);
    landmarkerRef.current = null;
    getPoseLandmarker(tier)
      .then((lm) => {
        if (!stopped) {
          landmarkerRef.current = lm;
          setModelLoading(false);
        }
      })
      .catch((err) => {
        if (!stopped) setError('Failed to load AR model: ' + (err.message || err));
      });
    return () => {
      stopped = true;
    };
  }, [tier]);

  // WebGL garment renderer (perspective warp + segmentation occlusion), attempted on its own
  // dedicated canvas. Falls back to the 2D canvas renderer on a separate element if WebGL isn't
  // available, so the demo never hard-fails to a black box.
  useEffect(() => {
    const canvas = glCanvasRef.current;
    if (!canvas) return;
    try {
      glRendererRef.current = createGLRenderer(canvas);
      setUsingGL(true);
      setRendererInfo('Renderer: WebGL (perspective warp + occlusion)');
    } catch (err) {
      console.warn('[ar] WebGL unavailable, falling back to 2D overlay:', err);
      glRendererRef.current = null;
      setUsingGL(false);
      setRendererInfo('Renderer: 2D fallback — WebGL init failed: ' + (err.message || err));
    }
    return () => {
      glRendererRef.current?.destroy();
      glRendererRef.current = null;
    };
  }, []);

  // Render loop: independent of camera/model readiness — just waits until both are available.
  // Pose detection is throttled; the canvas still redraws every animation frame using the last
  // known (One-Euro smoothed) landmarks so the overlay doesn't look like it's running at low fps.
  useEffect(() => {
    let stopped = false;
    oneEuroRef.current = new LandmarkOneEuro(POSE_LANDMARK_COUNT);

    function loop() {
      if (stopped) return;
      const video = videoRef.current;
      const activeCanvas = glRendererRef.current ? glCanvasRef.current : fallback2DCanvasRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !activeCanvas || video.readyState < 2 || !landmarker) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const targetWidth = Math.min(video.videoWidth, MAX_CANVAS_WIDTH);
      const targetHeight = Math.round((targetWidth / video.videoWidth) * video.videoHeight);
      if (activeCanvas.width !== targetWidth || activeCanvas.height !== targetHeight) {
        activeCanvas.width = targetWidth;
        activeCanvas.height = targetHeight;
      }

      const now = performance.now();

      // FPS meter: count every rendered frame, publish to state ~twice a second.
      frameCountRef.current++;
      if (fpsWindowStartRef.current === 0) {
        fpsWindowStartRef.current = now;
      } else if (now - fpsWindowStartRef.current >= 500) {
        const fps = Math.round((frameCountRef.current * 1000) / (now - fpsWindowStartRef.current));
        setPerf({ fps, poseMs: Math.round(poseMsRef.current) });
        fpsWindowStartRef.current = now;
        frameCountRef.current = 0;
      }

      if (now - lastPoseAtRef.current >= POSE_INTERVAL_MS) {
        lastPoseAtRef.current = now;
        const poseStart = performance.now();
        const { landmarks, mask } = detectPose(landmarker, video, now);
        poseMsRef.current = performance.now() - poseStart;
        smoothedLandmarksRef.current = oneEuroRef.current.filter(landmarks, now);
        maskRef.current = mask;
        setNoPose(!landmarks);
      }

      if (!renderBrokenRef.current) {
        try {
          if (glRendererRef.current) {
            glRendererRef.current.render(
              smoothedLandmarksRef.current,
              maskRef.current,
              selectedItemsRef.current,
              fitRef.current,
              occlusionEnabledRef.current
            );
          } else {
            const ctx = activeCanvas.getContext('2d');
            renderGarments(ctx, smoothedLandmarksRef.current, activeCanvas.width, activeCanvas.height, selectedItemsRef.current, fitRef.current);
          }
        } catch (err) {
          // Stop retrying every frame (avoids spamming the console 24x/sec) but keep the rest of
          // the loop alive — camera + debug overlay below still run so this is diagnosable.
          console.error('[ar] garment render failed:', err);
          setRenderError(err.message || String(err));
          renderBrokenRef.current = true;
        }
      }

      if (showDebugRef.current && debugCanvasRef.current) {
        drawDebugOverlay(debugCanvasRef.current, smoothedLandmarksRef.current, activeCanvas.width, activeCanvas.height, mirroredRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Camera stream: re-runs whenever facingMode changes (flip button), without touching the
  // pose model, GL renderer, or the render loop above.
  useEffect(() => {
    let stopped = false;

    async function start() {
      try {
        setSwitchingCamera(true);
        setStatus(streamRef.current ? 'Switching camera...' : 'Requesting webcam access...');

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera requires a secure connection (https:// or localhost).');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Only stop the previous stream once the new one has succeeded, so a failed flip
        // (e.g. no rear camera) doesn't kill the working feed.
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        workingFacingModeRef.current = facingMode;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Adapt the AR stage to whatever aspect ratio the device actually gave us (phones in
        // portrait often report a taller-than-wide stream) instead of assuming a fixed 4:3 box.
        const { videoWidth, videoHeight } = videoRef.current;
        if (videoWidth && videoHeight) setAspect(videoWidth / videoHeight);

        setStatus('Tracking...');
        setError('');
      } catch (err) {
        setError(describeError(err));
        setStatus('');
        setFacingMode(workingFacingModeRef.current);
      } finally {
        setSwitchingCamera(false);
      }
    }

    start();

    return () => {
      stopped = true;
    };
  }, [facingMode]);

  // Final cleanup on unmount — the effect above swaps streams in place on flip, so the actual
  // "stop everything" only needs to happen once, here.
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleFlipCamera() {
    if (switchingCamera) return;
    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
  }

  function takeSnapshot() {
    const video = videoRef.current;
    const overlay = glRendererRef.current ? glCanvasRef.current : fallback2DCanvasRef.current;
    const out = document.createElement('canvas');
    out.width = video.videoWidth;
    out.height = video.videoHeight;
    const ctx = out.getContext('2d');
    if (facingMode === 'user') {
      // Mirror the baked-in snapshot to match what the user saw on screen (front camera is mirrored).
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, out.width, out.height);
    ctx.drawImage(overlay, 0, 0, out.width, out.height);
    const dataUrl = out.toDataURL('image/png');
    onSnapshot?.(dataUrl);
  }

  // Records a short composite clip (live video + garment overlay) and shares or downloads it. Uses
  // MediaRecorder over a canvas captureStream — the canvas is redrawn each frame so the overlay is
  // baked in, with the same mirroring the user sees.
  const RECORD_SECONDS = 4;
  const canRecord =
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';

  function recorderMime() {
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    for (const t of types) {
      if (MediaRecorder.isTypeSupported?.(t)) return t;
    }
    return '';
  }

  function startRecording() {
    if (recording || !canRecord) return;
    const video = videoRef.current;
    const overlay = glRendererRef.current ? glCanvasRef.current : fallback2DCanvasRef.current;
    if (!video || video.readyState < 2) return;

    const w = Math.min(video.videoWidth, MAX_CANVAS_WIDTH);
    const h = Math.round((w / video.videoWidth) * video.videoHeight);
    const composite = document.createElement('canvas');
    composite.width = w;
    composite.height = h;
    const cctx = composite.getContext('2d');
    const mirror = facingMode === 'user';

    let stream;
    try {
      stream = composite.captureStream(30);
      const mime = recorderMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recordChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size) recordChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || 'video/webm' });
        finalizeClip(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
    } catch (err) {
      console.error('[ar] clip recording failed to start:', err);
      return;
    }

    function drawFrame() {
      cctx.save();
      if (mirror) {
        cctx.translate(w, 0);
        cctx.scale(-1, 1);
      }
      cctx.drawImage(video, 0, 0, w, h);
      cctx.drawImage(overlay, 0, 0, w, h);
      cctx.restore();
      recordRafRef.current = requestAnimationFrame(drawFrame);
    }
    drawFrame();

    setRecording(true);
    setRecordSecs(RECORD_SECONDS);
    recordTimerRef.current = setInterval(() => {
      setRecordSecs((s) => {
        if (s <= 1) {
          stopRecording();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (recordRafRef.current) {
      cancelAnimationFrame(recordRafRef.current);
      recordRafRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
    setRecording(false);
  }

  async function finalizeClip(blob) {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `try-on.${ext}`, { type: blob.type });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My try-on — Virtual Wardrobe' });
        return;
      } catch {
        // user cancelled share — fall through to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Tear down any in-flight recording on unmount.
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (recordRafRef.current) cancelAnimationFrame(recordRafRef.current);
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') mr.stop();
    };
  }, []);

  const mirrored = facingMode === 'user';
  const switchingQuality = modelLoading && status === 'Tracking...';
  const loading = !error && (switchingQuality || (status && status !== 'Tracking...'));
  const loadingMessage = switchingQuality
    ? 'Switching quality…'
    : status === 'Requesting webcam access...'
    ? 'Tap "Allow" when your browser asks for camera access'
    : status;
  const QUALITY_OPTIONS = [
    ['auto', 'Auto'],
    ['high', 'High'],
    ['fast', 'Fast'],
  ];

  return (
    <div className="inline-block w-full">
      {error && <p className="text-red-600 mb-2">{error}</p>}
      {!error && status && <p className="text-slate-500 mb-2">{status}</p>}
      {showDebug && (
        <p className="text-slate-400 mb-2 text-xs">
          {rendererInfo} · model: {tier} · pose {perf.poseMs}ms
        </p>
      )}
      {renderError && (
        <p className="text-red-600 mb-2 text-sm">
          Garment rendering failed: {renderError} (camera + pose tracking below still run)
        </p>
      )}
      <div
        className="relative w-full max-w-[640px] max-h-[75vh] mx-auto"
        style={{ aspectRatio: aspect }}
      >
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover rounded-lg bg-black ${mirrored ? '-scale-x-100' : ''}`}
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={glCanvasRef}
          className={`absolute inset-0 w-full h-full ${mirrored ? '-scale-x-100' : ''} ${usingGL ? '' : 'hidden'}`}
        />
        <canvas
          ref={fallback2DCanvasRef}
          className={`absolute inset-0 w-full h-full ${mirrored ? '-scale-x-100' : ''} ${usingGL ? 'hidden' : ''}`}
        />
        {showDebug && (
          // Not CSS-mirrored — drawDebugOverlay flips x manually so labels stay readable.
          <canvas ref={debugCanvasRef} className="absolute inset-0 w-full h-full" />
        )}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 rounded-lg">
            <div className="h-8 w-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white text-sm px-3 text-center">{loadingMessage}</span>
          </div>
        )}
        {!loading && !error && status === 'Tracking...' && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-black/55 text-white text-xs px-2 py-1 rounded-full font-mono">
            <Gauge className="h-3 w-3" /> {perf.fps} fps
          </span>
        )}
        {recording && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" /> REC {recordSecs}s
          </span>
        )}
        {noPose && !error && status === 'Tracking...' && (
          <div className="absolute inset-x-0 bottom-3 text-center">
            <span className="bg-slate-900/80 text-white text-sm px-3 py-1 rounded-full">
              Step fully into frame so your shoulders &amp; hips are visible
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        <button
          onClick={takeSnapshot}
          className="min-h-[44px] inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
        >
          <Camera className="h-4 w-4" /> Take snapshot
        </button>
        {canRecord && (
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded text-white ${
              recording ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-700 hover:bg-slate-800'
            }`}
          >
            <Video className="h-4 w-4" /> {recording ? `Stop (${recordSecs}s)` : 'Record clip'}
          </button>
        )}
        <button
          onClick={handleFlipCamera}
          disabled={switchingCamera}
          className="min-h-[44px] inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" /> Flip camera
        </button>
        <div
          className="min-h-[44px] inline-flex items-center rounded bg-slate-200 p-1"
          title="Tracking quality — Fast uses a lighter pose model for smoother performance on low-end devices"
        >
          <Gauge className="h-4 w-4 text-slate-500 mx-1.5" />
          {QUALITY_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setQuality(value)}
              className={`px-2.5 py-1.5 text-sm rounded ${
                quality === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOcclusionEnabled((o) => !o)}
          title="Clip the garment to your body outline and let arms in front occlude it. More realistic, but can shimmer on some devices."
          className={`min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded ${
            occlusionEnabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
          }`}
        >
          <User className="h-4 w-4" /> Body occlusion: {occlusionEnabled ? 'on' : 'off'}
        </button>
        <button
          onClick={() => setShowDebug((d) => !d)}
          className="min-h-[44px] inline-flex items-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded"
        >
          <Bug className="h-4 w-4" /> {showDebug ? 'Hide' : 'Show'} debug markers
        </button>
      </div>
    </div>
  );
}
