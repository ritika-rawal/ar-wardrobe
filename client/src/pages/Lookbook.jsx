import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import api from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const FILTERS = ['All', 'Casual', 'Formal', 'This week'];

function weekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

export default function Lookbook() {
  const toast = useToast();
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [sheetPin, setSheetPin] = useState(null);

  useEffect(() => {
    api
      .get('/lookbook')
      .then((r) => setPins(r.data.pins))
      .catch(() => toast.error('Failed to load lookbook'))
      .finally(() => setLoading(false));
  }, []);

  async function unpin(pinId) {
    try {
      await api.delete(`/lookbook/${pinId}`);
      setPins((prev) => prev.filter((p) => p._id !== pinId));
      if (sheetPin?._id === pinId) setSheetPin(null);
      toast.info('Unpinned');
    } catch {
      toast.error('Failed to unpin');
    }
  }

  const filtered = pins.filter((p) => {
    if (filter === 'All') return true;
    if (filter === 'This week') return new Date(p.createdAt) > weekAgo();
    const occasion = p.outfitId?.occasion || '';
    return occasion.toLowerCase() === filter.toLowerCase();
  });

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-medium tracking-tight mb-2">Lookbook</h1>
        <p className="text-sm text-muted-foreground mb-8">Your pinned outfits, all in one place.</p>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap mb-8">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className="focus:outline-none">
              <Badge
                variant={filter === f ? 'default' : 'outline'}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              >
                {f}
              </Badge>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="columns-2 md:columns-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="w-full mb-4 rounded-[14px]" style={{ height: `${140 + (i % 3) * 60}px` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p
              className="text-2xl mb-3"
              style={{ fontFamily: 'var(--brand-font-serif)', fontStyle: 'italic', color: 'var(--brand-muted)' }}
            >
              Your lookbook is empty
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Pin your favourite outfits to collect them here.
            </p>
            <Button asChild variant="secondary">
              <Link to="/outfits">Go to My Outfits <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
        ) : (
          <div className="columns-2 md:columns-3 gap-4">
            {filtered.map((pin) => {
              const outfit = pin.outfitId;
              const itemCount = outfit?.itemIds?.length || 0;
              return (
                <div
                  key={pin._id}
                  className="break-inside-avoid mb-4 rounded-[14px] overflow-hidden border cursor-pointer group relative"
                  style={{ borderColor: 'var(--brand-border)' }}
                  onClick={() => setSheetPin(pin)}
                >
                  {outfit?.snapshotUrl ? (
                    <img
                      src={outfit.snapshotUrl}
                      alt={outfit.name}
                      className="w-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full flex flex-wrap items-center justify-center gap-1 p-3 min-h-[120px]"
                      style={{ background: 'var(--brand-stone)' }}
                    >
                      {outfit?.itemIds?.slice(0, 4).map((item) => (
                        <div key={item._id} className="w-12 h-12 rounded overflow-hidden bg-white">
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium truncate">{outfit?.name || 'Outfit'}</p>
                    <p className="text-xs text-muted-foreground">
                      {itemCount} item{itemCount !== 1 ? 's' : ''} ·{' '}
                      {new Date(pin.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  {/* Unpin button */}
                  <button
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); unpin(pin._id); }}
                    aria-label="Unpin"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom sheet detail */}
      {sheetPin && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={() => setSheetPin(null)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white max-h-[75dvh] overflow-y-auto"
            style={{
              borderRadius: 'var(--brand-radius-lg) var(--brand-radius-lg) 0 0',
              animation: 'sheet-up 220ms ease',
              paddingBottom: 'env(safe-area-inset-bottom, 16px)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-base font-medium">{sheetPin.outfitId?.name || 'Outfit'}</h2>
              <button onClick={() => setSheetPin(null)} style={{ color: 'var(--brand-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div style={{ borderBottom: '1px solid var(--brand-border)' }} />
            <div className="px-5 py-4 space-y-4">
              {sheetPin.outfitId?.snapshotUrl && (
                <img
                  src={sheetPin.outfitId.snapshotUrl}
                  alt={sheetPin.outfitId.name}
                  className="w-full max-h-64 object-cover rounded-[14px]"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {sheetPin.outfitId?.itemIds?.map((item) => (
                  <div key={item._id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm"
                    style={{ borderColor: 'var(--brand-border)' }}>
                    <img src={item.imageUrl} alt={item.name} className="w-5 h-5 rounded-full object-cover" />
                    {item.name}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link
                    to="/try-on"
                    state={{ preselect: sheetPin.outfitId?.itemIds?.map((i) => i._id) }}
                    onClick={() => setSheetPin(null)}
                  >
                    Try on in AR
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="gap-1"
                  onClick={() => unpin(sheetPin._id)}
                >
                  <X className="h-4 w-4" /> Unpin
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
