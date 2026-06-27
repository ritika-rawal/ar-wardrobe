import { useEffect, useMemo, useState } from 'react';
import { Camera, Palette, Search, Trash2, Upload } from 'lucide-react';
import api from '../api/client.js';
import ClothingCard from '../components/ClothingCard.jsx';
import UploadForm from '../components/UploadForm.jsx';
import GarmentCapture from '../components/GarmentCapture.jsx';
import { cutOutGarment } from '../ar/backgroundRemoval.js';
import EditItemModal from '../components/EditItemModal.jsx';
import CardGridSkeleton from '../components/CardGridSkeleton.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const CATEGORY_PILLS = [
  { value: '', label: 'All' },
  { value: 'top', label: 'Tops' },
  { value: 'bottom', label: 'Bottoms' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'accessory', label: 'Accessories' },
];

const SEASON_PILLS = [
  { value: '', label: 'All seasons' },
  { value: 'spring', label: 'Spring' },
  { value: 'summer', label: 'Summer' },
  { value: 'autumn', label: 'Autumn' },
  { value: 'winter', label: 'Winter' },
];

export default function Closet() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [editingItem, setEditingItem] = useState(null);
  const [showCapture, setShowCapture] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
    const timer = setTimeout(loadItems, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterSeason, filterColor]);

  // Client-side name search on top of the server-filtered list
  const displayedItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

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
      toast.success('AR cutout ready');
    } catch (err) {
      console.error('Background removal failed for item', itemId, err);
      toast.error('Could not prepare AR cutout for that item');
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

  function toggleBulkSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map((id) => api.delete(`/wardrobe/${id}`)));
      const count = selectedIds.size;
      setItems((prev) => prev.filter((i) => !selectedIds.has(i._id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      toast.success(`${count} item${count > 1 ? 's' : ''} deleted`);
    } catch {
      toast.error('Bulk delete failed');
    } finally {
      setBulkDeleting(false);
    }
  }

  const filtersActive = filterCategory || filterSeason || filterColor;

  return (
    <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left sidebar */}
      <div className="md:col-span-1">
        <div data-upload-form>
          <UploadForm onSubmit={handleUpload} busy={busy} />
        </div>
        {error && <p className="text-destructive text-sm mt-2">{error}</p>}
        <Button
          onClick={() => setShowCapture(true)}
          className="mt-3 w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
        >
          <Camera className="h-4 w-4" />
          Capture from camera
        </Button>
      </div>

      {/* Main grid */}
      <div className="md:col-span-2">
        {/* Stats */}
        {!loading && items.length > 0 && (
          <div className="flex gap-3 flex-wrap mb-4 text-sm">
            <Stat label="Total" value={items.length} />
            <Stat label="AR-ready" value={items.filter((i) => i.tryOnAssetUrl).length} />
            <Stat label="Tops" value={items.filter((i) => i.category === 'top').length} />
            <Stat label="Bottoms" value={items.filter((i) => i.category === 'bottom').length} />
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-semibold">My Closet</h1>
          <Button
            variant={selectMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter pills */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORY_PILLS.map(({ value, label }) => (
              <button key={value} onClick={() => setFilterCategory(value)} className="focus:outline-none">
                <Badge
                  variant={filterCategory === value ? 'default' : 'outline'}
                  className="cursor-pointer capitalize hover:opacity-80 transition-opacity"
                >
                  {label}
                </Badge>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {SEASON_PILLS.map(({ value, label }) => (
              <button key={value} onClick={() => setFilterSeason(value)} className="focus:outline-none">
                <Badge
                  variant={filterSeason === value ? 'default' : 'outline'}
                  className="cursor-pointer capitalize hover:opacity-80 transition-opacity"
                >
                  {label}
                </Badge>
              </button>
            ))}
            {filtersActive && (
              <Badge variant="secondary" className="ml-1">Filters active</Badge>
            )}
          </div>
          <div className="relative">
            <Palette className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by color"
              value={filterColor}
              onChange={(e) => setFilterColor(e.target.value)}
              className="pl-9 max-w-48"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <CardGridSkeleton />
        ) : displayedItems.length === 0 && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-lg font-medium mb-1">Your wardrobe is empty</p>
            <p className="text-muted-foreground text-sm mb-4">Add your first garment to get started</p>
            <Button variant="outline" onClick={() => document.querySelector('[data-upload-form]')?.scrollIntoView({ behavior: 'smooth' })}>
              Upload item
            </Button>
          </div>
        ) : displayedItems.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">No items match your search.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {displayedItems.map((item) => (
              <ClothingCard
                key={item._id}
                item={item}
                onDelete={selectMode ? undefined : handleDelete}
                onEdit={selectMode ? undefined : setEditingItem}
                processing={processingIds.has(item._id)}
                selectMode={selectMode}
                bulkSelected={selectedIds.has(item._id)}
                onBulkToggle={toggleBulkSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
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

      {/* Floating bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white border shadow-lg rounded-full px-5 py-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2 rounded-full"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            <Trash2 className="h-4 w-4" />
            {bulkDeleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
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
