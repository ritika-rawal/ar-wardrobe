const PALETTE = [
  { name: 'black',  r:  20, g:  20, b:  20 },
  { name: 'white',  r: 240, g: 240, b: 240 },
  { name: 'grey',   r: 150, g: 150, b: 150 },
  { name: 'navy',   r:  20, g:  30, b: 100 },
  { name: 'blue',   r:  50, g: 100, b: 210 },
  { name: 'red',    r: 200, g:  30, b:  30 },
  { name: 'green',  r:  40, g: 140, b:  60 },
  { name: 'yellow', r: 230, g: 210, b:  40 },
  { name: 'orange', r: 230, g: 110, b:  30 },
  { name: 'pink',   r: 220, g: 110, b: 150 },
  { name: 'purple', r: 120, g:  50, b: 170 },
  { name: 'brown',  r: 120, g:  70, b:  30 },
  { name: 'beige',  r: 210, g: 190, b: 160 },
];

function nearest(r, g, b) {
  let best = PALETTE[0], bestDist = Infinity;
  for (const c of PALETTE) {
    const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best.name;
}

// Returns a named color string (e.g. "navy") for the dominant visible colour in
// a transparent-PNG blob.  Reads only non-transparent pixels (alpha > 30).
export async function getDominantColor(blob) {
  const bitmap = await createImageBitmap(blob);
  const SIZE = 80; // downscale for speed
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = Math.round((bitmap.height / bitmap.width) * SIZE) || SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let rSum = 0, gSum = 0, bSum = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 30) {
      rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
      count++;
    }
  }
  if (!count) return 'black';
  return nearest(rSum / count, gSum / count, bSum / count);
}
