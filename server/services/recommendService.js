function warmthRangeForTemp(tempC) {
  if (tempC < 5) return { min: 5, max: 5, needsOuterwear: true, label: 'very cold' };
  if (tempC < 12) return { min: 4, max: 5, needsOuterwear: true, label: 'cold' };
  if (tempC < 18) return { min: 3, max: 4, needsOuterwear: false, label: 'cool' };
  if (tempC < 25) return { min: 2, max: 3, needsOuterwear: false, label: 'mild' };
  return { min: 1, max: 2, needsOuterwear: false, label: 'hot' };
}

function currentSeason() {
  const month = new Date().getMonth();
  if (month <= 1 || month === 11) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}

function scoreItem(item, preferences = {}, occasion = '') {
  let score = 0;
  const color = (item.color || '').toLowerCase();
  const favorites = (preferences.favoriteColors || []).map((c) => c.toLowerCase());
  const avoided = (preferences.avoidColors || []).map((c) => c.toLowerCase());

  if (favorites.includes(color)) score += 2;
  if (avoided.includes(color)) score -= 3;

  const styles = [
    ...(preferences.styles || []),
    ...(preferences.styleVibes || []),
  ].map((s) => s.toLowerCase());
  const tags = [...(item.tags || []), ...(item.styleTags || [])].map((t) => t.toLowerCase());
  if (styles.some((s) => tags.includes(s))) score += 1;

  // Soft occasion boost
  if (occasion) {
    const catBoost = {
      formal: ['top', 'bottom', 'outerwear'],
      outdoor: ['outerwear', 'shoes'],
      work: ['top', 'bottom'],
      gym: ['top', 'bottom', 'shoes'],
    };
    if (catBoost[occasion]?.includes(item.category)) score += 1;
  }

  return score;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickBest(items, n = 1) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => b._score - a._score);
  const topScore = sorted[0]._score;
  const topTier = sorted.filter((i) => i._score >= topScore);
  const rest = sorted.filter((i) => i._score < topScore);
  return [...shuffle(topTier), ...shuffle(rest)].slice(0, n);
}

function stripScore(item) {
  const { _score, ...rest } = item;
  return rest;
}

function buildOutfits({ pool, wantOuterwear, note, count }) {
  const byCategory = (cat) => pool.filter((i) => i.category === cat);
  const tops = pickBest(byCategory('top'), count);
  const bottoms = pickBest(byCategory('bottom'), count);
  const outerwear = pickBest(byCategory('outerwear'), count);
  const shoes = pickBest(byCategory('shoes'), count);

  const outfits = [];

  for (let i = 0; i < count; i++) {
    const top = tops[i] || tops[0] || null;
    const bottom = bottoms[i] || bottoms[0] || null;

    // Need at least one core piece
    if (!top && !bottom) break;

    const chosenOuter = wantOuterwear ? outerwear[i] || outerwear[0] || null : null;
    const chosenShoes = shoes[i] || shoes[0] || null;

    const items = [top, bottom, chosenOuter, chosenShoes].filter(Boolean).map(stripScore);
    outfits.push({ items, note, why: note });

    // Stop early if no more variety
    if (!tops[i + 1] && !bottoms[i + 1] && i > 0) break;
  }

  // Fallback: if nothing was built (e.g. only shoes in wardrobe), return top single item
  if (outfits.length === 0 && pool.length > 0) {
    const best = pickBest(pool, 1).map(stripScore);
    outfits.push({ items: best, note, why: note });
  }

  return outfits;
}

export function recommendOutfits({ wardrobe, weather, preferences, occasion = '' }, count = 3) {
  const { min, max, needsOuterwear, label } = warmthRangeForTemp(weather.tempC);
  const season = currentSeason();

  const inSeason = (item) => item.seasons.length === 0 || item.seasons.includes(season);
  const inWarmth = (item) => item.warmth >= min - 1 && item.warmth <= max + 1;
  const wantOuterwear = needsOuterwear || weather.isRainy || weather.isWindy || occasion === 'outdoor';

  function addScores(items) {
    return items.map((item) => ({ ...item, _score: scoreItem(item, preferences, occasion) }));
  }

  // Tier 1: weather + warmth + preferences
  const tier1Pool = addScores(wardrobe.filter((i) => inSeason(i) && inWarmth(i)));
  let outfits = buildOutfits({
    pool: tier1Pool,
    wantOuterwear,
    note: `Matched to today's ${label} weather (${Math.round(weather.tempC)}°C) and your style`,
    count,
  });
  if (outfits.length > 0) {
    return { weatherSummary: { ...weather, season, warmthBand: label }, outfits, usedFallback: false };
  }

  // Tier 2: weather + warmth, ignore preferences
  const tier2Pool = addScores(wardrobe.filter((i) => inWarmth(i)));
  outfits = buildOutfits({
    pool: tier2Pool,
    wantOuterwear,
    note: `Matched to today's ${label} weather (${Math.round(weather.tempC)}°C)`,
    count,
  });
  if (outfits.length > 0) {
    return { weatherSummary: { ...weather, season, warmthBand: label }, outfits, usedFallback: true };
  }

  // Tier 3: warmth-only (ignores season)
  const tier3Pool = addScores(wardrobe.filter((i) => inWarmth(i)));
  outfits = buildOutfits({
    pool: tier3Pool.length ? tier3Pool : addScores(wardrobe),
    wantOuterwear,
    note: 'Your best picks for the temperature',
    count,
  });
  if (outfits.length > 0) {
    return { weatherSummary: { ...weather, season, warmthBand: label }, outfits, usedFallback: true };
  }

  // Tier 4: any items, most recently added
  const tier4Pool = addScores([...wardrobe].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  outfits = buildOutfits({
    pool: tier4Pool,
    wantOuterwear: false,
    note: 'Based on your wardrobe',
    count,
  });
  return { weatherSummary: { ...weather, season, warmthBand: label }, outfits, usedFallback: true };
}
