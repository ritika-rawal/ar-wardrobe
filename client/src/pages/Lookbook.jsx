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

  const serif = { fontFamily: 'var(--brand-font-serif)', fontStyle: 'italic' };
  // Varied tile heights give the no-snapshot collage tiles a moodboard rhythm instead of a uniform grid.
  const COLLAGE_HEIGHTS = [260, 320, 230, 300, 280, 250];

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Editorial header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">Curated · Mood board</p>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <h1 className="text-4xl sm:text-5xl leading-none" style={serif}>Lookbook</h1>
            {!loading && pins.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {pins.length} look{pins.length !== 1 ? 's' : ''} pinned
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-3 max-w-md">
            A living collage of your favourite looks — pin, revisit, and try them on.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap mb-8">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className="focus:outline-none">
              <Badge
                variant={filter === f ? 'default' : 'outline'}
                className="cursor-pointer hover:opacity-80 transition-opacity rounded-full px-3 py-1"
              >
                {f}
              </Badge>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="w-full mb-3 rounded-2xl" style={{ height: `${200 + (i % 3) * 70}px` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-3xl mb-3" style={{ ...serif, color: 'var(--brand-muted)' }}>
              {pins.length === 0 ? 'Your lookbook is empty' : 'Nothing in this filter'}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Pin your favourite outfits to collect them into a mood board.
            </p>
            <Button asChild variant="secondary">
              <Link to="/outfits">Go to My Outfits <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
            {filtered.map((pin, idx) => {
              const outfit = pin.outfitId;
              const itemCount = outfit?.itemIds?.length || 0;
              const occasion = outfit?.occasion;
              const dateLabel = new Date(pin.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              return (
                <div
                  key={pin._id}
                  className="break-inside-avoid mb-3 rounded-2xl overflow-hidden cursor-pointer group relative bg-black shadow-sm hover:shadow-xl transition-shadow"
                  onClick={() => setSheetPin(pin)}
                >
                  {outfit?.snapshotUrl ? (
                    <img
                      src={outfit.snapshotUrl}
                      alt={outfit.name}
                      className="w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="w-full grid grid-cols-2 gap-2 p-4 transition-transform duration-500 group-hover:scale-[1.03]"
                      style={{ background: 'var(--brand-stone)', height: `${COLLAGE_HEIGHTS[idx % COLLAGE_HEIGHTS.length]}px` }}
                    >
                      {outfit?.itemIds?.slice(0, 4).map((item) => (
                        <div key={item._id} className="rounded-lg overflow-hidden bg-white/70 flex items-center justify-center p-1">
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Caption overlay */}
                  <div className="absolute inset-x-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent">
                    <p className="text-white text-sm font-medium truncate drop-shadow">{outfit?.name || 'Outfit'}</p>
                    <p className="text-white/70 text-xs">
                      {itemCount} item{itemCount !== 1 ? 's' : ''} · {dateLabel}
                    </p>
                  </div>

                  {/* Occasion tag */}
                  {occasion && (
                    <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider bg-white/85 text-slate-800 px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {occasion}
                    </span>
                  )}

                  {/* Unpin */}
                  <button
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                    onClick={(e) => { e.stopPropagation(); unpin(pin._id); }}
                    aria-label="Unpin"
                  >
                    <X className="h-3.5 w-3.5" />
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
