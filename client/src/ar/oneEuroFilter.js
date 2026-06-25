// One Euro Filter (Casiez et al. 2012) — velocity-adaptive smoothing: heavy smoothing when the
// signal is nearly still (kills jitter), light smoothing when it moves fast (kills lag).
// Reference: https://cristal.univ-lille.fr/~casiez/1euro/

function smoothingFactor(te, cutoff) {
  const r = 2 * Math.PI * cutoff * te;
  return r / (r + 1);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

class LowPassFilter {
  reset() {
    this.initialized = false;
  }

  filter(x, alpha) {
    if (!this.initialized) {
      this.y = x;
      this.initialized = true;
    } else {
      this.y = lerp(this.y, x, alpha);
    }
    return this.y;
  }
}

// Smooths a single scalar value over time.
export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.xFilter = new LowPassFilter();
    this.dxFilter = new LowPassFilter();
    this.lastTime = null;
  }

  reset() {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }

  filter(x, timestampMs) {
    if (this.lastTime === null) {
      this.lastTime = timestampMs;
      this.xFilter.filter(x, 1);
      this.dxFilter.filter(0, 1);
      return x;
    }

    const te = Math.max((timestampMs - this.lastTime) / 1000, 1e-3);
    this.lastTime = timestampMs;

    const dx = (x - this.xFilter.y) / te;
    const edx = this.dxFilter.filter(dx, smoothingFactor(te, this.dCutoff));

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(x, smoothingFactor(te, cutoff));
  }
}

// Applies a One-Euro filter to each x/y coordinate of a fixed set of tracked landmarks.
// minCutoff/beta tuned for normalized (0..1) pose-landmark coordinates: low minCutoff keeps a
// stationary garment steady; beta lets fast motion cut through the smoothing instead of lagging.
export class LandmarkOneEuro {
  constructor(count, { minCutoff = 0.5, beta = 8.0, dCutoff = 1.0 } = {}) {
    this.filters = Array.from({ length: count }, () => ({
      x: new OneEuroFilter({ minCutoff, beta, dCutoff }),
      y: new OneEuroFilter({ minCutoff, beta, dCutoff }),
    }));
  }

  // landmarks: array of {x, y, ...} or null. Returns smoothed landmarks, or null if tracking is
  // lost (and resets the filters so the next acquired pose snaps in rather than sliding from stale state).
  filter(landmarks, timestampMs) {
    if (!landmarks) {
      this.reset();
      return null;
    }
    return landmarks.map((lm, i) => {
      const f = this.filters[i];
      if (!f) return lm;
      return {
        ...lm,
        x: f.x.filter(lm.x, timestampMs),
        y: f.y.filter(lm.y, timestampMs),
      };
    });
  }

  reset() {
    for (const f of this.filters) {
      f.x.reset();
      f.y.reset();
    }
  }
}
