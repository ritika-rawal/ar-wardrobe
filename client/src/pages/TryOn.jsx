import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Save, X } from 'lucide-react';
import api from '../api/client.js';
import ClothingCard from '../components/ClothingCard.jsx';
import WebcamAR from '../components/WebcamAR.jsx';
import CardGridSkeleton from '../components/CardGridSkeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export default function TryOn() {
  const toast = useToast();
  const { state: routerState } = useLocation();
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
      .then((res) => {
        const all = res.data.items;
        setItems(all);
        if (routerState?.preselect?.length) {
          const ids = new Set(routerState.preselect);
          setSelected(all.filter((i) => ids.has(i._id)));
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSelect(item) {
    setSelected((prev) => {
      const exists = prev.find((i) => i._id === item._id);
      if (exists) return prev.filter((i) => i._id !== item._id);
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
        <p className="text-sm text-muted-foreground mb-4">
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
                className="flex items-center gap-2 bg-white border border-border rounded-full pl-1 pr-3 py-1.5 text-sm shadow-sm hover:bg-muted transition-colors"
              >
                <img src={item.imageUrl} alt={item.name} className="w-6 h-6 rounded-full object-cover" />
                <span className="truncate max-w-[100px]">{item.name}</span>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        <Card className="mt-4 max-w-[640px] mx-auto">
          <CardHeader className="pb-2 pt-4 px-4">
            <p className="text-sm font-medium">Fit adjustment</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Size: {scale.toFixed(2)}x</Label>
              <Slider
                min={0.6} max={1.6} step={0.02}
                value={[scale]}
                onValueChange={([v]) => setScale(v)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Vertical position: {yOffset.toFixed(2)}</Label>
              <Slider
                min={-0.3} max={0.3} step={0.01}
                value={[yOffset]}
                onValueChange={([v]) => setYOffset(v)}
              />
            </div>
          </CardContent>
        </Card>

        {snapshot && (
          <div className="mt-4 max-w-[640px] mx-auto">
            <p className="text-sm text-muted-foreground mb-1">Last snapshot:</p>
            <img src={snapshot} alt="snapshot" className="w-full sm:w-64 rounded-lg shadow" />
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <Input
                type="text"
                placeholder="Name this look (optional)"
                value={outfitName}
                onChange={(e) => setOutfitName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleSaveOutfit} disabled={saving} className="gap-2 whitespace-nowrap">
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save this look'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-3">Your closet</h2>
        {loading ? (
          <CardGridSkeleton count={4} />
        ) : tryOnable.length === 0 ? (
          <p className="text-muted-foreground">
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
