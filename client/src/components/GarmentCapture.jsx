import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, ChevronUp, Crosshair, Loader2, RefreshCw, Save, Sun, Zap, ZapOff } from 'lucide-react';
import { cutOutGarment } from '../ar/backgroundRemoval.js';
import { getDominantColor } from '../ar/dominantColor.js';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];
const STABILITY_MS = 2000;
const STABILITY_THRESHOLD = 8;
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
  const [autoCapture, setAutoCapture] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [quality, setQuality] = useState({ light: 'ok', focus: 'ok' });

  const videoRef = useRef(null);
  const guideCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const workingFacingRef = useRef('environment');
  const rafRef = useRef(null);
  const stableStartRef = useRef(null);
  const prevBrightnessRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const qualityThrottleRef = useRef(0);
  const autoCaptureRef = useRef(true); // mirror of autoCapture for RAF closure
  const phaseRef = useRef('live');     // mirror of phase for RAF closure
  const capturedRef = useRef(false);   // guard against double-trigger

  const [cutoutUrl, setCutoutUrl] = useState('');
  const [cutoutBlob, setCutoutBlob] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('top');
  const [color, setColor] = useState('');

  // Keep refs in sync with state so RAF can read them without stale closures
  useEffect(() => { autoCaptureRef.current = autoCapture; }, [autoCapture]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

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

  // Guide overlay + stability detection RAF loop
  useEffect(() => {
    if (phase !== 'live') { cancelRAF(); return; }

    const offscreen = document.createElement('canvas');
    offscreen.width = 80; offscreen.height = 60;
    const offCtx = offscreen.getContext('2d');

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const video = videoRef.current;
      const canvas = guideCanvasRef.current;
      if (!canvas || !video || video.readyState < 2) return;

      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, W, H);

      // Guide rectangle dimensions
      const gW = W * 0.6, gH = H * 0.75;
      const gX = (W - gW) / 2, gY = (H - gH) / 2;

      // ── Stability detection ──────────────────────────────────────────────
      offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      const px = offCtx.getImageData(0, 0, offscreen.width, offscreen.height).data;
      let brightnessSum = 0;
      for (let i = 0; i < px.length; i += 4) brightnessSum += (px[i] + px[i+1] + px[i+2]) / 3;
      const brightness = brightnessSum / (offscreen.width * offscreen.height);

      // Quality hints (throttled)
      const now = Date.now();
      if (now - qualityThrottleRef.current > 500) {
        qualityThrottleRef.current = now;
        let blurSum = 0, count = 0;
        for (let i = 0; i < px.length - 4; i += 4) {
          const d = Math.abs(px[i] - px[i+4]);
          blurSum += d; count++;
        }
        const blurScore = count ? blurSum / count : 0;
        setQuality({
          light: brightness < 40 ? 'dark' : brightness > 210 ? 'bright' : 'ok',
          focus: blurScore < 6 ? 'blurry' : 'sharp',
        });
      }

      let stable = false;
      if (prevBrightnessRef.current !== null) {
        if (Math.abs(brightness - prevBrightnessRef.current) < STABILITY_THRESHOLD) {
          if (!stableStartRef.current) stableStartRef.current = now;
          const stableDur = now - stableStartRef.current;
          stable = stableDur >= STABILITY_MS;

          // Trigger countdown once stable
          if (stableDur >= STABILITY_MS && autoCaptureRef.current && !countdownIntervalRef.current && phaseRef.current === 'live' && !capturedRef.current) {
            setCountdown(3);
            countdownIntervalRef.current = setInterval(() => {
              setCountdown((c) => {
                if (c <= 1) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                  if (!capturedRef.current) { capturedRef.current = true; triggerCapture(); }
                  return null;
                }
                return c - 1;
              });
            }, 1000);
          }
        } else {
          stableStartRef.current = null;
          // Reset countdown if motion detected
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            setCountdown(null);
          }
        }
      }
      prevBrightnessRef.current = brightness;

      // ── Draw guide overlay ───────────────────────────────────────────────
      const color = stable ? '#22c55e' : 'rgba(255,255,255,0.85)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      // Main rect
      ctx.strokeRect(gX, gY, gW, gH);

      // Corner markers (L-shapes)
      const CL = 20;
      const corners = [
        [gX, gY, CL, 0, 0, CL],
        [gX + gW, gY, -CL, 0, 0, CL],
        [gX, gY + gH, CL, 0, 0, -CL],
        [gX + gW, gY + gH, -CL, 0, 0, -CL],
      ];
      ctx.lineWidth = 3;
      corners.forEach(([cx, cy, dx1, dy1, dx2, dy2]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx1, cy + dy1);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + dx2, cy + dy2);
        ctx.stroke();
      });

      // "Hold still…" text
      if (stableStartRef.current && !stable && autoCaptureRef.current) {
        const elapsed = now - stableStartRef.current;
        if (elapsed > 500) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Hold still…', W / 2, gY - 10);
        }
      }

      // Countdown number
      setCountdown((c) => {
        if (c !== null) {
          ctx.fillStyle = 'white';
          ctx.font = 'bold 80px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'black';
          ctx.shadowBlur = 8;
          ctx.fillText(String(c), W / 2, H / 2);
          ctx.shadowBlur = 0;
          ctx.textBaseline = 'alphabetic';
        }
        return c;
      });
    }

    rafRef.current = requestAnimationFrame(loop);
    return cancelRAF;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function cancelRAF() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    setCountdown(null);
    stableStartRef.current = null;
    prevBrightnessRef.current = null;
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelRAF();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function triggerCapture() { doCapture(); }

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
    // Cancel any running auto-capture countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
      setCountdown(null);
    }
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
      const updated = await api.put(`/wardrobe/${item._id}`, { tryOnAssetUrl: item.imageUrl });
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
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
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    setAutoCapture((v) => !v);
                    if (countdownIntervalRef.current) {
                      clearInterval(countdownIntervalRef.current);
                      countdownIntervalRef.current = null;
                      setCountdown(null);
                    }
                  }}
                >
                  {autoCapture ? <Zap className="h-3 w-3 text-green-600" /> : <ZapOff className="h-3 w-3" />}
                  Auto-capture: {autoCapture ? 'on' : 'off'}
                </Button>
              </div>
              <div className="flex gap-3">
                <Button onClick={handleCapture} disabled={!!camError || switchingCam} className="flex-1 gap-2">
                  <Camera className="h-4 w-4" /> Capture
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setAutoCapture(false);
                    setFacingMode((m) => (m === 'user' ? 'environment' : 'user'));
                  }}
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
