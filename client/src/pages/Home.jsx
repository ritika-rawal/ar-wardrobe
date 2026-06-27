import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CloudSun, Shirt, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    Icon: Shirt,
    title: 'Digital Closet',
    desc: 'Upload your clothes once and organise them by category, colour, season, and warmth.',
  },
  {
    Icon: Sparkles,
    title: 'Live AR Try-On',
    desc: 'See garments overlaid on your live webcam feed, tracked to your body in real time.',
  },
  {
    Icon: CloudSun,
    title: 'Smart Recommendations',
    desc: "Get outfit suggestions matched to today's weather and your personal style.",
  },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return (
    <div>
      <div className="max-w-3xl mx-auto mt-16 sm:mt-24 text-center px-4 sm:px-6">
        <h1 className="text-4xl sm:text-5xl font-medium tracking-tight mb-4">Virtual Wardrobe</h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
          Organise your closet digitally, try on clothes live with AR, and get smart outfit
          recommendations based on the weather and your style.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/register">Create account</Link>
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-20 px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-5 pb-20">
        {FEATURES.map(({ Icon, title, desc }) => (
          <Card key={title}>
            <CardContent className="pt-6">
              <Icon className="h-7 w-7 mb-3" style={{ color: 'var(--brand-accent)' }} />
              <h3 className="font-medium mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
