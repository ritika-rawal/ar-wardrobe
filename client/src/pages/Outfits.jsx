import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import CardGridSkeleton from '../components/CardGridSkeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';

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
    } catch (err) {
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
        <p className="text-red-600">{error}</p>
      ) : outfits.length === 0 ? (
        <p className="text-slate-500">
          No saved outfits yet — save a look from{' '}
          <Link to="/try-on" className="text-indigo-600 hover:underline">
            Try-On
          </Link>{' '}
          or{' '}
          <Link to="/recommendations" className="text-indigo-600 hover:underline">
            Recommendations
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {outfits.map((outfit) => (
            <div key={outfit._id} className="bg-white rounded-lg shadow overflow-hidden">
              {outfit.snapshotUrl ? (
                <img src={outfit.snapshotUrl} alt={outfit.name} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-slate-100 flex flex-wrap items-center justify-center gap-1 p-2">
                  {outfit.itemIds.map((item) => (
                    <div key={item._id} className="w-14 h-14 bg-slate-200 rounded overflow-hidden flex items-center justify-center">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3">
                <p className="font-medium truncate">{outfit.name}</p>
                <p className="text-sm text-slate-500 truncate">
                  {outfit.itemIds.map((i) => i.name).join(', ')}
                </p>
                <button
                  onClick={() => handleDelete(outfit._id)}
                  className="mt-2 min-h-[36px] text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
