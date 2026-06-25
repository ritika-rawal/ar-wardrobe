import { removeBackground } from '@imgly/background-removal';

// Runs entirely in-browser (WASM), no API key, no server round-trip.
// First call downloads the model from a CDN (cached after) - same tradeoff as the MediaPipe pose model.
export async function cutOutGarment(file) {
  return removeBackground(file);
}
