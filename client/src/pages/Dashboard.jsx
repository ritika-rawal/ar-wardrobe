import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSun, ArrowRight, Shirt, CalendarPlus, Layers, Sparkles } from 'lucide-react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const COLOR_HEX = {
  black: '#1a1a1a', white: '#f5f5f5', grey: '#9e9e9e', gray: '#9e9e9e',
  navy: '#1a237e', blue: '#1976d2', red: '#e53935', green: '#43a047',
  yellow: '#fdd835', brown: '#795548', beige: '#d7ccc8', pink: '#e91e63',
  purple: '#8e24aa', orange: '#fb8c00', cream: '#fffde7', khaki: '#bdb76b',
  teal: '#00897b', olive: '#689f38', maroon: '#880e4f', coral: '#ef5350',
  mint: '#a5d6a7', lavender: '#ce93d8', tan: '#d2b48c', charcoal: '#37474f',
  ivory: '#fffff0', rose: '#f06292',
};

const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Soft-brown dashboard palette
const INK = '#3d2b1f';
const MUTED = '#8a7362';
const ACCENT = '#8b5e3c';
const ACCENT_DARK = '#6b4530';
const CARD_BG = '#fffaf3';
const CARD_BORDER = 'rgba(93, 64, 40, 0.12)';
const SOFT_TINT = 'rgba(139, 94, 60, 0.10)';
const CARD_SHADOW = '0 2px 14px rgba(93, 64, 40, 0.06)';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function startOfWeekMonday(d) {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(d.getDate() + diff);
  return mon;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [wardrobe, setWardrobe] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [rec, setRec] = useState(null);
  const [recLoading, setRecLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/wardrobe'), api.get('/outfits')])
      .then(([wRes, oRes]) => {
        setWardrobe(wRes.data.items || []);
        setOutfits(oRes.data.outfits || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function fetchRec(lat, lon) {
      api
        .get(`/recommend?lat=${lat}&lon=${lon}`)
        .then((r) => setRec(r.data))
        .catch(() => setRec(null))
        .finally(() => setRecLoading(false));
    }
    navigator.geolocation?.getCurrentPosition(
      (p) => fetchRec(p.coords.latitude, p.coords.longitude),
      () => {
        fetch('https://ipapi.co/json/')
          .then((r) => r.json())
          .then((d) => fetchRec(d.latitude, d.longitude))
          .catch(() => { setRec(null); setRecLoading(false); });
      },
      { timeout: 5000 }
    );
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const totalItems = wardrobe.length;
  const addedThisWeek = wardrobe.filter((i) => new Date(i.createdAt) > weekAgo).length;
  const outfitCount = outfits.length;
  const arReady = wardrobe.filter((i) => i.tryOnAssetUrl).length;

  const catCounts = CATEGORIES.map((c) => ({
    label: c.charAt(0).toUpperCase() + c.slice(1),
    count: wardrobe.filter((i) => i.category === c).length,
  }));
  const maxCat = Math.max(...catCounts.map((c) => c.count), 1);

  const colorTally = {};
  wardrobe.forEach((i) => {
    if (i.color) colorTally[i.color.toLowerCase()] = (colorTally[i.color.toLowerCase()] || 0) + 1;
  });
  const topColors = Object.entries(colorTally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const monStart = startOfWeekMonday(today);
  const weekDays = DAY_LABELS.map((label, i) => {
    const d = new Date(monStart);
    d.setDate(monStart.getDate() + i);
    const isToday = d.toDateString() === today.toDateString();
    const hasOutfit = outfits.some((o) => {
      const od = new Date(o.createdAt);
      return od.toDateString() === d.toDateString();
    });
    return { label, isToday, hasOutfit };
  });

  const recentOutfits = [...outfits]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);

  const allWornIds = new Set(outfits.flatMap((o) => (o.itemIds || []).map((id) => id?._id || id)));
  const neverWorn = wardrobe.filter((i) => !allWornIds.has(i._id)).slice(0, 2);

  const styleVibes = user?.preferences?.styleVibes || [];
  const favColors = user?.preferences?.favoriteColors || [];
  const occasions = user?.preferences?.occasions || [];

  const STAT_LABELS = [
    { label: 'Items', value: totalItems, Icon: Shirt },
    { label: 'Added this week', value: addedThisWeek, Icon: CalendarPlus },
    { label: 'Outfits saved', value: outfitCount, Icon: Layers },
    { label: 'AR-ready', value: arReady, Icon: Sparkles },
  ];

  const card = { background: CARD_BG, border: `1px solid ${CARD_BORDER}`, boxShadow: CARD_SHADOW };

  return (
    <div
      className="min-h-[calc(100vh-56px)]"
      style={{ background: 'linear-gradient(180deg, #f4e9d9 0%, #ece0cb 100%)' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        {/* Greeting banner */}
        <div className="rounded-2xl px-6 py-6 sm:px-8 sm:py-7 flex items-center justify-between gap-4" style={card}>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: INK }}>
              {greeting()}, {firstName}
            </h1>
            <p className="text-sm mt-1" style={{ color: MUTED }}>
              {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div
            className="hidden sm:flex w-12 h-12 rounded-full items-center justify-center shrink-0"
            style={{ background: SOFT_TINT }}
          >
            <Sparkles className="h-5 w-5" style={{ color: ACCENT }} />
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STAT_LABELS.map(({ label, value, Icon }) => (
            <div key={label} className="rounded-2xl p-5" style={card}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center mb-3"
                style={{ background: SOFT_TINT }}
              >
                <Icon className="h-4 w-4" style={{ color: ACCENT }} />
              </div>
              {loading ? (
                <Skeleton className="h-7 w-10 mb-1" />
              ) : (
                <p className="text-2xl font-semibold" style={{ color: INK }}>{value}</p>
              )}
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Main grid: content (left) + sidebar (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Wardrobe breakdown */}
            <div className="rounded-2xl p-6 sm:p-7" style={card}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: MUTED }}>
                Wardrobe
              </h2>
              <div className="grid sm:grid-cols-2 sm:gap-x-10 gap-y-3">
                {catCounts.map(({ label, count }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-sm w-20 shrink-0" style={{ color: INK }}>{label}</span>
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: SOFT_TINT }}>
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${(count / maxCat) * 100}%`, background: ACCENT }}
                      />
                    </div>
                    <span className="text-sm w-4 text-right shrink-0" style={{ color: MUTED }}>{count}</span>
                  </div>
                ))}
              </div>

              {topColors.length > 0 && (
                <div className="flex items-center gap-4 mt-6 pt-6" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                  {topColors.map(([color]) => (
                    <div key={color} className="flex flex-col items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-full border"
                        style={{ background: COLOR_HEX[color] || '#ccc', borderColor: CARD_BORDER }}
                      />
                      <span className="text-[10px] capitalize" style={{ color: MUTED }}>{color}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent outfits */}
            {outfits.length > 0 && (
              <div className="rounded-2xl p-6 sm:p-7" style={card}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
                    Recent outfits
                  </h2>
                  <Link to="/outfits" className="text-xs flex items-center gap-1" style={{ color: ACCENT }}>
                    View all <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {recentOutfits.map((o) => (
                    <div
                      key={o._id}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl"
                      style={{ background: SOFT_TINT }}
                    >
                      {o.snapshotUrl && (
                        <img src={o.snapshotUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: INK }}>{o.name}</p>
                        <p className="text-xs" style={{ color: MUTED }}>
                          {new Date(o.createdAt).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Style profile */}
            <div className="rounded-2xl p-6 sm:p-7" style={card}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: MUTED }}>
                  Style profile
                </h2>
                <Link to="/profile" className="text-xs" style={{ color: ACCENT }}>
                  Edit
                </Link>
              </div>
              {styleVibes.length === 0 && favColors.length === 0 && occasions.length === 0 ? (
                <p className="text-sm" style={{ color: MUTED }}>
                  No preferences set yet.{' '}
                  <Link to="/profile" className="underline" style={{ color: INK }}>
                    Add some
                  </Link>{' '}
                  to get better recommendations.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {styleVibes.map((v) => (
                    <Badge key={v} variant="secondary" className="capitalize">{v}</Badge>
                  ))}
                  {favColors.map((c) => (
                    <Badge key={c} variant="outline" className="capitalize">{c}</Badge>
                  ))}
                  {occasions.map((o) => (
                    <Badge key={o} variant="secondary" className="capitalize">{o}</Badge>
                  ))}
                </div>
              )}
              {neverWorn.length > 0 && (
                <p className="text-xs mt-4" style={{ color: MUTED }}>
                  Never worn:{' '}
                  {neverWorn.map((i) => i.name).join(', ')}
                  {wardrobe.filter((i) => !allWornIds.has(i._id)).length > 2 &&
                    ` +${wardrobe.filter((i) => !allWornIds.has(i._id)).length - 2} more`}
                </p>
              )}
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Recommendation teaser — highlighted */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: MUTED }}>
                Today's suggestion
              </h2>
              {recLoading ? (
                <div className="rounded-2xl p-6" style={card}>
                  <Skeleton className="h-4 w-32 mb-3" />
                  <Skeleton className="h-3 w-48 mb-2" />
                  <Skeleton className="h-3 w-40" />
                </div>
              ) : rec && rec.outfits?.length > 0 ? (
                <div
                  className="rounded-2xl p-6"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
                    boxShadow: '0 8px 24px rgba(93, 64, 40, 0.22)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CloudSun className="h-4 w-4 text-white/80 shrink-0" />
                    <span className="text-sm text-white/80">
                      {rec.weather && `${Math.round(rec.weather.tempC)}°C · ${rec.weather.condition} · `}
                      {rec.location}
                    </span>
                  </div>
                  <p className="text-base font-medium text-white mb-1">
                    {rec.outfits[0].items?.map((i) => i.name).join(', ') || 'Outfit suggestion'}
                  </p>
                  {rec.outfits[0].note && (
                    <p className="text-sm text-white/75 mb-4">{rec.outfits[0].note}</p>
                  )}
                  <Button asChild size="sm" style={{ background: '#fffaf3', color: ACCENT_DARK }}>
                    <Link to="/recommendations">
                      See all suggestions <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl p-6" style={card}>
                  <p className="text-sm mb-3" style={{ color: MUTED }}>
                    Add items to your wardrobe to get daily outfit suggestions.
                  </p>
                  <Button asChild size="sm" style={{ background: ACCENT, color: '#fffaf3' }}>
                    <Link to="/closet">Go to Closet</Link>
                  </Button>
                </div>
              )}
            </div>

            {/* Weekly activity */}
            <div className="rounded-2xl p-6" style={card}>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: MUTED }}>
                This week
              </h2>
              <div className="flex justify-between">
                {weekDays.map(({ label, isToday, hasOutfit }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{
                        background: isToday ? ACCENT_DARK : hasOutfit ? ACCENT : SOFT_TINT,
                      }}
                    />
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: isToday ? INK : MUTED }}
                    >
                      {label[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
