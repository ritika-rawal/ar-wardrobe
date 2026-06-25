import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';

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

      <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
        <button
          onClick={handleUseLocation}
          className="min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded"
        >
          📍 Use my location
        </button>
        <span className="text-slate-400 text-center sm:text-left">or</span>
        <form onSubmit={handleCitySubmit} className="flex gap-2">
          <input
            type="text"
            placeholder="Enter a city"
            className="border rounded px-3 py-2 min-h-[44px] flex-1"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button type="submit" className="min-h-[44px] bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded">
            Go
          </button>
        </form>
      </div>

      {loading && <p className="text-slate-500">Fetching weather and building outfits...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {data && (
        <div>
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <p className="font-medium">{data.location}</p>
            <p className="text-slate-600">
              {Math.round(data.weather.tempC)}°C · {data.weather.condition}
              {data.weather.isRainy ? ' · 🌧️ rain' : ''}
              {data.weather.isWindy ? ' · 💨 windy' : ''}
            </p>
          </div>

          {data.message && <p className="text-slate-500 mb-4">{data.message}</p>}

          <div className="space-y-4">
            {data.outfits.map((outfit, i) => (
              <div key={i} className="bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-slate-500 mb-2">{outfit.why}</p>
                <div className="flex gap-3 flex-wrap">
                  {outfit.items.map((item) => (
                    <div key={item._id} className="text-center">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                      <p className="text-xs mt-1">{item.name}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <Link
                    to="/try-on"
                    className="min-h-[44px] flex items-center text-sm text-indigo-600 hover:underline"
                  >
                    Try this on in AR →
                  </Link>
                  <button
                    onClick={() => handleSaveOutfit(outfit, i)}
                    disabled={savedIndexes.has(i)}
                    className="min-h-[44px] text-left text-sm text-slate-600 hover:underline disabled:text-green-600 disabled:no-underline"
                  >
                    {savedIndexes.has(i) ? '✓ Saved to My Outfits' : '💾 Save outfit'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
