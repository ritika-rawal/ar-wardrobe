import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCheck, CloudRain, Info, MapPin, RefreshCw, Save, Wind } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const OCCASIONS = [
  { value: '', label: 'Any' },
  { value: 'casual', label: 'Casual' },
  { value: 'work', label: 'Work' },
  { value: 'formal', label: 'Formal' },
  { value: 'outdoor', label: 'Outdoor' },
];

export default function Recommendations() {
  const toast = useToast();
  const [city, setCity] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [occasion, setOccasion] = useState('');
  const [savedIndexes, setSavedIndexes] = useState(new Set());
  const [savedOutfitIds, setSavedOutfitIds] = useState({});
  const [wornIndexes, setWornIndexes] = useState(new Set());
  const lastParamsRef = useRef(null);

  async function fetchByCoords(lat, lon, occ = occasion) {
    const params = { lat, lon };
    if (occ) params.occasion = occ;
    lastParamsRef.current = { coords: { lat, lon }, occ };
    const res = await api.get('/recommend', { params });
    setData(res.data);
    setSavedIndexes(new Set());
    setSavedOutfitIds({});
    setWornIndexes(new Set());
  }

  async function fetchByCity(cityName = city, occ = occasion) {
    const params = { city: cityName };
    if (occ) params.occasion = occ;
    lastParamsRef.current = { city: cityName, occ };
    const res = await api.get('/recommend', { params });
    setData(res.data);
    setSavedIndexes(new Set());
    setSavedOutfitIds({});
    setWornIndexes(new Set());
  }

  async function autoLoad() {
    setLoading(true);
    setError('');
    if (!navigator.geolocation) {
      await ipFallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetchByCoords(pos.coords.latitude, pos.coords.longitude);
        } catch (err) {
          await ipFallback();
        } finally {
          setLoading(false);
        }
      },
      async () => {
        await ipFallback();
      }
    );
  }

  async function ipFallback() {
    try {
      const geo = await fetch('https://ipapi.co/json/').then((r) => r.json());
      if (geo.city) {
        await fetchByCity(geo.city);
      } else {
        setError('Could not determine location. Enter a city below.');
      }
    } catch {
      setError('Could not determine location. Enter a city below.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount
  useEffect(() => { autoLoad(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      await fetchByCity(city.trim());
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  }

  async function handleReroll() {
    if (!lastParamsRef.current) return;
    setLoading(true);
    setError('');
    try {
      const p = lastParamsRef.current;
      if (p.coords) await fetchByCoords(p.coords.lat, p.coords.lon, p.occ);
      else await fetchByCity(p.city, p.occ);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  }

  async function handleOccasionChange(val) {
    setOccasion(val);
    if (!lastParamsRef.current) return;
    setLoading(true);
    setError('');
    try {
      const p = lastParamsRef.current;
      if (p.coords) await fetchByCoords(p.coords.lat, p.coords.lon, val);
      else await fetchByCity(p.city, val);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveOutfit(outfit, index) {
    try {
      const formData = new FormData();
      formData.append('name', `Recommended — ${data.weather.condition}, ${Math.round(data.weather.tempC)}°C`);
      formData.append('itemIds', outfit.items.map((i) => i._id).join(','));
      const res = await api.post('/outfits', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSavedIndexes((prev) => new Set(prev).add(index));
      setSavedOutfitIds((prev) => ({ ...prev, [index]: res.data.outfit._id }));
      toast.success('Saved to My Outfits');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save outfit');
    }
  }

  async function handleMarkWorn(index) {
    const outfitId = savedOutfitIds[index];
    if (!outfitId) return;
    try {
      await api.post(`/outfits/${outfitId}/worn`);
      setWornIndexes((prev) => new Set(prev).add(index));
      toast.success('Marked as worn today');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to mark as worn');
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

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="pt-4">
                <Skeleton className="h-3 w-48 mb-4" />
                <div className="flex gap-3">
                  {[0, 1, 2].map((j) => (
                    <Skeleton key={j} className="w-20 h-20 rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {error && <p className="text-destructive">{error}</p>}

      {data && !loading && (
        <div>
          {/* Weather summary + re-roll */}
          <Card className="mb-4">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{data.location}</p>
                  <p className="text-muted-foreground flex items-center gap-2 flex-wrap mt-1 text-sm">
                    <span>{Math.round(data.weather.tempC)}°C · {data.weather.condition}</span>
                    {data.weather.isRainy && <span className="flex items-center gap-1"><CloudRain className="h-4 w-4" /> rain</span>}
                    {data.weather.isWindy && <span className="flex items-center gap-1"><Wind className="h-4 w-4" /> windy</span>}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleReroll}>
                  <RefreshCw className="h-4 w-4" /> Re-roll
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Occasion filter */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {OCCASIONS.map(({ value, label }) => (
              <button key={value} onClick={() => handleOccasionChange(value)} className="focus:outline-none">
                <Badge
                  variant={occasion === value ? 'default' : 'outline'}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                >
                  {label}
                </Badge>
              </button>
            ))}
          </div>

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
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/try-on" state={{ preselect: outfit.items.map((item) => item._id) }}>
                        Try in AR →
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
                    {savedIndexes.has(i) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkWorn(i)}
                        disabled={wornIndexes.has(i)}
                        className="gap-2"
                      >
                        {wornIndexes.has(i)
                          ? <><CheckCheck className="h-4 w-4 text-green-600" /> Worn today</>
                          : <><CheckCheck className="h-4 w-4" /> Mark as worn</>}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.nudge && (
            <div className="flex items-start gap-2 mt-5 px-4 py-3 rounded-[14px] text-sm text-muted-foreground"
              style={{ background: 'var(--brand-stone)' }}>
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{data.nudge}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
