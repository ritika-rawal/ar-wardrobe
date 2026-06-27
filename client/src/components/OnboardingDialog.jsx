import { useState } from 'react';
import { Check, ChevronRight, CloudSun, Shirt, Upload } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

const FEATURES = [
  { icon: <Shirt className="h-5 w-5 text-primary" />, title: 'My Closet', desc: 'Upload your garments and build a digital wardrobe' },
  { icon: <CloudSun className="h-5 w-5 text-primary" />, title: 'Smart Recommendations', desc: 'Get outfit ideas based on the weather and occasion' },
  { icon: <Check className="h-5 w-5 text-primary" />, title: 'AR Try-On', desc: 'See how outfits look on you in real time with your webcam' },
];

export default function OnboardingDialog() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  async function complete() {
    setLoading(true);
    try {
      const res = await api.patch('/auth/onboarding');
      updateUser(res.data.user);
    } catch {
      // Non-fatal: update local state even if request fails
      updateUser({ ...user, onboardingComplete: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === 1 && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Shirt className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Welcome to Virtual Wardrobe</h2>
              <p className="text-muted-foreground text-sm mt-1">Here's what you can do</p>
            </div>
            <div className="w-full space-y-3 text-left">
              {FEATURES.map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="mt-0.5 shrink-0">{icon}</div>
                  <div>
                    <p className="font-medium text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button className="w-full gap-2" onClick={() => setStep(2)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Start your wardrobe</h2>
              <p className="text-muted-foreground text-sm mt-1">Add your first garment to unlock recommendations</p>
            </div>
            <div className="w-full space-y-2">
              <Button className="w-full" onClick={() => setStep(3)}>
                I'll upload an item later
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep(3)}>
                Explore the app first
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="p-3 bg-green-500/10 rounded-full">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">You're all set!</h2>
              <p className="text-muted-foreground text-sm mt-1">Your wardrobe adventure starts now</p>
            </div>
            <Button className="w-full" onClick={complete} disabled={loading}>
              {loading ? 'Loading…' : 'Get started'}
            </Button>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex justify-center gap-1.5 mt-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${s === step ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
