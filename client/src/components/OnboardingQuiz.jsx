import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CloudSun, Shirt, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

const TOTAL_STEPS = 5;

const STYLE_VIBES = [
  'Minimal', 'Casual', 'Streetwear', 'Smart-casual',
  'Formal', 'Sporty', 'Vintage', 'Preppy',
];

const COLOR_SWATCHES = [
  { name: 'black', hex: '#1a1a1a' },
  { name: 'white', hex: '#f5f5f0' },
  { name: 'grey', hex: '#9e9e9e' },
  { name: 'navy', hex: '#1a237e' },
  { name: 'blue', hex: '#1976d2' },
  { name: 'red', hex: '#e53935' },
  { name: 'green', hex: '#2e7d32' },
  { name: 'brown', hex: '#5d4037' },
  { name: 'beige', hex: '#d7ccc8' },
  { name: 'pink', hex: '#e91e63' },
  { name: 'yellow', hex: '#fbc02d' },
  { name: 'purple', hex: '#7b1fa2' },
];

const OCCASIONS = [
  'Everyday', 'Work', 'Dates', 'Going out', 'Gym', 'Travel',
];

const DONE_FEATURES = [
  { Icon: Shirt, title: 'My Closet', desc: 'Upload garments and organise your wardrobe' },
  { Icon: Sparkles, title: 'AR Try-On', desc: 'See outfits on yourself via live webcam' },
  { Icon: CloudSun, title: 'Recommendations', desc: 'Daily outfit ideas matched to the weather' },
];

function ProgressDots({ step, total }) {
  return (
    <div className="flex justify-center gap-1.5 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all"
          style={{
            width: i + 1 === step ? '20px' : '6px',
            background: i + 1 <= step ? 'var(--brand-black)' : 'var(--brand-stone)',
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingQuiz() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [vibes, setVibes] = useState([]);
  const [colors, setColors] = useState([]);
  const [occasions, setOccasions] = useState([]);
  const [saving, setSaving] = useState(false);

  function toggleItem(arr, setArr, item, max) {
    setArr((prev) =>
      prev.includes(item) ? prev.filter((v) => v !== item) : prev.length < max ? [...prev, item] : prev
    );
  }

  async function savePrefs(fields) {
    try {
      const res = await api.put('/auth/me/preferences', fields);
      updateUser(res.data.user);
    } catch {
      // best-effort
    }
  }

  async function goNext() {
    if (step === 2) await savePrefs({ styleVibes: vibes.map((v) => v.toLowerCase()) });
    if (step === 3) await savePrefs({ favoriteColors: colors });
    if (step === 4) await savePrefs({ occasions: occasions.map((o) => o.toLowerCase()) });
    setStep((s) => s + 1);
  }

  async function complete() {
    setSaving(true);
    try {
      const res = await api.patch('/auth/onboarding');
      updateUser(res.data.user);
      navigate('/closet');
    } catch {
      updateUser({ ...user, onboardingComplete: true });
      navigate('/closet');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <ProgressDots step={step} total={TOTAL_STEPS} />

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-4 pb-2">
            <h2 className="text-xl font-medium">Welcome to Virtual Wardrobe</h2>
            <p className="text-sm text-muted-foreground">
              Let's personalise your experience. Takes about 30 seconds.
            </p>
            <Button className="w-full" onClick={() => setStep(2)}>
              Get started
            </Button>
          </div>
        )}

        {/* Step 2: Style vibe */}
        {step === 2 && (
          <div className="space-y-4 pb-2">
            <div>
              <h2 className="text-lg font-medium">Your style vibe</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Pick up to 3</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {STYLE_VIBES.map((v) => {
                const active = vibes.includes(v);
                return (
                  <button
                    key={v}
                    onClick={() => toggleItem(vibes, setVibes, v, 3)}
                    className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                    style={{
                      background: active ? 'var(--brand-black)' : 'transparent',
                      color: active ? 'var(--brand-white)' : 'var(--brand-black)',
                      borderColor: active ? 'var(--brand-black)' : 'var(--brand-border)',
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={goNext}>Skip</Button>
              <Button className="flex-1" onClick={goNext}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 3: Colour palette */}
        {step === 3 && (
          <div className="space-y-4 pb-2">
            <div>
              <h2 className="text-lg font-medium">Favourite colours</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Pick up to 5</p>
            </div>
            <div className="grid grid-cols-6 gap-3">
              {COLOR_SWATCHES.map(({ name, hex }) => {
                const active = colors.includes(name);
                return (
                  <button
                    key={name}
                    onClick={() => toggleItem(colors, setColors, name, 5)}
                    className="relative flex flex-col items-center gap-1"
                    title={name}
                  >
                    <div
                      className="w-9 h-9 rounded-full border-2 transition-all"
                      style={{
                        background: hex,
                        borderColor: active ? 'var(--brand-black)' : 'transparent',
                        boxShadow: active ? '0 0 0 2px var(--brand-white), 0 0 0 4px var(--brand-black)' : 'none',
                      }}
                    />
                    {active && (
                      <Check
                        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/4 h-4 w-4"
                        style={{ color: name === 'white' ? '#1a1a1a' : '#fff' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={goNext}>Skip</Button>
              <Button className="flex-1" onClick={goNext}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 4: Occasions */}
        {step === 4 && (
          <div className="space-y-4 pb-2">
            <div>
              <h2 className="text-lg font-medium">What do you dress for?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Select all that apply</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => {
                const active = occasions.includes(o);
                return (
                  <button
                    key={o}
                    onClick={() => toggleItem(occasions, setOccasions, o, 6)}
                    className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                    style={{
                      background: active ? 'var(--brand-black)' : 'transparent',
                      color: active ? 'var(--brand-white)' : 'var(--brand-black)',
                      borderColor: active ? 'var(--brand-black)' : 'var(--brand-border)',
                    }}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={goNext}>Skip</Button>
              <Button className="flex-1" onClick={goNext}>Next</Button>
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <div className="space-y-5 pb-2">
            <div className="text-center">
              <h2 className="text-xl font-medium">Your wardrobe is ready</h2>
              <p className="text-sm text-muted-foreground mt-1">Here's what you can do</p>
            </div>
            <div className="space-y-3">
              {DONE_FEATURES.map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-[14px]"
                  style={{ background: 'var(--brand-stone)' }}>
                  <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full" onClick={complete} disabled={saving}>
              {saving ? 'Setting up…' : 'Start adding clothes'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
