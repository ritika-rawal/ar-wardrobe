import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSun, ArrowRight } from 'lucide-react';
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
    { label: 'Items', value: totalItems },
    { label: 'Added this week', value: addedThisWeek },
    { label: 'Outfits saved', value: outfitCount },
    { label: 'AR-ready', value: arReady },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-medium tracking-tight">
          {greeting()}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STAT_LABELS.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-[14px] border px-4 py-4"
            style={{ borderColor: 'var(--brand-border)' }}
          >
            {loading ? (
              <Skeleton className="h-7 w-8 mb-1" />
            ) : (
              <p className="text-2xl font-medium">{value}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Wardrobe breakdown */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-5">
          Wardrobe
        </h2>
        <div className="space-y-3">
          {catCounts.map(({ label, count }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-sm w-20 shrink-0">{label}</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--brand-stone)' }}>
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${(count / maxCat) * 100}%`,
                    background: 'var(--brand-black)',
                  }}
                />
              </div>
              <span className="text-sm text-muted-foreground w-4 text-right shrink-0">{count}</span>
            </div>
          ))}
        </div>

        {topColors.length > 0 && (
          <div className="flex items-center gap-4 mt-6">
            {topColors.map(([color]) => (
              <div key={color} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full border"
                  style={{
                    background: COLOR_HEX[color] || '#ccc',
                    borderColor: 'var(--brand-border)',
                  }}
                />
                <span className="text-[10px] text-muted-foreground capitalize">{color}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly activity */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-5">
          This week
        </h2>
        <div className="flex gap-3">
          {weekDays.map(({ label, isToday, hasOutfit }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  background: isToday
                    ? 'var(--brand-black)'
                    : hasOutfit
                    ? 'var(--brand-accent)'
                    : 'var(--brand-stone)',
                }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: isToday ? 'var(--brand-black)' : 'var(--brand-muted)' }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent outfits */}
      {outfits.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Recent outfits
            </h2>
            <Link
              to="/outfits"
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--brand-muted)' }}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {recentOutfits.map((o) => (
              <div
                key={o._id}
                className="flex items-center gap-3 px-4 py-3 rounded-[14px] border"
                style={{ borderColor: 'var(--brand-border)' }}
              >
                {o.snapshotUrl && (
                  <img src={o.snapshotUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{o.name}</p>
                  <p className="text-xs text-muted-foreground">
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
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Style profile
          </h2>
          <Link
            to="/profile"
            className="text-xs"
            style={{ color: 'var(--brand-muted)' }}
          >
            Edit
          </Link>
        </div>
        {styleVibes.length === 0 && favColors.length === 0 && occasions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No preferences set yet.{' '}
            <Link to="/profile" className="underline" style={{ color: 'var(--brand-black)' }}>
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
          <p className="text-xs text-muted-foreground mt-4">
            Never worn:{' '}
            {neverWorn.map((i) => i.name).join(', ')}
            {wardrobe.filter((i) => !allWornIds.has(i._id)).length > 2 &&
              ` +${wardrobe.filter((i) => !allWornIds.has(i._id)).length - 2} more`}
          </p>
        )}
      </div>

      {/* Recommendation teaser */}
      <div>
        <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground mb-4">
          Today's suggestion
        </h2>
        {recLoading ? (
          <div className="rounded-[14px] border p-5" style={{ borderColor: 'var(--brand-border)' }}>
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-3 w-48 mb-2" />
            <Skeleton className="h-3 w-40" />
          </div>
        ) : rec && rec.outfits?.length > 0 ? (
          <div
            className="rounded-[14px] border p-5"
            style={{ borderColor: 'var(--brand-border)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <CloudSun className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {rec.weather} · {rec.location}
              </span>
            </div>
            <p className="text-sm font-medium mb-1">
              {rec.outfits[0].items?.map((i) => i.name).join(', ') || 'Outfit suggestion'}
            </p>
            {rec.outfits[0].note && (
              <p className="text-xs text-muted-foreground mb-3">{rec.outfits[0].note}</p>
            )}
            <Button asChild size="sm" variant="secondary">
              <Link to="/recommendations">
                See all suggestions <ArrowRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        ) : (
          <div
            className="rounded-[14px] border p-5"
            style={{ borderColor: 'var(--brand-border)' }}
          >
            <p className="text-sm text-muted-foreground mb-3">
              Add items to your wardrobe to get daily outfit suggestions.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/closet">Go to Closet</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
