# Progress Tracker — AR Virtual Wardrobe FYP

Living checklist. Update after each meaningful change. Plan reference: `~/.claude/plans/developing-an-ar-powered-virtual-purring-crane.md`.

## Status: Phase 7 (shadcn/ui + Lucide icon system) complete — polish pass in progress (areas 2-5 pending)

### Done
- [x] Project scaffold: `server/` (Express) + `client/` (React + Vite + Tailwind)
- [x] DB layer (`server/db.js`): connects to `MONGO_URI` if set, else auto-starts an **in-memory MongoDB** (zero install). Verified both boot paths.
- [x] Auth: register / login / `/me` / preferences, JWT + bcrypt (`server/routes/auth.js`, `server/models/User.js`). Verified via curl.
- [x] Wardrobe CRUD + image upload via multer (`server/routes/wardrobe.js`, `server/models/ClothingItem.js`). Verified: uploaded 2 real test images, listed, served via `/uploads`.
- [x] Weather (Open-Meteo, no key) + rule-based recommendation engine (`server/services/weatherService.js`, `server/services/recommendService.js`, `server/routes/recommend.js`). Verified: live weather for Karachi/London, outfit built matching hot-weather rule.
- [x] Frontend: AuthContext, protected routes, Navbar, Login/Register/Home pages. Verified via Vite dev-server module transform check (no syntax/import errors) and `npm run build`.
- [x] Frontend: Closet page (upload form + grid + category filter), ClothingCard, UploadForm.
- [x] Frontend: AR try-on page — MediaPipe PoseLandmarker (`client/src/ar/poseTracker.js`), garment overlay renderer anchored to shoulders/hips (`client/src/ar/garmentRenderer.js`), `WebcamAR` component with live canvas overlay + snapshot.
- [x] Frontend: Recommendations page (geolocation or city input → weather + outfit cards → link into Try-On) and Profile page (style/color preferences).
- [x] Full stack smoke-tested together: client (5173) ↔ server (5000) via Vite proxy, register → upload → recommend flow confirmed end-to-end via curl.
- [x] Background removal wired into upload flow: `client/src/ar/backgroundRemoval.js` wraps `@imgly/background-removal` (runs client-side, WASM, no API key). `Closet.jsx` uploads the item normally, then fires off the cutout in the background and PATCHes it to a new endpoint `POST /api/wardrobe/:id/try-on-asset` (`server/routes/wardrobe.js`), which sets `tryOnAssetUrl`. `ClothingCard` shows a "✨ Preparing AR cutout..." badge while processing and "AR ready" once done. New endpoint verified via curl (upload → attach asset → confirmed `tryOnAssetUrl` persisted).

### Phase 2 — enhancement pass (this session)
- [x] **A. AR bug fixes** (`client/src/components/WebcamAR.jsx`, `client/src/ar/poseTracker.js`): fixed a real bug where selecting/deselecting a garment restarted the webcam (now held in refs, camera effect runs once); added GPU→CPU delegate fallback in `getPoseLandmarker()`; added a monotonic timestamp guard for `detectForVideo`; added an on-canvas "Step fully into frame" hint when no pose is detected.
- [x] **B. AR fit-adjust sliders**: `garmentRenderer.js`'s `drawGarment`/`renderGarments` now accept a `fit: { scale, yOffset }` param; `TryOn.jsx` exposes size/vertical-position sliders that thread through `WebcamAR` via refs (no camera restart on drag).
- [x] **C. Save Outfits**: new `server/routes/outfits.js` (`GET/POST /api/outfits`, `DELETE /api/outfits/:id`, registered in `server/index.js`) wires up the previously-unused `Outfit` model. `TryOn.jsx` has "💾 Save this look" (snapshot + itemIds), `Recommendations.jsx` has "💾 Save outfit" per suggestion (itemIds only, no snapshot), new `Outfits.jsx` page ("My Outfits") lists/deletes saved looks. All verified via curl (create with/without snapshot, list with populated items, delete).
- [x] **D. Demo seed data**: 8 hand-authored transparent SVG garments in `server/assets/` (served via `/assets` static route), `server/services/seedData.js#seedIfEmpty()` auto-creates a `demo@demo.com` / `demo1234` account with a full AR-ready wardrobe **only when the DB has zero users** — verified idempotent (no re-seed/duplication on restart) and isolated from newly-registered users (confirmed empty closet for a 2nd registered user). Removed the dangling `npm run seed` script (pointed at a nonexistent `seed.js`) since seeding is now automatic on boot.
- [x] **E. Richer closet**: new `EditItemModal.jsx` wired to the existing `PUT /wardrobe/:id` route; season + color filters added to the Closet UI (the route already supported these params — just exposed them). Found and fixed a real bug while wiring this up: the color filter was an exact case-sensitive string match, which would silently return zero results for "Blue" vs seeded "blue" — now a case-insensitive regex match (with input escaped against regex injection). Verified via curl: season filter, case-insensitive color filter, edit/PUT persistence.
- [x] **F. Heavy polish pass**: new `ToastContext.jsx` (success/error/info toasts) wired into `main.jsx`, replacing ad-hoc inline status text across Closet/TryOn/Outfits/Recommendations/Profile; `CardGridSkeleton.jsx` loading skeleton on Closet/TryOn/Outfits; dashboard stat chips on Closet (total/AR-ready/category counts); responsive `Navbar.jsx` with a mobile hamburger menu; nicer `Home.jsx` landing page with feature cards; `WebcamAR` container is now responsive (`w-full max-w-[640px] aspect-[4/3]`) instead of a fixed 640px box.
- [x] Final verification: full fresh-boot smoke test through the Vite proxy — demo login, wardrobe list (8 seeded items), recommendations (Tokyo, 3 outfits), save outfit, list outfits, edit item, season+color filter, asset serving — all passed. All 19 client source files confirmed to transform cleanly via the Vite dev server; production build (`npm run build`) passes.

### Phase 3 — AR core polish + mobile-first pass (this session)
- [x] **A. Camera UX fix (the real bug)**: `WebcamAR.jsx` previously called `getUserMedia` with no
  `facingMode`, so phones opened the **rear** camera for try-on. Now defaults to `facingMode: 'user'`
  (front/selfie), adds a "🔄 Flip camera" button that swaps the stream in place (old stream only
  stopped after the new one succeeds, so a failed flip — e.g. no rear camera — doesn't kill the
  working feed; reverts `facingMode` state on failure), and only mirrors (`-scale-x-100`) the video
  + canvas when on the front camera. Snapshot capture now bakes in the same mirroring the user saw.
  Added distinct error messages for blocked permission (`NotAllowedError`), no camera
  (`NotFoundError`), and insecure context (no `navigator.mediaDevices` → needs https/localhost).
- [x] **B. Performance**: pose detection decoupled from the 60fps render loop — `detectPose` now
  runs on a throttled ~24fps cadence while the canvas still redraws every animation frame using the
  last known (smoothed) landmarks, so it doesn't look like it's running at low fps. Canvas
  resolution is capped at 720px wide (scaled proportionally) instead of matching full video
  resolution (was up to 1080p+ on modern phones), and the canvas is only resized when dimensions
  actually change instead of every frame. Added a loading-spinner overlay while the model/webcam
  initialize instead of a blank black box.
- [x] **C. Fit/overlay quality**: `poseTracker.js#smoothLandmarks()` applies exponential-moving-
  average smoothing across frames to kill the pose-lite jitter (snaps immediately on fresh
  tracking acquisition instead of sliding in). `garmentRenderer.js` now has a per-category
  `LAYER_CONFIG` (top/outerwear/bottom) for width multiplier and vertical anchor — outerwear runs
  slightly wider/higher-collared than tops, and **bottoms now size off hip width** instead of
  shoulder width for a more natural waist fit (previously all layers used shoulder width).
- [x] **D. Try-on mobile UX** (`TryOn.jsx`): snapshot-save row stacks vertically on mobile
  (`flex-col sm:flex-row`) instead of a cramped `whitespace-nowrap` button fighting an input;
  snapshot preview is full-width on mobile; added a row of removable "selected garment" chips
  directly under the camera so users can swap garments without scrolling down to the closet grid;
  snapshot/flip buttons are ≥44px touch targets.
- [x] **E. Mobile-first sweep of remaining pages**: `index.html` theme-color/apple-mobile-web-app
  meta tags; `Closet.jsx` color filter input no longer has a fixed `w-36` that overflowed at
  375px (now `w-full sm:w-36`), filter row stacks on mobile; `Recommendations.jsx` location/city
  form stacks vertically on mobile with a properly-sized city input, outfit action
  links/buttons stack and get real tap targets; `Outfits.jsx` item text bumped from `text-xs` to
  `text-sm`, delete is a real tappable button; `ClothingCard.jsx` Edit/Delete tap targets enlarged
  to ≥36px with `text-sm`; `UploadForm.jsx` season checkboxes wrap instead of overflowing;
  `Home.jsx` login/register buttons stack on mobile.
- [x] Verified `npm run build` passes after every change, and confirmed via the compiled CSS that
  all dynamic/arbitrary Tailwind classes (mirror toggle, spinner, `min-h-[44px]` touch targets)
  actually got generated (not silently dropped by the JIT scanner).

### Phase 4 — deep AR refinement (this session)
- [x] **WebGL perspective warp** (`client/src/ar/webglRenderer.js`, new): garments are no longer a
  rigid rotate+scale rectangle. A projective homography (`client/src/ar/homography.js`, new —
  quad-to-quad mapping via unit-square basis composition, no dependency) maps 4 correspondence
  points inside the garment image onto 4 live body landmarks, so the garment shears/forshortens
  with torso lean and twist. Rendered as a textured quad with manual perspective-correct UV
  interpolation (the standard "divide texcoord by w in the fragment shader" trick, since GPU
  triangle rasterization only does affine interpolation natively).
- [x] **Always-on segmentation occlusion**: `poseTracker.js` now requests
  `outputSegmentationMasks: true`; the fragment shader multiplies garment alpha by the live
  person-mask (sampled in screen space), so clothing is clipped to the body silhouette instead of
  floating over/behind it. **Resource note:** `PoseLandmarkerResult` holds WASM/GPU-backed mask
  memory that leaks if not freed — `detectPose()` now copies the mask's pixel data out to a plain
  `Float32Array` and calls `result.close()` immediately, every detection tick.
- [x] **One-Euro smoothing** (`client/src/ar/oneEuroFilter.js`, new) replaces the old fixed-alpha
  EMA: velocity-adaptive, so the overlay stays steady when you're still and keeps up without lag
  when you move. Resets (snaps, doesn't slide in) when tracking is freshly reacquired.
- [x] **Per-category destination quads** (`client/src/ar/garmentAnchors.js`, new, shared by both
  renderers): tops/outerwear drape shoulders→hips; **bottoms now drape hips→knees** instead of
  reusing shoulder width (pants have nothing to do with shoulders). Since a typical desk webcam
  frames chest-up and knees are usually out of shot, bottoms fall back to **extrapolating** a
  knee-equivalent point by continuing the shoulder→hip line further down, so pants/skirts still
  render instead of silently disappearing.
- [x] **2D fallback kept and upgraded, not dropped**: `garmentRenderer.js` no longer uses the old
  hardcoded width-multiplier heuristics — it now derives the same translate+rotate+scale from the
  *same* shared anchor correspondence points as the WebGL path (proven algebraically: the two
  anchor points it solves for land exactly on their landmarks), so a browser without WebGL falls
  back to a visually-consistent (if non-perspective) overlay instead of a different-looking one.
  `WebcamAR.jsx` feature-detects WebGL via try/catch at mount and switches paths automatically.
- [x] **Portrait-adaptive AR stage** (`WebcamAR.jsx`): the fixed `4:3` box is gone — the stage now
  reads the live stream's actual `videoWidth/videoHeight` (phones in portrait often report a
  taller-than-wide stream) and sets `aspectRatio` via inline style, capped at `max-h-[75vh]` so an
  extreme portrait stream can't push controls off-screen on a small viewport.
- [x] Verified `npm run build` passes (116 modules, up from 112) and confirmed via the compiled
  CSS that the new arbitrary Tailwind value (`max-h-[75vh]`) compiled correctly.

### Phase 5 — body-wrapping mesh renderer + real garment assets (this session)
- [x] **Subdivided mesh warp** (`client/src/ar/webglRenderer.js`, major rewrite): upgraded from a
  single 4-point quad to a **16×10 vertex grid** (~270 triangles). Each vertex still starts from
  the projective homography baseline so overall placement/lean/twist is preserved, but the outer
  columns of every row are then blended 75% toward the **live body silhouette** (left/right edge
  of the segmentation mask at that row height), so the garment hugs the actual body width instead
  of being a rigid trapezoid. Falls back to homography position for rows where the mask has no
  body pixel.
- [x] **Cylindrical depth shading**: per-vertex shade factor `0.55 + 0.45·sin(u·π)` baked into a
  static `Float32Array` at init time (never re-computed), passed as `a_shade` attribute; fragment
  shader multiplies `gl_FragColor.rgb` by it — darker at the left/right edges, bright at center —
  faking roundness so the garment reads as draped on a 3D torso rather than a flat sticker. UV
  remapped via `asin` cylinder formula so texture doesn't stretch at the edges.
- [x] **Dual-canvas architecture** (`WebcamAR.jsx`): fixed a permanent context-lock bug — once a
  `<canvas>` element gets a WebGL context (even if setup later fails), `getContext('2d')` on that
  same element permanently returns `null`. Solution: `glCanvasRef` (WebGL-only) and
  `fallback2DCanvasRef` (always 2D) are two entirely separate DOM elements; only the active one
  is shown via CSS `hidden`; a third `debugCanvasRef` overlays pose-landmark dots. The WebGL
  renderer failing can never break the 2D fallback path.
- [x] **Occlusion debug toggle**: "👤 Occlusion: on/off" button (visible when debug markers are
  shown) toggles a `u_occlusion` uniform in the fragment shader between 0 and 1 — lets you
  isolate whether a rendering artifact is from the mesh placement or from the mask.
- [x] **Renderer info banner**: status line shows "Renderer: WebGL (perspective warp + occlusion)"
  or "Renderer: 2D fallback — WebGL init failed: …" so it's immediately visible which path the
  browser took.
- [x] **Real transparent PNG seed garments** (`server/assets/*.png`, new): replaced 8 hand-drawn
  cartoon SVGs with properly-proportioned flat-lay RGBA PNGs generated by
  `server/scripts/generate-seed-pngs.js` (uses `sharp` for SVG→PNG rasterisation). Each PNG is
  designed with the category's garment-anchor proportions built in (shoulder seams at the exact
  pixel coords expected by `garmentAnchors.js`), so no per-item anchor calibration is needed.
  Fixes a latent WebGL texture issue: SVG elements used as `texImage2D` sources can taint the
  canvas or report `naturalWidth=0` in some browsers — real PNGs are the correct source.
- [x] Verified `npm run build` still passes at 116 modules after all Phase 5 changes.

### Phase 6 — real garment photos + AR precision + camera capture (this session)
- [x] **Real flat-lay garment photos** (`server/assets/*.png`): replaced all illustrated SVG-generated
  PNGs with real clothing photographs. Pipeline: `server/scripts/download-real-garments.mjs` downloads
  Unsplash flat-lays; `server/scripts/process-user-garments.mjs` accepts user-supplied photos; both
  run **adaptive BFS flood-fill** background removal (corner-sample to detect BG colour, flood-expand
  from border with 45-unit per-channel tolerance, `sharp` trim+contain to 512×768 canvas). User
  supplied 5 real product photos: navy/white/black t-shirts + blue/black jeans — all background-
  removed and AR-ready. Seed trimmed to these 5 items; hoodie/jacket/sneaker assets deleted.
- [x] **WebGL shader fix**: vertex shader was missing `precision mediump float;` declaration, causing
  the program link to fail ("Precisions of uniform `u_resolution` differ") and forcing the 2D fallback
  on all devices. Fixed — WebGL mesh path now active by default.
- [x] **Garment anchor recalibration** (`client/src/ar/garmentAnchors.js`): `LAYER_IMAGE_ANCHORS`
  re-tuned for real flat-lay proportions (garment centred in canvas, ~25% transparent padding top and
  bottom). Shoulder anchors moved from `y=0.08` → `y=0.30`; hip anchors from `y=0.72` → `y=0.65`.
- [x] **Neck anchor / collar ceiling** (`garmentAnchors.js` + `webglRenderer.js`): garment collar was
  riding up over the neck and face because the homography extrapolated image rows above the shoulder
  landmarks onto the chin. Fixed with `getCollarCeilingY()`: derives a ceiling as
  `shoulderMidY − 0.18 × shoulderWidth` (landmark-driven, scales with camera distance), then clamps
  every mesh vertex's Y to `max(y, ceiling)` in `buildMesh`. Only applied to `top`/`outerwear`.
- [x] **Elbow/wrist sleeve bending** (`webglRenderer.js`): `getArmPoints()` in `garmentAnchors.js`
  returns shoulder/elbow/wrist screen positions (gated on `visibility > 0.35`). In `buildMesh`, outer
  sleeve columns (top half of mesh) are offset toward the shoulder→elbow direction, blended by
  proximity to the corner × row height × raise-factor (`-ny`, how far the arm is raised from down).
  Direction refined with elbow→wrist vector when available. Offset clamped to 35% of shoulder width
  to prevent noise flings; absent/low-vis landmarks fall back to pure homography.
- [x] **Camera garment capture** (`client/src/components/GarmentCapture.jsx`, new): "📷 Capture from
  camera" button on the Closet page opens a modal with its own lightweight webcam (no pose model).
  Flow: **live feed → tap Capture → BFS BG removal via `@imgly/background-removal` → checkerboard
  preview → name/category/color form → save**. Color is **auto-detected** by `getDominantColor()`
  (`client/src/ar/dominantColor.js`, new) — averages non-transparent pixels, maps mean RGB to a
  13-entry named palette. Cutout is saved as both `imageUrl` and `tryOnAssetUrl` (single upload,
  no second removal pass) — item lands in closet **immediately AR-ready**.
- [x] Verified `npm run build` passes (118 modules) after all Phase 6 changes.

### Phase 7 — shadcn/ui + Lucide icon system (this session, Area 1 of 5)
- [x] **Foundation**: installed `lucide-react`, `sonner`, `clsx`, `tailwind-merge`, `cva`,
  `tailwindcss-animate`, all Radix UI packages. Added `@` path alias in `vite.config.js` +
  `jsconfig.json`. Created `components.json` and `src/lib/utils.js` (`cn()`).
- [x] **CSS variables + theme**: rewrote `src/index.css` with full shadcn `:root`/`.dark` variable
  block (slate base). Updated `tailwind.config.js` to map `theme.extend.colors` to
  `hsl(var(--…))` variables, added `tailwindcss-animate` plugin and `darkMode: ['class']`.
- [x] **shadcn primitives**: created `src/components/ui/`: `button`, `card`, `badge`, `dialog`,
  `select`, `slider`, `skeleton`, `separator`, `checkbox`, `input`, `label`, `sonner` (12 files).
- [x] **Toast → Sonner adapter**: replaced the custom `ToastContext.jsx` timeout/portal
  implementation with a thin Sonner wrapper — `ToastProvider` now mounts `<Toaster richColors />`
  and `useToast()` returns `{ success, error, info }` mapped to Sonner calls. All 6 caller files
  (`Closet`, `TryOn`, `Recommendations`, `Profile`, `Outfits`, `GarmentCapture`) unchanged.
- [x] **Component migrations**: `ClothingCard` → `<Card>` + `<Badge>` + `<Button variant="ghost"
  size="icon">`; `UploadForm` → `<Input>/<Select>/<Checkbox>/<Slider>/<Button>`; `EditItemModal`
  → `<Dialog>` replacing the hand-rolled fixed overlay; `Navbar` → `<Button asChild><Link>` +
  `<Separator>`; `CardGridSkeleton` → shadcn `<Skeleton>`; `TryOn` fit sliders → `<Slider>` +
  `<Card>`.
- [x] **Emoji → Lucide**: replaced all 18 emoji icon usages across 7 files: `Shirt`, `Camera`,
  `Sparkles`, `Pencil`, `Trash2`, `Menu`, `X`, `Save`, `Check`, `MapPin`, `CloudRain`, `Wind`,
  `CloudSun`, `Loader2`, `RefreshCw`, `Bug`, `User`, `Plus`. Frozen AR pipeline files untouched.
- [x] Build passes at 1955 modules (up from 118). `npm run build` clean (chunk-size warning is
  expected — Radix UI adds weight; no functional issue).

### Known limitations (by design, for the few-day timeline)
- **Perf tradeoff (untested on a real device yet):** always-on segmentation + WebGL perspective is
  the heaviest the app has been on the GPU. Mitigated by the existing ~24fps pose-detection
  throttle and modest mask resolution, and there's an automatic WebGL→2D fallback — but actual
  frame rate on a low-end phone hasn't been measured, since no browser/device is available in this
  environment. This is the top thing to check in the manual phone test pass.
- The mask's pixel-row orientation (top-row-first, matching MediaPipe's landmark `y` convention)
  is inferred from consistency with the rest of MediaPipe's coordinate system, not verified against
  a real rendered frame — if occlusion looks inverted (garment visible only where the body *isn't*)
  during testing, flip the `1.0 - screenUV.y` in `webglRenderer.js`'s fragment shader.
- AR try-on is **keypoint-anchored perspective garment overlay with silhouette occlusion** — a big step up from a flat sticker, but still not physical cloth simulation (no fabric drape/folds) — see plan's "Reality check on AR" section.
- MediaPipe model/wasm assets load from a public CDN on first run (cached after) — this is the one part of the app that needs internet beyond the weather call. Fully offline demo would need self-hosting those assets (not done — out of scope for now).
- All browser-only behavior — AR overlay visuals (now including the WebGL perspective warp and segmentation occlusion), fit sliders, the flip-camera/mirroring logic, One-Euro smoothing, GPU→CPU pose-model fallback, background-removal cutout quality — **has not been tested in a real browser or on a real phone**. No browser-automation tool is available in this environment, so verification so far is: production build passes (including a check that all dynamic/arbitrary Tailwind classes actually compiled), every source file transforms cleanly via Vite, and all backend routes are verified via curl. The actual visual/interactive behavior needs the user's manual test — see "Next up" below.
- Auth is intentionally bare-minimum: no email verification, no refresh tokens, no password reset.
- No automated test suite yet — verification so far is manual curl + Vite module-transform checks (no browser automation tool available in this environment).

### Next up (polish pass — 4 areas remaining)
- [ ] **Area 2 — Wardrobe management UX**: name search, filter pills (replace dropdowns), multi-
  select + bulk delete, empty state.
- [ ] **Area 3 — Camera capture improvements**: framing guide overlay, tips panel, auto-capture
  with stability detection, brightness/blur quality hints.
- [ ] **Area 4 — Recommendations improvements**: auto-load on mount via geolocation/IP fallback,
  occasion filter pills, re-roll button with outfit shuffle, "mark as worn" flow.
- [ ] **Area 5 — General polish**: onboarding Dialog (3-step, first login only), PWA manifest +
  minimal service worker, React ErrorBoundary, AR snapshot share button, 404 page.
- [ ] **Manual browser test**: confirm shadcn components render correctly (cards, badges, dialogs,
  sliders, sonner toasts), no layout regressions vs pre-migration.

## How to run locally
```bash
# Terminal 1 — backend (auto-starts in-memory MongoDB, no install needed)
cd virtual-wardrobe/server
npm install
npm run dev          # http://localhost:5000

# Terminal 2 — frontend
cd virtual-wardrobe/client
npm install
npm run dev          # http://localhost:5173 (proxies /api to :5000)
```
Open http://localhost:5173 and either register a new account, or log in with the auto-seeded demo
account: **demo@demo.com / demo1234** (has a full AR-ready wardrobe already — no upload needed).

To use a real/persistent MongoDB instead of the in-memory default, set `MONGO_URI` in `server/.env` (see `server/.env.example`).
