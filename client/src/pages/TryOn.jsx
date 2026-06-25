import { useEffect, useState } from 'react';
import api from '../api/client.js';
import ClothingCard from '../components/ClothingCard.jsx';
import WebcamAR from '../components/WebcamAR.jsx';
import CardGridSkeleton from '../components/CardGridSkeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function TryOn() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [scale, setScale] = useState(1);
  const [yOffset, setYOffset] = useState(0);
  const [outfitName, setOutfitName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/wardrobe')
      .then((res) => setItems(res.data.items))
      .finally(() => setLoading(false));
  }, []);

  function toggleSelect(item) {
    setSelected((prev) => {
      const exists = prev.find((i) => i._id === item._id);
      if (exists) return prev.filter((i) => i._id !== item._id);
      // only one item per category at a time (top/bottom/outerwear can combine, but not two tops)
      const withoutSameCategory = prev.filter((i) => i.category !== item.category);
      return [...withoutSameCategory, item];
    });
  }

  const tryOnable = items.filter((i) => ['top', 'bottom', 'outerwear'].includes(i.category));

  async function handleSaveOutfit() {
    if (!snapshot || selected.length === 0) return;
    setSaving(true);
    try {
      const blob = await (await fetch(snapshot)).blob();
      const formData = new FormData();
      formData.append('snapshot', blob, 'snapshot.png');
      formData.append('name', outfitName || `Look — ${new Date().toLocaleDateString()}`);
      formData.append('itemIds', selected.map((i) => i._id).join(','));
      await api.post('/outfits', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Look saved! Check My Outfits.');
      setOutfitName('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save outfit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <h1 className="text-2xl font-semibold mb-4">Live AR Try-On</h1>
        <p className="text-sm text-slate-500 mb-4">
          Select a top, bottom, and/or outerwear from your closet on the right, then allow webcam
          access. Garments are tracked to your body in real time and wrap around your silhouette.
        </p>
        <WebcamAR selectedItems={selected} fit={{ scale, yOffset }} onSnapshot={setSnapshot} />

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 max-w-[640px] mx-auto">
            {selected.map((item) => (
              <button
                key={item._id}
                onClick={() => toggleSelect(item)}
                title="Tap to remove"
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-full pl-1 pr-3 py-1.5 text-sm shadow-sm"
              >
                <img src={item.imageUrl} alt={item.name} className="w-6 h-6 rounded-full object-cover" />
                <span className="truncate max-w-[100px]">{item.name}</span>
                <span className="text-slate-400">✕</span>
              </button>
            ))}
          </div>
        )}

        <div className="bg-white p-4 rounded-lg shadow mt-4 max-w-[640px] mx-auto space-y-3">
          <p className="text-sm font-medium text-slate-600">Fit adjustment</p>
          <div>
            <label className="text-xs text-slate-500">Size: {scale.toFixed(2)}x</label>
            <input
              type="range"
              min="0.6"
              max="1.6"
              step="0.02"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Vertical position: {yOffset.toFixed(2)}</label>
            <input
              type="range"
              min="-0.3"
              max="0.3"
              step="0.01"
              value={yOffset}
              onChange={(e) => setYOffset(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {snapshot && (
          <div className="mt-4 max-w-[640px] mx-auto">
            <p className="text-sm text-slate-600 mb-1">Last snapshot:</p>
            <img src={snapshot} alt="snapshot" className="w-full sm:w-64 rounded-lg shadow" />
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Name this look (optional)"
                className="border rounded px-3 py-2 flex-1 min-h-[44px]"
                value={outfitName}
                onChange={(e) => setOutfitName(e.target.value)}
              />
              <button
                onClick={handleSaveOutfit}
                disabled={saving}
                className="min-h-[44px] bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? 'Saving...' : '💾 Save this look'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-3">Your closet</h2>
        {loading ? (
          <CardGridSkeleton count={4} />
        ) : tryOnable.length === 0 ? (
          <p className="text-slate-500">
            No tops/bottoms/outerwear yet — add some in your Closet first.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tryOnable.map((item) => (
              <ClothingCard
                key={item._id}
                item={item}
                selectable
                selected={!!selected.find((i) => i._id === item._id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
