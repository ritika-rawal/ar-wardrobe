import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Trash2 } from 'lucide-react';
import api from '../api/client.js';
import CardGridSkeleton from '../components/CardGridSkeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Outfits() {
  const toast = useToast();
  const [outfits, setOutfits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/outfits');
      setOutfits(res.data.outfits);
    } catch {
      setError('Failed to load outfits');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    await api.delete(`/outfits/${id}`);
    setOutfits((prev) => prev.filter((o) => o._id !== id));
    toast.info('Outfit deleted');
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">My Outfits</h1>

      {loading ? (
        <CardGridSkeleton />
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : outfits.length === 0 ? (
        <p className="text-muted-foreground">
          No saved outfits yet — save a look from{' '}
          <Link to="/try-on" className="text-primary hover:underline">Try-On</Link>
          {' '}or{' '}
          <Link to="/recommendations" className="text-primary hover:underline">Recommendations</Link>.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {outfits.map((outfit) => (
            <Card key={outfit._id} className="overflow-hidden">
              {outfit.snapshotUrl ? (
                <img src={outfit.snapshotUrl} alt={outfit.name} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-muted flex flex-wrap items-center justify-center gap-1 p-2">
                  {outfit.itemIds.map((item) => (
                    <div key={item._id} className="w-14 h-14 bg-muted-foreground/10 rounded overflow-hidden flex items-center justify-center">
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                    </div>
                  ))}
                </div>
              )}
              <CardContent className="p-3">
                <p className="font-medium truncate">{outfit.name}</p>
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {outfit.itemIds.map((i) => i.name).join(', ')}
                </p>
                {outfit.wornAt && (
                  <Badge variant="outline" className="gap-1 text-xs mb-2">
                    <Clock className="h-3 w-3" />
                    Worn {new Date(outfit.wornAt).toLocaleDateString()}
                  </Badge>
                )}
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-destructive hover:text-destructive px-0 h-auto"
                    onClick={() => handleDelete(outfit._id)}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
