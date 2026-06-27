import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 text-center p-6">
      <span className="text-8xl font-bold text-muted-foreground select-none">404</span>
      <p className="text-xl font-medium">Page not found</p>
      <p className="text-muted-foreground">This page doesn't exist or has been moved.</p>
      <Button asChild>
        <Link to="/">Back to home</Link>
      </Button>
    </div>
  );
}
