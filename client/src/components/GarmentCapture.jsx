import { useEffect, useRef, useState } from 'react';
import { cutOutGarment } from '../ar/backgroundRemoval.js';
import { getDominantColor } from '../ar/dominantColor.js';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];

function describeError(err) {
  if (err?.name === 'NotAllowedError') return 'Camera access was blocked — allow camera permission and retry.';
  if (err?.name === 'NotFoundError') return 'No camera found on this device.';
  if (!navigator.mediaDevices?.getUserMedia) return 'Camera requires a secure connection (https:// or localhost).';
  return err?.message || 'Could not start camera.';
}

// Checkerboard CSS background to visualise transparency in the preview.
const CHECKER = 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%) 0 0 / 20px 20px';

export default function GarmentCapture({ onSaved, onClose }) {
  const toast = useToast();

  // 'live' | 'processing' | 'preview' | 'saving'
  const [phase, setPhase] = useState('live');
  const [facingMode, setFacingMode] = useState('environment'); // rear camera better for garments
  const [camError, setCamError] = useState('');
  const [switchingCam, setSwitchingCam] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const workingFacingRef = useRef('environment');

  // Preview state
  const [cutoutUrl, setCutoutUrl] = useState('');
  const [cutoutBlob, setCutoutBlob] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('top');
  const [color, setColor] = useState('');

  // Start / restart camera whenever facingMode changes.
  useEffect(() => {
    let stopped = false;

    async function start() {
      setSwitchingCam(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        workingFacingRef.current = facingMode;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCamError('');
      } catch (err) {
        if (!stopped) {
          setCamError(describeError(err));
          setFacingMode(workingFacingRef.current);
        }
      } finally {
        if (!stopped) setSwitchingCam(false);
      }
    }

    if (phase === 'live') start();

    return () => {
      stopped = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, phase]);

  // Stop camera when we leave the live phase or the modal unmounts.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const w = video.videoWidth, h = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');

    // Un-mirror front camera so the stored image is the correct orientation.
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    // Stop camera now — no longer needed after capture.
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setPhase('processing');

    try {
      const rawBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const cutout = await cutOutGarment(rawBlob);
      const url = URL.createObjectURL(cutout);
      const guessedColor = await getDominantColor(cutout);

      setCutoutBlob(cutout);
      setCutoutUrl(url);
      setColor(guessedColor);
      setPhase('preview');
    } catch (err) {
      toast.error('Background removal failed: ' + (err.message || err));
      setPhase('live'); // restart camera
    }
  }

  function handleRetake() {
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    setCutoutUrl('');
    setCutoutBlob(null);
    setName('');
    setColor('');
    setPhase('live');
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Please enter a name for this item.'); return; }
    setPhase('saving');
    try {
      // 1. Create the wardrobe item using the cutout as the display image.
      const fd = new FormData();
      fd.append('image', cutoutBlob, 'capture.png');
      fd.append('name', name.trim());
      fd.append('category', category);
      fd.append('color', color.trim());
      const { data } = await api.post('/wardrobe', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const item = data.item;

      // 2. Mark the same stored image as the AR try-on asset (no extra upload).
      const updated = await api.put(`/wardrobe/${item._id}`, {
        tryOnAssetUrl: item.imageUrl,
      });

      toast.success(`"${item.name}" added — AR-ready ✨`);
      URL.revokeObjectURL(cutoutUrl);
      onSaved?.(updated.data.item);
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed.');
      setPhase('preview');
    }
  }

  const mirrored = facingMode === 'user';

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">
            {phase === 'live' && '📷 Capture garment'}
            {phase === 'processing' && '⏳ Removing background…'}
            {phase === 'preview' && '✅ Preview & save'}
            {phase === 'saving' && '💾 Saving…'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* ── Live camera ── */}
          {(phase === 'live' || phase === 'processing') && (
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
              />
              {phase === 'processing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                  <div className="h-10 w-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="text-white text-sm">Removing background…<br /><span className="text-white/60 text-xs">First run may take a moment</span></p>
                </div>
              )}
              {camError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
                  <p className="text-white text-sm text-center">{camError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Camera controls ── */}
          {phase === 'live' && (
            <div className="flex gap-3">
              <button
                onClick={handleCapture}
                disabled={!!camError || switchingCam}
                className="flex-1 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium rounded-lg"
              >
                📸 Capture
              </button>
              <button
                onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
                disabled={switchingCam}
                className="min-h-[48px] px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-40"
                title="Flip camera"
              >
                🔄
              </button>
            </div>
          )}

          {/* ── Preview ── */}
          {(phase === 'preview' || phase === 'saving') && (
            <>
              <div
                className="w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center"
                style={{ background: CHECKER }}
              >
                <img
                  src={cutoutUrl}
                  alt="cutout preview"
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. White linen shirt"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 min-h-[44px] text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          category === c
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Color <span className="text-slate-400 font-normal">(auto-detected, editable)</span>
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 min-h-[44px] text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleRetake}
                  disabled={phase === 'saving'}
                  className="flex-1 min-h-[48px] border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg disabled:opacity-40"
                >
                  Retake
                </button>
                <button
                  onClick={handleSave}
                  disabled={phase === 'saving' || !name.trim()}
                  className="flex-1 min-h-[48px] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-medium rounded-lg"
                >
                  {phase === 'saving' ? 'Saving…' : '💾 Save to closet'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
