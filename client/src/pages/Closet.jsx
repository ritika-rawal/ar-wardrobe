import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import api from '../api/client.js';
import ClothingCard from '../components/ClothingCard.jsx';
import UploadForm from '../components/UploadForm.jsx';
import GarmentCapture from '../components/GarmentCapture.jsx';
import { cutOutGarment } from '../ar/backgroundRemoval.js';
import EditItemModal from '../components/EditItemModal.jsx';
import CardGridSkeleton from '../components/CardGridSkeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';

export default function Closet() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [busy, setBusy] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [editingItem, setEditingItem] = useState(null);
  const [showCapture, setShowCapture] = useState(false);

  async function loadItems() {
    setLoading(true);
    try {
      const params = {};
      if (filterCategory) params.category = filterCategory;
      if (filterSeason) params.season = filterSeason;
      if (filterColor) params.color = filterColor.trim().toLowerCase();
      const res = await api.get('/wardrobe', { params });
      setItems(res.data.items);
    } catch (err) {
      setError('Failed to load closet');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadItems, 250); // debounce the free-text color filter
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterSeason, filterColor]);

  async function handleUpload(formData) {
    setBusy(true);
    setError('');
    try {
      const file = formData.get('image');
      const res = await api.post('/wardrobe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await loadItems();
      toast.success(`Added "${res.data.item.name}" to your closet`);
      processBackgroundRemoval(res.data.item._id, file);
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  // Fire-and-forget: cuts the garment out client-side (no server cost), then
  // attaches the transparent PNG as the item's AR try-on asset.
  async function processBackgroundRemoval(itemId, file) {
    setProcessingIds((prev) => new Set(prev).add(itemId));
    try {
      const cutoutBlob = await cutOutGarment(file);
      const assetForm = new FormData();
      assetForm.append('image', cutoutBlob, 'cutout.png');
      const res = await api.post(`/wardrobe/${itemId}/try-on-asset`, assetForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setItems((prev) => prev.map((i) => (i._id === itemId ? res.data.item : i)));
      toast.success('AR cutout ready ✨');
    } catch (err) {
      console.error('Background removal failed for item', itemId, err);
      toast.error('Could not prepare AR cutout for that item (will still show in try-on as a rectangle)');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  async function handleDelete(id) {
    await api.delete(`/wardrobe/${id}`);
    setItems((prev) => prev.filter((i) => i._id !== id));
    toast.info('Item deleted');
  }

  async function handleEditSave(updates) {
    const res = await api.put(`/wardrobe/${editingItem._id}`, updates);
    setItems((prev) => prev.map((i) => (i._id === editingItem._id ? res.data.item : i)));
    setEditingItem(null);
    toast.success('Item updated');
  }

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <UploadForm onSubmit={handleUpload} busy={busy} />
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <Button
          onClick={() => setShowCapture(true)}
          className="mt-3 w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Camera className="h-4 w-4" />
          Capture from camera
        </Button>
      </div>

      <div className="md:col-span-2">
        {!loading && items.length > 0 && (
          <div className="flex gap-4 flex-wrap mb-4 text-sm">
            <Stat label="Total items" value={items.length} />
            <Stat label="AR-ready" value={items.filter((i) => i.tryOnAssetUrl).length} />
            <Stat label="Tops" value={items.filter((i) => i.category === 'top').length} />
            <Stat label="Bottoms" value={items.filter((i) => i.category === 'bottom').length} />
            <Stat label="Outerwear" value={items.filter((i) => i.category === 'outerwear').length} />
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <h1 className="text-2xl font-semibold">My Closet</h1>
          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded px-3 py-2 min-h-[44px] flex-1 sm:flex-none"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">All categories</option>
              <option value="top">Tops</option>
              <option value="bottom">Bottoms</option>
              <option value="outerwear">Outerwear</option>
              <option value="shoes">Shoes</option>
              <option value="accessory">Accessories</option>
            </select>
            <select
              className="border rounded px-3 py-2 min-h-[44px] flex-1 sm:flex-none"
              value={filterSeason}
              onChange={(e) => setFilterSeason(e.target.value)}
            >
              <option value="">All seasons</option>
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="autumn">Autumn</option>
              <option value="winter">Winter</option>
            </select>
            <input
              type="text"
              placeholder="Filter by color"
              className="border rounded px-3 py-2 min-h-[44px] w-full sm:w-36"
              value={filterColor}
              onChange={(e) => setFilterColor(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <CardGridSkeleton />
        ) : items.length === 0 ? (
          <p className="text-slate-500">No items yet — add your first piece of clothing!</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {items.map((item) => (
              <ClothingCard
                key={item._id}
                item={item}
                onDelete={handleDelete}
                onEdit={setEditingItem}
                processing={processingIds.has(item._id)}
              />
            ))}
          </div>
        )}
      </div>

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onSave={handleEditSave}
          onClose={() => setEditingItem(null)}
        />
      )}

      {showCapture && (
        <GarmentCapture
          onSaved={(newItem) => setItems((prev) => [newItem, ...prev])}
          onClose={() => setShowCapture(false)}
        />
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white px-3 py-2 rounded-lg shadow">
      <span className="font-semibold text-indigo-600">{value}</span>{' '}
      <span className="text-slate-500">{label}</span>
    </div>
  );
}
