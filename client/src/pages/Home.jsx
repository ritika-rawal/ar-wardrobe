import { Link } from 'react-router-dom';
import { CloudSun, Shirt, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const FEATURES = [
  {
    Icon: Shirt,
    title: 'Digital Closet',
    desc: 'Upload your clothes once and organize them by category, color, season, and warmth.',
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

  return (
    <div>
      <div className="max-w-3xl mx-auto mt-16 sm:mt-24 text-center px-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Shirt className="h-10 w-10 text-indigo-600" />
          <h1 className="text-4xl sm:text-5xl font-bold">Virtual Wardrobe</h1>
        </div>
        <p className="text-muted-foreground text-lg mb-8">
          Organize your closet digitally, try on clothes live with AR, and get smart outfit
          recommendations based on the weather and your style.
        </p>
        {user ? (
          <Button asChild size="lg">
            <Link to="/closet">Go to my closet →</Link>
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/register">Register</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto mt-16 px-4 grid grid-cols-1 sm:grid-cols-3 gap-6 pb-16">
        {FEATURES.map(({ Icon, title, desc }) => (
          <Card key={title} className="text-center">
            <CardContent className="pt-6">
              <Icon className="h-8 w-8 mx-auto mb-3 text-indigo-600" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
