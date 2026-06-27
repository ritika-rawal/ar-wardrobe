import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, RefreshCw, Save } from 'lucide-react';
import { cutOutGarment } from '../ar/backgroundRemoval.js';
import { getDominantColor } from '../ar/dominantColor.js';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];

function describeError(err) {
  if (err?.name === 'NotAllowedError') return 'Camera access was blocked — allow camera permission and retry.';
  if (err?.name === 'NotFoundError') return 'No camera found on this device.';
  if (!navigator.mediaDevices?.getUserMedia) return 'Camera requires a secure connection (https:// or localhost).';
  return err?.message || 'Could not start camera.';
}

const CHECKER = 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%) 0 0 / 20px 20px';

export default function GarmentCapture({ onSaved, onClose }) {
  const toast = useToast();

  const [phase, setPhase] = useState('live');
  const [facingMode, setFacingMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const [switchingCam, setSwitchingCam] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const workingFacingRef = useRef('environment');

  const [cutoutUrl, setCutoutUrl] = useState('');
  const [cutoutBlob, setCutoutBlob] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('top');
  const [color, setColor] = useState('');

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

  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;

    const w = video.videoWidth, h = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, w, h);

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
      setPhase('live');
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
      const fd = new FormData();
      fd.append('image', cutoutBlob, 'capture.png');
      fd.append('name', name.trim());
      fd.append('category', category);
      fd.append('color', color.trim());
      const { data } = await api.post('/wardrobe', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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

  const mirrored = facingMode === 'user';
  const isLive = phase === 'live' || phase === 'processing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {phase === 'live' && <><Camera className="h-5 w-5" /> Capture garment</>}
            {phase === 'processing' && <><Loader2 className="h-5 w-5 animate-spin" /> Removing background…</>}
            {phase === 'preview' && <><Check className="h-5 w-5 text-green-600" /> Preview &amp; save</>}
            {phase === 'saving' && <><Save className="h-5 w-5" /> Saving…</>}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">

          {isLive && (
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

          {phase === 'live' && (
            <div className="flex gap-3">
              <Button
                onClick={handleCapture}
                disabled={!!camError || switchingCam}
                className="flex-1 gap-2"
              >
                <Camera className="h-4 w-4" />
                Capture
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
          )}

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
                  <Input
                    type="text"
                    placeholder="e.g. White linen shirt"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <Label className="mb-1">Category</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className="focus:outline-none"
                      >
                        <Badge
                          variant={category === c ? 'default' : 'outline'}
                          className="cursor-pointer capitalize hover:bg-primary/10 transition-colors"
                        >
                          {c}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="mb-1">
                    Color{' '}
                    <span className="text-muted-foreground font-normal">(auto-detected, editable)</span>
                  </Label>
                  <Input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  variant="outline"
                  onClick={handleRetake}
                  disabled={phase === 'saving'}
                  className="flex-1"
                >
                  Retake
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={phase === 'saving' || !name.trim()}
                  className="flex-1 gap-2"
                >
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
