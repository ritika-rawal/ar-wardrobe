// Simple rule-based outfit recommendation engine.

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

function scoreItem(item, preferences = {}) {
  let score = 0;
  const color = (item.color || '').toLowerCase();
  const favorites = (preferences.favoriteColors || []).map((c) => c.toLowerCase());
  const avoided = (preferences.avoidColors || []).map((c) => c.toLowerCase());

  if (favorites.includes(color)) score += 2;
  if (avoided.includes(color)) score -= 3;

  const styles = (preferences.styles || []).map((s) => s.toLowerCase());
  const tags = (item.tags || []).map((t) => t.toLowerCase());
  if (styles.some((s) => tags.includes(s))) score += 1;

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

// Pick top-n items by score, with a shuffle pass before slicing so re-rolls differ.
function pickBest(items, n = 1) {
  const sorted = [...items].sort((a, b) => b._score - a._score);
  // Separate items with the same score range (top third) and shuffle within that group
  // so each re-roll can surface different equally-good items.
  const topScore = sorted[0]?._score ?? 0;
  const topTier = sorted.filter((i) => i._score >= topScore);
  const rest = sorted.filter((i) => i._score < topScore);
  return [...shuffle(topTier), ...shuffle(rest)].slice(0, n);
}

function applyOccasionFilter(items, occasion) {
  if (!occasion) return items;
  if (occasion === 'formal') {
    // Exclude shoes and accessories; keep structured pieces
    return items.filter((i) => i.category === 'top' || i.category === 'bottom' || i.category === 'outerwear');
  }
  if (occasion === 'outdoor') {
    // Boost outerwear by treating it as required — handled in outfit builder, no filter here
    return items;
  }
  // 'casual' / 'work': no hard exclusion, scoring handles preferences
  return items;
}

export function recommendOutfits({ wardrobe, weather, preferences, occasion = '' }, count = 3) {
  const { min, max, needsOuterwear, label } = warmthRangeForTemp(weather.tempC);
  const season = currentSeason();

  const inSeasonOrUnspecified = (item) => item.seasons.length === 0 || item.seasons.includes(season);
  const warmEnough = (item) => item.warmth >= min - 1 && item.warmth <= max + 1;

  const scored = wardrobe
    .filter((item) => inSeasonOrUnspecified(item) && warmEnough(item))
    .map((item) => ({ ...item, _score: scoreItem(item, preferences) }));

  const occasionFiltered = applyOccasionFilter(scored, occasion);

  const byCategory = (cat) => occasionFiltered.filter((i) => i.category === cat);

  const tops = pickBest(byCategory('top'), count);
  const bottoms = pickBest(byCategory('bottom'), count);
  const outerwear = pickBest(byCategory('outerwear'), count);
  // Shoes/accessories excluded for formal; included for others
  const shoes = occasion === 'formal' ? [] : pickBest(byCategory('shoes'), count);

  const wantOuterwear = needsOuterwear || weather.isRainy || weather.isWindy || occasion === 'outdoor';

  const outfits = [];
  for (let i = 0; i < count; i++) {
    const top = tops[i] || tops[0];
    const bottom = bottoms[i] || bottoms[0];
    if (!top || !bottom) break;

    const chosenOuter = wantOuterwear ? outerwear[i] || outerwear[0] : null;
    const chosenShoes = shoes[i] || shoes[0] || null;

    const items = [top, bottom, chosenOuter, chosenShoes].filter(Boolean);
    const reasons = [];
    reasons.push(`Matches today's ${label} weather (${Math.round(weather.tempC)}°C)`);
    if (wantOuterwear && chosenOuter) reasons.push('Added outerwear for warmth/wind/rain protection');
    if (weather.isRainy) reasons.push('Rain expected');
    if (occasion) reasons.push(`Occasion: ${occasion}`);
    if (items.some((it) => it._score > 0)) reasons.push('Includes your preferred colors/styles');

    outfits.push({
      items: items.map(({ _score, ...rest }) => rest),
      why: reasons.join('. '),
    });

    if (!tops[i + 1] && !bottoms[i + 1]) break;
  }

  return {
    weatherSummary: { ...weather, season, warmthBand: label },
    outfits,
  };
}
