/**
 * Generates realistic flat-lay garment PNGs for the demo seed wardrobe.
 * Run: node server/scripts/generate-seed-pngs.js
 *
 * Anchor proportions (garmentAnchors.js) drive the layout of every garment so
 * the AR homography lands correctly without retuning per-item.
 *
 * Top category:  LS=(0.80,0.08), RS=(0.20,0.08), LH=(0.72,0.72), RH=(0.28,0.72)
 * Outerwear:     LS=(0.85,0.06), RS=(0.15,0.06), LH=(0.78,0.82), RH=(0.22,0.82)
 * Bottom:        LH=(0.78,0.06), RH=(0.22,0.06), LK=(0.70,0.92), RK=(0.30,0.92)
 * All on a 512×768 canvas.
 */

import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'assets');
mkdirSync(OUT, { recursive: true });

const W = 512, H = 768;

// ── Gradient helpers ──────────────────────────────────────────────────────

function hGrad(id, light, mid, dark) {
  return `<linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%"   stop-color="${dark}"/>
    <stop offset="28%"  stop-color="${mid}"/>
    <stop offset="50%"  stop-color="${light}"/>
    <stop offset="72%"  stop-color="${mid}"/>
    <stop offset="100%" stop-color="${dark}"/>
  </linearGradient>`;
}

function vGrad(id, top, bot) {
  return `<linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%"   stop-color="${top}"/>
    <stop offset="100%" stop-color="${bot}"/>
  </linearGradient>`;
}

function wrap(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
}

// ── T-SHIRT ────────────────────────────────────────────────────────────────
// Top anchors in px: RS=(102,61) LS=(410,61) RH=(143,553) LH=(369,553)
// Sleeve ends at ~y=190; armhole at ~y=160; collar ellipse cx=256 cy=52 rx=70 ry=30

function makeTshirt(light, mid, dark) {
  return wrap(`<defs>
    ${hGrad('fg', light, mid, dark)}
  </defs>
  <!-- body + sleeves, evenodd punches collar hole transparent -->
  <path fill-rule="evenodd" fill="url(#fg)" d="
    M 183,28
    C 202,14 230,6 256,6 C 282,6 310,14 329,28
    L 410,61
    C 440,32 476,28 504,54
    L 503,180
    C 492,206 468,212 446,200
    C 430,190 413,170 410,154
    L 369,554
    L 143,554
    L 102,154
    C 99,170 82,190 66,200
    C 44,212 20,206 9,180
    L 8,54
    C 36,28 72,32 102,61
    Z
    M 186,52 C 186,22 326,22 326,52 C 326,82 186,82 186,52 Z
  "/>
  <!-- collar rib ring -->
  <ellipse cx="256" cy="52" rx="70" ry="30"
           fill="none" stroke="${dark}" stroke-width="5" opacity="0.7"/>
  <!-- shoulder seam lines -->
  <line x1="183" y1="28" x2="102" y2="61" stroke="${dark}" stroke-width="1.5" opacity="0.35"/>
  <line x1="329" y1="28" x2="410" y2="61" stroke="${dark}" stroke-width="1.5" opacity="0.35"/>
  <!-- side seams -->
  <line x1="102" y1="154" x2="143" y2="554" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
  <line x1="410" y1="154" x2="369" y2="554" stroke="${dark}" stroke-width="1.5" opacity="0.3"/>
  <!-- hem -->
  <line x1="143" y1="554" x2="369" y2="554" stroke="${dark}" stroke-width="3" opacity="0.45"/>
  <!-- sleeve hems -->
  <path d="M 9,180 C 22,204 52,210 76,198" fill="none" stroke="${dark}" stroke-width="3" opacity="0.45"/>
  <path d="M 503,180 C 490,204 460,210 436,198" fill="none" stroke="${dark}" stroke-width="3" opacity="0.45"/>
  `);
}

// ── HOODIE ─────────────────────────────────────────────────────────────────
// Outerwear anchors: RS=(77,46) LS=(435,46) RH=(113,630) LH=(399,630)
// Long sleeves reach ~y=680; hood bulge behind collar

function makeHoodie(light, mid, dark) {
  return wrap(`<defs>
    ${hGrad('hg', light, mid, dark)}
    ${vGrad('hd', dark + 'cc', dark + '00')}
  </defs>
  <!-- hood silhouette (behind everything) -->
  <ellipse cx="256" cy="52" rx="120" ry="110"
           fill="${mid}" opacity="0.9"/>
  <!-- hood inner shadow -->
  <ellipse cx="256" cy="70" rx="78" ry="65"
           fill="${dark}" opacity="0.75"/>
  <!-- main body + long sleeves, evenodd punches neck-opening transparent -->
  <path fill-rule="evenodd" fill="url(#hg)" d="
    M 196,52
    C 214,38 238,32 256,32 C 274,32 298,38 316,52
    L 435,46
    C 460,18 494,14 512,44
    L 512,670
    C 500,688 480,694 460,682
    C 444,672 436,654 435,638
    L 399,632
    L 113,632
    L 77,638
    C 76,654 68,672 52,682
    C 32,694 12,688 0,670
    L 0,44
    C 18,14 52,18 77,46
    Z
    M 192,72 C 192,46 320,46 320,72 C 320,98 192,98 192,72 Z
  "/>
  <!-- hem cuff band -->
  <rect x="105" y="622" width="302" height="20" rx="6"
        fill="${dark}" fill-opacity="0.35"/>
  <!-- sleeve cuffs -->
  <rect x="0"   y="660" width="74"  height="24" rx="8" fill="${dark}" fill-opacity="0.35"/>
  <rect x="438" y="660" width="74"  height="24" rx="8" fill="${dark}" fill-opacity="0.35"/>
  <!-- kangaroo pocket -->
  <path d="M 178,435 Q 178,522 256,522 Q 334,522 334,435
           C 334,424 318,416 304,416 L 208,416
           C 194,416 178,424 178,435 Z"
        fill="${dark}" fill-opacity="0.22"/>
  <path d="M 178,435 Q 178,522 256,522 Q 334,522 334,435"
        fill="none" stroke="${dark}" stroke-width="2" opacity="0.5"/>
  <!-- center seam / zip pull -->
  <line x1="256" y1="98" x2="256" y2="630" stroke="${dark}"
        stroke-width="1.5" stroke-dasharray="6,5" opacity="0.25"/>
  <!-- drawstrings -->
  <line x1="220" y1="98" x2="205" y2="416" stroke="${dark}"
        stroke-width="2" stroke-linecap="round" opacity="0.4"/>
  <line x1="292" y1="98" x2="307" y2="416" stroke="${dark}"
        stroke-width="2" stroke-linecap="round" opacity="0.4"/>
  <!-- drawstring tips -->
  <circle cx="203" cy="420" r="5" fill="${dark}" opacity="0.5"/>
  <circle cx="309" cy="420" r="5" fill="${dark}" opacity="0.5"/>
  `);
}

// ── JACKET ─────────────────────────────────────────────────────────────────
// Outerwear anchors: RS=(77,46) LS=(435,46) RH=(113,630) LH=(399,630)

function makeJacket(light, mid, dark) {
  return wrap(`<defs>
    ${hGrad('jg', light, mid, dark)}
  </defs>
  <!-- Main body + long sleeves -->
  <path fill="url(#jg)" d="
    M 77,46
    C 52,18 18,14 0,44
    L 0,670
    C 12,688 32,694 52,682
    C 68,672 76,654 77,638
    L 77,200
    L 113,200
    L 113,630
    L 256,630
    L 399,630
    L 399,200
    L 435,200
    L 435,638
    C 436,654 444,672 460,682
    C 480,694 500,688 512,670
    L 512,44
    C 494,14 460,18 435,46
    L 316,46
    C 298,30 278,22 256,22
    C 234,22 214,30 196,46
    Z
  "/>
  <!-- Right lapel -->
  <path fill="${mid}" d="
    M 196,46 C 214,30 234,22 256,22
    L 248,290 L 175,200 L 113,200 L 113,46 Z
  "/>
  <!-- Left lapel -->
  <path fill="${mid}" d="
    M 316,46 C 298,30 278,22 256,22
    L 264,290 L 337,200 L 399,200 L 399,46 Z
  "/>
  <!-- Lapel shading -->
  <path fill="${dark}" fill-opacity="0.2" d="
    M 196,46 C 214,30 234,22 256,22 L 248,290 L 175,200 L 113,200 L 113,46 Z
  "/>
  <path fill="${dark}" fill-opacity="0.2" d="
    M 316,46 C 298,30 278,22 256,22 L 264,290 L 337,200 L 399,200 L 399,46 Z
  "/>
  <!-- Lapel collar seam -->
  <path d="M 113,200 L 175,200 L 248,290 L 256,630" fill="none" stroke="${dark}" stroke-width="2" opacity="0.5"/>
  <path d="M 399,200 L 337,200 L 264,290 L 256,630" fill="none" stroke="${dark}" stroke-width="2" opacity="0.5"/>
  <!-- Pocket flaps -->
  <rect x="118" y="390" width="110" height="28" rx="4" fill="${dark}" fill-opacity="0.25"/>
  <rect x="284" y="390" width="110" height="28" rx="4" fill="${dark}" fill-opacity="0.25"/>
  <!-- Buttons -->
  <circle cx="248" cy="312" r="8" fill="${dark}" opacity="0.7"/>
  <circle cx="248" cy="368" r="8" fill="${dark}" opacity="0.7"/>
  <circle cx="248" cy="424" r="8" fill="${dark}" opacity="0.7"/>
  <circle cx="248" cy="480" r="8" fill="${dark}" opacity="0.7"/>
  <circle cx="248" cy="536" r="8" fill="${dark}" opacity="0.7"/>
  <!-- Buttonholes -->
  <circle cx="248" cy="312" r="4" fill="${light}" opacity="0.4"/>
  <circle cx="248" cy="368" r="4" fill="${light}" opacity="0.4"/>
  <circle cx="248" cy="424" r="4" fill="${light}" opacity="0.4"/>
  <circle cx="248" cy="480" r="4" fill="${light}" opacity="0.4"/>
  <circle cx="248" cy="536" r="4" fill="${light}" opacity="0.4"/>
  <!-- Hem & cuffs -->
  <line x1="113" y1="630" x2="399" y2="630" stroke="${dark}" stroke-width="3" opacity="0.4"/>
  <rect x="0"   y="660" width="78"  height="22" rx="6" fill="${dark}" fill-opacity="0.3"/>
  <rect x="434" y="660" width="78"  height="22" rx="6" fill="${dark}" fill-opacity="0.3"/>
  `);
}

// ── JEANS ──────────────────────────────────────────────────────────────────
// Bottom anchors: LH=(399,46) RH=(113,46) LK=(358,707) RK=(154,707)
// Crotch at y≈235; left leg outer→inner; right leg outer→inner

function makeJeans(light, mid, dark) {
  return wrap(`<defs>
    ${hGrad('dg', light, mid, dark)}
    <pattern id="denim" x="0" y="0" width="6" height="6" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="6" y2="6" stroke="${dark}" stroke-width="0.6" stroke-opacity="0.18"/>
    </pattern>
  </defs>
  <!-- Waistband -->
  <rect x="80" y="4" width="352" height="50" rx="5" fill="${dark}"/>
  <rect x="80" y="4" width="352" height="50" rx="5" fill="url(#denim)"/>
  <!-- Belt loops -->
  <rect x="118" y="2"  width="18" height="30" rx="3" fill="${dark}" fill-opacity="0.6"/>
  <rect x="200" y="2"  width="18" height="30" rx="3" fill="${dark}" fill-opacity="0.6"/>
  <rect x="294" y="2"  width="18" height="30" rx="3" fill="${dark}" fill-opacity="0.6"/>
  <rect x="376" y="2"  width="18" height="30" rx="3" fill="${dark}" fill-opacity="0.6"/>
  <!-- Pants body: one continuous path clockwise -->
  <path fill="url(#dg)" d="
    M 84,50
    L 84,235
    C 84,240 90,255 95,260
    C 95,260 88,710 90,712
    L 228,712
    C 228,712 234,265 232,258
    C 250,268 262,268 280,258
    C 278,265 284,712 284,712
    L 422,712
    C 424,710 418,260 418,260
    C 423,255 428,240 428,235
    L 428,50
    Z
  "/>
  <!-- Denim texture overlay -->
  <path fill="url(#denim)" d="
    M 84,50 L 84,235 C 84,240 90,255 95,260
    C 95,260 88,710 90,712 L 228,712
    C 228,712 234,265 232,258 C 250,268 262,268 280,258
    C 278,265 284,712 284,712 L 422,712
    C 424,710 418,260 418,260 C 423,255 428,240 428,235
    L 428,50 Z
  "/>
  <!-- Center fly seam -->
  <line x1="256" y1="50" x2="256" y2="258" stroke="${dark}" stroke-width="2" opacity="0.5"/>
  <!-- Fly buttons -->
  <circle cx="256" cy="70"  r="5" fill="${dark}" opacity="0.6"/>
  <circle cx="256" cy="90"  r="5" fill="${dark}" opacity="0.6"/>
  <circle cx="256" cy="110" r="5" fill="${dark}" opacity="0.5"/>
  <!-- Crotch seam curve -->
  <path d="M 95,260 C 145,280 175,290 232,258" fill="none" stroke="${dark}" stroke-width="2" opacity="0.45"/>
  <path d="M 418,260 C 368,280 338,290 280,258" fill="none" stroke="${dark}" stroke-width="2" opacity="0.45"/>
  <!-- Outer leg seams -->
  <line x1="84"  y1="50" x2="90"  y2="712" stroke="${dark}" stroke-width="2" opacity="0.35"/>
  <line x1="428" y1="50" x2="422" y2="712" stroke="${dark}" stroke-width="2" opacity="0.35"/>
  <!-- Hem lines -->
  <line x1="90"  y1="712" x2="228" y2="712" stroke="${dark}" stroke-width="3" opacity="0.5"/>
  <line x1="284" y1="712" x2="422" y2="712" stroke="${dark}" stroke-width="3" opacity="0.5"/>
  <!-- Front pockets (stitching arc) -->
  <path d="M 118,55 C 130,120 140,155 150,175" fill="none" stroke="${light}" stroke-width="1.5" opacity="0.5"/>
  <path d="M 394,55 C 382,120 372,155 362,175" fill="none" stroke="${light}" stroke-width="1.5" opacity="0.5"/>
  `);
}

// ── SHORTS ─────────────────────────────────────────────────────────────────
// Bottom anchors but legs end around y=420 (well above knee anchor at 707)

function makeShorts(light, mid, dark) {
  return wrap(`<defs>
    ${hGrad('sg', light, mid, dark)}
  </defs>
  <!-- Waistband with drawstring -->
  <rect x="86" y="4" width="340" height="48" rx="5" fill="${dark}" fill-opacity="0.8"/>
  <!-- Drawstring -->
  <line x1="194" y1="28" x2="156" y2="52" stroke="${light}" stroke-width="2" opacity="0.7"/>
  <line x1="318" y1="28" x2="356" y2="52" stroke="${light}" stroke-width="2" opacity="0.7"/>
  <circle cx="152" cy="53" r="5" fill="${light}" opacity="0.7"/>
  <circle cx="360" cy="53" r="5" fill="${light}" opacity="0.7"/>
  <!-- Shorts body -->
  <path fill="url(#sg)" d="
    M 88,50
    L 88,230
    C 88,238 96,252 102,258
    C 100,260 96,400 98,405
    L 226,405
    C 228,404 224,264 222,258
    C 240,270 272,270 290,258
    C 288,264 284,404 286,405
    L 414,405
    C 416,400 412,260 410,258
    C 416,252 424,238 424,230
    L 424,50
    Z
  "/>
  <!-- Center seam -->
  <line x1="256" y1="50" x2="256" y2="258" stroke="${dark}" stroke-width="2" opacity="0.4"/>
  <!-- Crotch curve -->
  <path d="M 102,258 C 160,278 190,286 222,258" fill="none" stroke="${dark}" stroke-width="2" opacity="0.4"/>
  <path d="M 410,258 C 352,278 322,286 290,258" fill="none" stroke="${dark}" stroke-width="2" opacity="0.4"/>
  <!-- Outer seams -->
  <line x1="88"  y1="50" x2="98"  y2="405" stroke="${dark}" stroke-width="2" opacity="0.3"/>
  <line x1="424" y1="50" x2="414" y2="405" stroke="${dark}" stroke-width="2" opacity="0.3"/>
  <!-- Leg hems -->
  <line x1="98"  y1="405" x2="226" y2="405" stroke="${dark}" stroke-width="3" opacity="0.45"/>
  <line x1="286" y1="405" x2="414" y2="405" stroke="${dark}" stroke-width="3" opacity="0.45"/>
  <!-- Side pockets -->
  <path d="M 120,80 L 116,190 L 162,190 L 158,80" fill="${dark}" fill-opacity="0.15"
        stroke="${dark}" stroke-width="1.5" stroke-opacity="0.35"/>
  <path d="M 392,80 L 396,190 L 350,190 L 354,80" fill="${dark}" fill-opacity="0.15"
        stroke="${dark}" stroke-width="1.5" stroke-opacity="0.35"/>
  `);
}

// ── SNEAKERS ───────────────────────────────────────────────────────────────
// No AR anchors — used for display only. Pair of shoes, side-on view.

function makeSneakers(light, mid, dark, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 400" width="512" height="400">
  <defs>
    ${hGrad('shg', light, mid, dark)}
    <linearGradient id="sole" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
  </defs>
  <!-- Left shoe -->
  <g transform="translate(30,30)">
    <!-- Sole -->
    <path d="M 10,310 C 10,330 30,340 60,340 L 180,340 C 210,340 225,330 220,315
             L 215,300 L 15,300 Z"
          fill="url(#sole)" stroke="#94a3b8" stroke-width="1.5"/>
    <!-- Upper body -->
    <path d="M 15,300 C 10,270 8,230 10,200 C 12,170 20,150 40,135
             C 60,120 90,115 115,115 L 160,115
             C 185,115 205,125 215,145 L 220,200 L 220,300 Z"
          fill="url(#shg)" stroke="${dark}" stroke-width="1.5"/>
    <!-- Toe cap -->
    <path d="M 10,200 C 8,170 12,145 30,130 C 48,118 68,115 88,115
             C 60,118 40,135 35,155 C 30,175 28,200 30,220 Z"
          fill="${mid}" opacity="0.6"/>
    <!-- Laces area -->
    <rect x="80" y="120" width="120" height="100" rx="5"
          fill="${light}" fill-opacity="0.4" stroke="${dark}" stroke-width="1" stroke-opacity="0.3"/>
    <!-- Laces -->
    <line x1="85"  y1="138" x2="195" y2="130" stroke="${accent}" stroke-width="2.5"/>
    <line x1="85"  y1="155" x2="195" y2="148" stroke="${accent}" stroke-width="2.5"/>
    <line x1="85"  y1="172" x2="195" y2="166" stroke="${accent}" stroke-width="2.5"/>
    <line x1="85"  y1="189" x2="195" y2="184" stroke="${accent}" stroke-width="2.5"/>
    <!-- Eyelets -->
    <circle cx="88"  cy="138" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="88"  cy="155" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="88"  cy="172" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="88"  cy="189" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="192" cy="130" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="192" cy="148" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="192" cy="166" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="192" cy="184" r="4" fill="${dark}" opacity="0.5"/>
    <!-- Brand swoosh hint -->
    <path d="M 30,200 C 50,195 80,190 110,200 C 130,208 145,210 160,205"
          fill="none" stroke="${accent}" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
  </g>
  <!-- Right shoe (mirror) -->
  <g transform="translate(482,30) scale(-1,1)">
    <path d="M 10,310 C 10,330 30,340 60,340 L 180,340 C 210,340 225,330 220,315
             L 215,300 L 15,300 Z"
          fill="url(#sole)" stroke="#94a3b8" stroke-width="1.5"/>
    <path d="M 15,300 C 10,270 8,230 10,200 C 12,170 20,150 40,135
             C 60,120 90,115 115,115 L 160,115
             C 185,115 205,125 215,145 L 220,200 L 220,300 Z"
          fill="url(#shg)" stroke="${dark}" stroke-width="1.5"/>
    <path d="M 10,200 C 8,170 12,145 30,130 C 48,118 68,115 88,115
             C 60,118 40,135 35,155 C 30,175 28,200 30,220 Z"
          fill="${mid}" opacity="0.6"/>
    <rect x="80" y="120" width="120" height="100" rx="5"
          fill="${light}" fill-opacity="0.4" stroke="${dark}" stroke-width="1" stroke-opacity="0.3"/>
    <line x1="85"  y1="138" x2="195" y2="130" stroke="${accent}" stroke-width="2.5"/>
    <line x1="85"  y1="155" x2="195" y2="148" stroke="${accent}" stroke-width="2.5"/>
    <line x1="85"  y1="172" x2="195" y2="166" stroke="${accent}" stroke-width="2.5"/>
    <line x1="85"  y1="189" x2="195" y2="184" stroke="${accent}" stroke-width="2.5"/>
    <circle cx="88"  cy="138" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="88"  cy="155" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="88"  cy="172" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="88"  cy="189" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="192" cy="130" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="192" cy="148" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="192" cy="166" r="4" fill="${dark}" opacity="0.5"/>
    <circle cx="192" cy="184" r="4" fill="${dark}" opacity="0.5"/>
    <path d="M 30,200 C 50,195 80,190 110,200 C 130,208 145,210 160,205"
          fill="none" stroke="${accent}" stroke-width="3.5" stroke-linecap="round" opacity="0.7"/>
  </g>
  </svg>`;
}

// ── Build all garments ─────────────────────────────────────────────────────

const GARMENTS = [
  {
    name: 'tshirt-blue',
    svgFn: () => makeTshirt('#60a5fa', '#3b82f6', '#1d4ed8'),
  },
  {
    name: 'tshirt-white',
    svgFn: () => makeTshirt('#ffffff', '#f1f5f9', '#94a3b8'),
  },
  {
    name: 'tshirt-black',
    svgFn: () => makeTshirt('#4b5563', '#374151', '#111827'),
  },
  {
    name: 'hoodie-grey',
    svgFn: () => makeHoodie('#d1d5db', '#9ca3af', '#4b5563'),
  },
  {
    name: 'jacket-black',
    svgFn: () => makeJacket('#334155', '#1e293b', '#0f172a'),
  },
  {
    name: 'jeans-blue',
    svgFn: () => makeJeans('#60a5fa', '#2563eb', '#1e3a8a'),
  },
  {
    name: 'shorts-grey',
    svgFn: () => makeShorts('#9ca3af', '#6b7280', '#374151'),
  },
  {
    name: 'shoes-white',
    svgFn: () => makeSneakers('#f8fafc', '#e2e8f0', '#64748b', '#94a3b8'),
  },
];

for (const { name, svgFn } of GARMENTS) {
  const svgStr = svgFn();
  const outPath = resolve(OUT, `${name}.png`);
  await sharp(Buffer.from(svgStr)).png().toFile(outPath);
  console.log(`  ✓ ${name}.png`);
}

console.log(`\nAll ${GARMENTS.length} garments generated in ${OUT}`);
