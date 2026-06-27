import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CloudRain, MapPin, Save, Wind } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function Recommendations() {
  const toast = useToast();
  const [city, setCity] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedIndexes, setSavedIndexes] = useState(new Set());

  async function fetchByCoords(lat, lon) {
    const res = await api.get('/recommend', { params: { lat, lon } });
    setData(res.data);
  }

  async function fetchByCity() {
    const res = await api.get('/recommend', { params: { city } });
    setData(res.data);
  }

  async function handleUseLocation() {
    setLoading(true);
    setError('');
    setData(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetchByCoords(pos.coords.latitude, pos.coords.longitude);
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to fetch recommendations');
        } finally {
          setLoading(false);
        }
      },
      async () => {
        setError('Location access denied — try entering a city instead.');
        setLoading(false);
      }
    );
  }

  async function handleCitySubmit(e) {
    e.preventDefault();
    if (!city.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      await fetchByCity();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveOutfit(outfit, index) {
    try {
      const formData = new FormData();
      formData.append('name', `Recommended — ${data.weather.condition}, ${Math.round(data.weather.tempC)}°C`);
      formData.append('itemIds', outfit.items.map((i) => i._id).join(','));
      await api.post('/outfits', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSavedIndexes((prev) => new Set(prev).add(index));
      toast.success('Saved to My Outfits');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save outfit');
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Smart Recommendations</h1>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <Button onClick={handleUseLocation} className="gap-2">
              <MapPin className="h-4 w-4" />
              Use my location
            </Button>
            <span className="text-muted-foreground text-center sm:text-left">or</span>
            <form onSubmit={handleCitySubmit} className="flex gap-2 flex-1">
              <Input
                type="text"
                placeholder="Enter a city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" variant="secondary">Go</Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-muted-foreground">Fetching weather and building outfits…</p>}
      {error && <p className="text-destructive">{error}</p>}

      {data && (
        <div>
          <Card className="mb-6">
            <CardContent className="pt-4">
              <p className="font-medium">{data.location}</p>
              <p className="text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                <span>{Math.round(data.weather.tempC)}°C · {data.weather.condition}</span>
                {data.weather.isRainy && <span className="flex items-center gap-1"><CloudRain className="h-4 w-4" /> rain</span>}
                {data.weather.isWindy && <span className="flex items-center gap-1"><Wind className="h-4 w-4" /> windy</span>}
              </p>
            </CardContent>
          </Card>

          {data.message && <p className="text-muted-foreground mb-4">{data.message}</p>}

          <div className="space-y-4">
            {data.outfits.map((outfit, i) => (
              <Card key={i}>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground mb-3">{outfit.why}</p>
                  <div className="flex gap-3 flex-wrap">
                    {outfit.items.map((item) => (
                      <div key={item._id} className="text-center">
                        <div className="w-20 h-20 bg-muted rounded overflow-hidden flex items-center justify-center">
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                        </div>
                        <p className="text-xs mt-1">{item.name}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/try-on" state={{ preselect: outfit.items.map((item) => item._id) }}>
                        Try this on in AR →
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSaveOutfit(outfit, i)}
                      disabled={savedIndexes.has(i)}
                      className="gap-2"
                    >
                      {savedIndexes.has(i)
                        ? <><Check className="h-4 w-4 text-green-600" /> Saved</>
                        : <><Save className="h-4 w-4" /> Save outfit</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
