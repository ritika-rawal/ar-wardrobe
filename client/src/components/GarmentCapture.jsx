import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, ChevronUp, Crosshair, Loader2, RefreshCw, Save, Sparkles, Sun } from 'lucide-react';
import { cutOutGarment } from '../ar/backgroundRemoval.js';
import { detectGarmentAnchors } from '../ar/garmentAnchorDetect.js';
import { detectForeground, maskToStencil } from '../ar/foregroundDetect.js';
import { getDominantColor } from '../ar/dominantColor.js';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];
const STABILITY_MS = 900; // how long the frame must hold still before we trust a detection
const STABILITY_THRESHOLD = 8;
const DETECT_INTERVAL_MS = 350; // throttle for the (cheap) foreground detector
const CHECKER = 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%) 0 0 / 20px 20px';

const TIPS = [
  'Lay the garment flat on a plain, light-coloured surface.',
  'Make sure the whole item is within the frame.',
  'Avoid shadows — diffuse light works best.',
  'One item per capture for the cleanest background removal.',
];

function describeError(err) {
  if (err?.name === 'NotAllowedError') return 'Camera access was blocked — allow camera permission and retry.';
  if (err?.name === 'NotFoundError') return 'No camera found on this device.';
  if (!navigator.mediaDevices?.getUserMedia) return 'Camera requires a secure connection (https:// or localhost).';
  return err?.message || 'Could not start camera.';
}

export default function GarmentCapture({ onSaved, onClose }) {
  const toast = useToast();

  const [phase, setPhase] = useState('live');
  const [facingMode, setFacingMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const [switchingCam, setSwitchingCam] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [garmentReady, setGarmentReady] = useState(false); // a clean garment region is detected & steady
  const [quality, setQuality] = useState({ light: 'ok', focus: 'ok' });

  const videoRef = useRef(null);
  const guideCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const workingFacingRef = useRef('environment');
  const rafRef = useRef(null);
  const stableStartRef = useRef(null);
  const prevBrightnessRef = useRef(null);
  const qualityThrottleRef = useRef(0);
  const detectThrottleRef = useRef(0);    // throttle for foreground detection
  const detectionRef = useRef(null);      // latest detectForeground() result
  const garmentReadyRef = useRef(false);  // mirror of garmentReady for the RAF closure
  const mirrorRef = useRef(false);        // whether the preview is CSS-mirrored (front camera)
  const phaseRef = useRef('live');        // mirror of phase for RAF closure
  const capturedRef = useRef(false);      // guard against double-trigger

  const [cutoutUrl, setCutoutUrl] = useState('');
  const [cutoutBlob, setCutoutBlob] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('top');
  const [color, setColor] = useState('');

  // Keep refs in sync with state so RAF can read them without stale closures
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { mirrorRef.current = facingMode === 'user'; }, [facingMode]);

  // Camera setup
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
    return () => { stopped = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, phase]);

  // Live preview loop: lighting/focus hints + stability + background garment detection + highlight.
  // No forced countdown — when the frame is steady and a clean garment region is found, we light it
  // up (iPhone "lift subject" style) and invite the user to capture; capture is always their choice.
  useEffect(() => {
    if (phase !== 'live') { cancelRAF(); return; }

    const offscreen = document.createElement('canvas');
    offscreen.width = 80; offscreen.height = 60;
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const video = videoRef.current;
      const canvas = guideCanvasRef.current;
      if (!canvas || !video || video.readyState < 2) return;

      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);

      // ── Brightness (drives both the lighting hint and the stability gate) ──
      offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      const px = offCtx.getImageData(0, 0, offscreen.width, offscreen.height).data;
      let brightnessSum = 0;
      for (let i = 0; i < px.length; i += 4) brightnessSum += (px[i] + px[i + 1] + px[i + 2]) / 3;
      const brightness = brightnessSum / (offscreen.width * offscreen.height);

      const now = Date.now();
      if (now - qualityThrottleRef.current > 500) {
        qualityThrottleRef.current = now;
        let blurSum = 0, count = 0;
        for (let i = 0; i < px.length - 4; i += 4) { blurSum += Math.abs(px[i] - px[i + 4]); count++; }
        const blurScore = count ? blurSum / count : 0;
        setQuality({
          light: brightness < 40 ? 'dark' : brightness > 210 ? 'bright' : 'ok',
          focus: blurScore < 6 ? 'blurry' : 'sharp',
        });
      }

      // Stability: has the frame held still long enough to trust a detection?
      let stable = false;
      if (prevBrightnessRef.current !== null) {
        if (Math.abs(brightness - prevBrightnessRef.current) < STABILITY_THRESHOLD) {
          if (!stableStartRef.current) stableStartRef.current = now;
          stable = now - stableStartRef.current >= STABILITY_MS;
        } else {
          stableStartRef.current = null;
        }
      }
      prevBrightnessRef.current = brightness;

      // ── Foreground (garment) detection — throttled, only run once the frame is steady ──
      if (now - detectThrottleRef.current > DETECT_INTERVAL_MS) {
        detectThrottleRef.current = now;
        detectionRef.current = stable ? detectForeground(video) : null;
      }
      const det = detectionRef.current;
      const ready = !!(stable && det && det.ok);
      if (ready !== garmentReadyRef.current) {
        garmentReadyRef.current = ready;
        setGarmentReady(ready);
      }

      // ── Draw ──
      const mirror = mirrorRef.current;
      if (ready) {
        // Dim the frame, punch the detected garment back to full brightness, glow its outline.
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(maskToStencil(det), 0, 0, W, H);
        ctx.restore();
        ctx.globalCompositeOperation = 'source-over';

        const sx = W / det.w, sy = H / det.h;
        const bw = (det.bbox.maxX - det.bbox.minX) * sx;
        const bh = (det.bbox.maxY - det.bbox.minY) * sy;
        const bx = mirror ? W - det.bbox.maxX * sx : det.bbox.minX * sx;
        const by = det.bbox.minY * sy;
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#6366f1';
        ctx.shadowBlur = 16;
        roundRect(ctx, bx - 6, by - 6, bw + 12, bh + 12, 12);
        ctx.stroke();
        ctx.restore();
      } else {
        // Plain framing guide while waiting for a steady, clean garment.
        const gW = W * 0.6, gH = H * 0.75, gX = (W - gW) / 2, gY = (H - gH) / 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        const CL = 20;
        const corners = [
          [gX, gY, CL, 0, 0, CL],
          [gX + gW, gY, -CL, 0, 0, CL],
          [gX, gY + gH, CL, 0, 0, -CL],
          [gX + gW, gY + gH, -CL, 0, 0, -CL],
        ];
        corners.forEach(([cx, cy, dx1, dy1, dx2, dy2]) => {
          ctx.beginPath();
          ctx.moveTo(cx + dx1, cy + dy1);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx + dx2, cy + dy2);
          ctx.stroke();
        });
        if (stableStartRef.current && !stable) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Hold still…', W / 2, gY - 10);
        }
      }
    }

    rafRef.current = requestAnimationFrame(loop);
    return cancelRAF;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cancelRAF() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    stableStartRef.current = null;
    prevBrightnessRef.current = null;
    detectionRef.current = null;
    garmentReadyRef.current = false;
    setGarmentReady(false);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelRAF();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doCapture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) { capturedRef.current = false; return; }

    const w = video.videoWidth, h = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, w, h);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    cancelRAF();
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
      capturedRef.current = false;
      setPhase('live');
    }
  }

  function handleCapture() {
    if (capturedRef.current) return;
    capturedRef.current = true;
    doCapture();
  }

  function handleRetake() {
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    setCutoutUrl(''); setCutoutBlob(null); setName(''); setColor('');
    capturedRef.current = false;
    setPhase('live');
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Please enter a name for this item.'); return; }
    setPhase('saving');
    try {
      const fd = new FormData();
      fd.append('image', cutoutBlob, 'capture.png');
      fd.append('name', name.trim());
      fd.append('category', category);
      fd.append('color', color.trim());
      const { data } = await api.post('/wardrobe', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const item = data.item;
      // Detect per-garment AR anchors from the cutout (best-effort) so the captured item aligns to
      // its own shoulders/hips in try-on. Saved alongside the cutout (which is also the imageUrl).
      const anchors = await detectGarmentAnchors(cutoutBlob, category);
      const updates = { tryOnAssetUrl: item.imageUrl };
      if (anchors) updates.imageAnchors = anchors;
      const updated = await api.put(`/wardrobe/${item._id}`, updates);
      // Fire-and-forget auto-tag (best effort)
      api.post(`/wardrobe/${item._id}/auto-tag`).catch(() => {});
      toast.success(`"${item.name}" added — AR-ready`);
      URL.revokeObjectURL(cutoutUrl);
      onSaved?.(updated.data.item);
      onClose?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed.');
      setPhase('preview');
    }
  }

  const isLive = phase === 'live' || phase === 'processing';
  const mirrored = facingMode === 'user';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {phase === 'live' && <><Camera className="h-5 w-5" /> Capture garment</>}
            {phase === 'processing' && <><Loader2 className="h-5 w-5 animate-spin" /> Removing background…</>}
            {phase === 'preview' && <><Check className="h-5 w-5 text-green-600" /> Preview &amp; save</>}
            {phase === 'saving' && <><Save className="h-5 w-5" /> Saving…</>}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="p-5 space-y-4">

          {/* Camera view */}
          {isLive && (
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay playsInline muted
                className={`w-full h-full object-cover ${mirrored ? '-scale-x-100' : ''}`}
              />
              {/* Guide overlay canvas */}
              <canvas
                ref={guideCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
              {phase === 'processing' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                  <Loader2 className="h-10 w-10 text-white animate-spin" />
                  <p className="text-white text-sm text-center">
                    Removing background…<br />
                    <span className="text-white/60 text-xs">First run may take a moment</span>
                  </p>
                </div>
              )}
              {camError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
                  <p className="text-white text-sm text-center">{camError}</p>
                </div>
              )}
            </div>
          )}

          {/* Quality hints */}
          {phase === 'live' && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Sun className="h-3 w-3" />
                {quality.light === 'dark' ? 'Too dark' : quality.light === 'bright' ? 'Too bright' : 'Good lighting'}
              </span>
              <span className="flex items-center gap-1">
                <Crosshair className="h-3 w-3" />
                {quality.focus === 'blurry' ? 'Blurry' : 'Sharp'}
              </span>
            </div>
          )}

          {/* Tips panel */}
          {phase === 'live' && (
            <div className="border rounded-lg overflow-hidden">
              <button
                onClick={() => setTipsOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                Tips for best results
                {tipsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {tipsOpen && (
                <ul className="px-3 pb-3 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                  {TIPS.map((tip) => <li key={tip}>{tip}</li>)}
                </ul>
              )}
            </div>
          )}

          {/* Camera controls */}
          {phase === 'live' && (
            <div className="space-y-2">
              {garmentReady ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  Garment detected and highlighted — capture it?
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Hold the garment steady in frame — we’ll highlight it when it’s ready.
                </p>
              )}
              <div className="flex gap-3">
                <Button
                  onClick={handleCapture}
                  disabled={!!camError || switchingCam}
                  className={`flex-1 gap-2 transition-colors ${garmentReady ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                >
                  {garmentReady ? <Sparkles className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {garmentReady ? 'Capture garment' : 'Capture'}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
                  disabled={switchingCam}
                  title="Flip camera"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Preview */}
          {(phase === 'preview' || phase === 'saving') && (
            <>
              <div
                className="w-full aspect-square rounded-lg overflow-hidden flex items-center justify-center"
                style={{ background: CHECKER }}
              >
                <img src={cutoutUrl} alt="cutout preview" className="max-w-full max-h-full object-contain" />
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="mb-1">Name *</Label>
                  <Input type="text" placeholder="e.g. White linen shirt" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
                <div>
                  <Label className="mb-1">Category</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button key={c} onClick={() => setCategory(c)} className="focus:outline-none">
                        <Badge variant={category === c ? 'default' : 'outline'} className="cursor-pointer capitalize hover:opacity-80 transition-opacity">
                          {c}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-1">
                    Color <span className="text-muted-foreground font-normal">(auto-detected, editable)</span>
                  </Label>
                  <Input type="text" value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={handleRetake} disabled={phase === 'saving'} className="flex-1">Retake</Button>
                <Button onClick={handleSave} disabled={phase === 'saving' || !name.trim()} className="flex-1 gap-2">
                  <Save className="h-4 w-4" />
                  {phase === 'saving' ? 'Saving…' : 'Save to closet'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
