# Progress Tracker — AR Virtual Wardrobe FYP

Living checklist. Update after each meaningful change. Plan reference: `~/.claude/plans/developing-an-ar-powered-virtual-purring-crane.md`.

## Status: Phase 9 complete — fashion-brand redesign (Areas 0–6)

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

### Phase 8 — major polish pass (Areas 2–5, this session)
- [x] **Area 2 — Wardrobe management UX** (`Closet.jsx`, `ClothingCard.jsx`): name search input
  (debounced, `<Search />` icon adornment, client-side filter on server results); category +
  season filter pills (`<Badge>` toggles replacing raw `<select>` dropdowns), color text input
  with `<Palette />` adornment, "Filters active" secondary badge; multi-select mode (Select button
  toggles; per-card `<Checkbox>` in top-left corner); floating bulk-action bar ("N selected ·
  Delete · Clear") with `Promise.all` bulk delete + single success toast; richer empty state
  (`<Upload />` icon, CTA button with smooth-scroll to upload form).
- [x] **Area 3 — Camera capture improvements** (`GarmentCapture.jsx`, full rewrite): canvas
  framing guide overlay (`absolute inset-0`, RAF loop, rounded rect + L-corner markers, pulses
  green when stable); collapsible tips panel (`<ChevronDown />` toggle, 4 tips); auto-capture with
  2-second brightness-histogram stability detection + 3-2-1 countdown overlay drawn on canvas;
  brightness/blur quality hint row (`<Sun />` / `<Crosshair />`, throttled to 500ms); auto-capture
  on/off toggle (`<Zap />` / `<ZapOff />`); manual Capture always available.
- [x] **Area 4 — Recommendations improvements**: auto-load on mount (geolocation → `ipapi.co`
  IP fallback); occasion filter pills (Any/Casual/Work/Formal/Outdoor), passed as `?occasion=` to
  the recommend route; re-roll button (`<RefreshCw />`, re-fetches with same `lastParams` ref);
  Fisher-Yates shuffle in `recommendService.js` so re-rolls surface different items; "Mark as worn
  today" button (`<CheckCheck />`) after saving an outfit → `POST /api/outfits/:id/worn` endpoint;
  `worn` + `wornAt` fields on `Outfit` model; "Worn on [date]" `<Badge>` in `Outfits.jsx`
  (migrated to shadcn Cards + Badge + Button + Lucide icons).
- [x] **Area 5 — General polish**: `onboardingComplete: Boolean` on `User` model + `toSafeJSON()`
  + `PATCH /auth/onboarding` endpoint; `OnboardingDialog.jsx` (3-step, non-dismissable, first
  login only, mounted in `App.jsx`); `ErrorBoundary.jsx` (class component) wrapping the router in
  `main.jsx`; `client/public/manifest.json` + `client/public/sw.js` (app-shell cache, install +
  activate + navigate handler); `<link rel="manifest">` + SW registration in `index.html`; AR
  snapshot Share button (`navigator.share({ files })` → download fallback); `NotFound.jsx` 404
  page + `<Route path="*">` catch-all in `App.jsx`.
- [x] All 4 areas build-verified (`npm run build` passes clean after each commit).

### Phase 9 — fashion-brand redesign (Areas 0–6, this session)
- [x] **Area 0 — Global design language**: `client/src/styles/tokens.css` brand palette
  (`--brand-black`, `--brand-white #fafaf8`, `--brand-stone`, `--brand-muted`, `--brand-accent`,
  `--brand-border`), radii, fonts, `@keyframes sheet-up`. Inter 400/500/600 via Google Fonts in
  `index.html`. `index.css` retuned: warm off-white `--background`, near-black `--primary`, Inter
  on body, heading weight/tracking, `a { color: inherit }`. `main.jsx` imports `tokens.css` first.
  `Navbar.jsx` full redesign: sticky white bar + `backdrop-blur`, 1px border, all-caps tracked
  wordmark "VIRTUAL WARDROBE" (no icon), desktop plain-text muted links with underline-active,
  mobile hamburger → bottom sheet (overlay `bg-black/40 backdrop-blur-sm`, slide-up animation,
  large tap targets). Dashboard and Lookbook nav entries included.
- [x] **Area 1 — Bug-fix + consistency pass**: dialog backdrop `bg-black/80` → `bg-black/40
  backdrop-blur-sm` in `dialog.jsx`; same change in `GarmentCapture.jsx` backdrop. `Profile.jsx`
  full shadcn migration (Input/Label/Card/Button, loading state, error handling). `Home.jsx`
  redirects logged-in users to `/dashboard`, stripped indigo accents, cleaned marketing copy.
  `App.jsx` wrapper changed from `bg-slate-100` to `bg-background`.
- [x] **Area 2 — Dashboard page** (`Dashboard.jsx`, new): greeting + date; 4 stat chips (total
  items, added this week, outfits saved, AR-ready); category bars (proportional, thin); top-5
  colour dots with hex lookup; 7-day weekly strip (Mon–Sun, today = black dot, outfit days =
  accent dot); 3 recent outfits as chips; style profile summary (styleVibes/favoriteColors/
  occasions as badges + never-worn items); recommendation teaser (geolocation → IP fallback, shows
  first outfit or nudge). `/dashboard` protected route added to `App.jsx`. `Home.jsx` redirects
  to it when logged in.
- [x] **Area 3 — AI auto-tagging** (`server/services/autoTagService.js`, new): no-op when
  `OPENAI_API_KEY` absent (uses native `fetch`, no npm package needed); otherwise calls
  `gpt-4o-mini` vision with JSON prompt → parses color/category/warmth/style_tags. `ClothingItem`
  model: `autoTagged: Boolean`, `styleTags: [String]`. `POST /api/wardrobe/:id/auto-tag` route
  added. `Closet.jsx` fires `processAutoTag(itemId)` after upload, updates item in state.
  `GarmentCapture.jsx` fires auto-tag fire-and-forget after save. `ClothingCard.jsx` shows `Wand2`
  icon when `autoTagged`, renders `styleTags` as secondary badges. Closet stat chips de-indigo-ified.
- [x] **Area 4 — Tiered fallback recommendations**: `recommendService.js` fully rewritten with 4
  tiers (weather+warmth+prefs → weather+warmth → warmth-only → any items). Outfits now need ≥1
  item (no longer require top+bottom pair). Each outfit carries a `note` field. Occasion applied as
  soft score boost, not hard filter. `usedFallback` boolean returned; route adds `nudge` field when
  true. `Recommendations.jsx`: nudge banner with `<Info />` + `var(--brand-stone)` bg; skeleton
  card loading state (3 cards × 3 item slots) replacing the "Fetching…" text.
- [x] **Area 5 — 5-step onboarding quiz** (`OnboardingQuiz.jsx`, new): animated progress dots;
  step 1 Welcome; step 2 style vibes multi-select pills (≤3); step 3 colour palette swatches (≤5,
  12 colours); step 4 occasions multi-select; step 5 Done with 3 feature cards + navigate to
  `/closet`. Steps 2–4 have Skip. `User` model: `preferencesSchema` extended with `styleVibes`
  and `occasions`. `PUT /auth/me/preferences` now merges all 5 pref fields without overwriting.
  `OnboardingDialog.jsx` replaced by `OnboardingQuiz.jsx` in `App.jsx`.
- [x] **Area 6 — Lookbook** (`Lookbook.js` model, `lookbook.js` route, `Lookbook.jsx` page, new):
  server model `{ userId, outfitId ref Outfit, caption }`. Routes: `GET/POST/DELETE /api/lookbook`
  (registered in `index.js`). Client: masonry via `columns-2 md:columns-3`, filter pills (All/
  Casual/Formal/This week), pin cards with hover `×` unpin, tap → bottom sheet with full outfit
  detail + "Try on in AR" link. Empty state with serif italic text. `Outfits.jsx`: "Pin to
  lookbook" `<BookMarked />` button per outfit → `POST /api/lookbook`.
- [x] All 7 areas build-verified with `npm run build` after each commit.

### Phase 10 — AR core robustness (Tier 1, this session)
- [x] **Per-garment anchor auto-detection** (`client/src/ar/garmentAnchorDetect.js`, new): the WebGL/2D
  renderers map 4 "image anchor" points (where the garment's shoulders/hips sit *inside its image*)
  onto body landmarks. `LAYER_IMAGE_ANCHORS` only lined up for the seed flat-lay PNGs, so *uploaded*
  or *camera-captured* garments (garment anywhere in frame, any scale) were misaligned — the weakest
  part of the core feature. Now `detectGarmentAnchors(blob, category)` scans the cutout's alpha
  bounding box (128px downscale) and remaps the calibrated template anchors into it, fixing
  off-centre / wrong-padding / wrong-scale uploads while preserving the hand-tuned shoulder/hip inset
  ratios. Persisted as `imageAnchors` on `ClothingItem`; `resolveImageAnchors(item, layer)` in
  `garmentAnchors.js` consumes it (falls back to template anchors when absent). Wired into both upload
  paths (`Closet.jsx#processBackgroundRemoval`, `GarmentCapture.jsx#handleSave`). Server:
  `imageAnchors` schema field + `sanitizeAnchors()` validation on the try-on-asset (multipart JSON)
  and PUT routes. Verified end-to-end via curl (anchors persist; malformed 3-point input rejected).
- [x] **Temporal mask smoothing** (`webglRenderer.js`): the raw segmentation mask edge wobbles
  frame-to-frame, making the silhouette-conform jitter the garment edges. Added an EMA (`MASK_SMOOTH
  = 0.5`) over the mask; the smoothed buffer feeds both the GPU occlusion texture and the CPU
  silhouette-edge search in one pass (no extra per-frame cost vs the old upload loop), so occlusion
  and conform stay consistent and steady.
- [x] **Visibility-gated stable quads** (`garmentAnchors.js`): `getDestQuadPx` now gates landmarks on
  MediaPipe `visibility` (`VIS_THRESHOLD = 0.5`) instead of anchoring to noisy/garbage points. Tops
  gate shoulders strictly but **synthesize a hip line** one torso-length below the shoulders when
  hips are low-confidence/off-frame (common chest-up desk framing) so the garment doesn't disappear.
  New `getStableDestQuad` adds 500ms hysteresis — a single dropped/occluded frame reuses the last
  good quad instead of flickering the garment out. Both renderers switched to it.
- [x] Build-verified: `npm run build` passes (1960 modules).

### Phase 11 — AR performance & reach (Tier 2, this session)
- [x] **Adaptive pose-model tier** (`client/src/ar/poseTracker.js`): `getPoseLandmarker(tier)` now
  caches a landmarker per tier and serves `full` (accurate) or `lite` (~3MB, faster on weak devices).
  `pickDefaultTier()` heuristic (mobile UA / `hardwareConcurrency ≤ 4` / `deviceMemory ≤ 4` → `lite`).
  Both tiers still emit segmentation masks. Model/WASM URLs are now env-overridable
  (`VITE_MEDIAPIPE_WASM_BASE`, `VITE_POSE_MODEL_FULL`, `VITE_POSE_MODEL_LITE`) for self-hosting an
  offline demo — documented in new `client/.env.example`.
- [x] **In-app Quality control + perf HUD** (`WebcamAR.jsx`): Auto/High/Fast segmented control wired
  to the tier; the model-load effect re-keys on tier and idles the loop on the last frame while the
  new tier resolves ("Switching quality…" overlay). Live FPS chip (top-left, during tracking) +
  debug line shows model tier and pose-detect latency (ms). Counters live in refs; state publishes
  on a ~500ms cadence so the 60fps loop never triggers a re-render.
- [x] **Mask upload micro-opt** (`webglRenderer.js`): the per-new-mask EMA blend and the
  Float32→Uint8 byte-pack are now a single pass over the mask (was two) in the steady-state path.
- [x] Build-verified: `npm run build` passes.

### Phase 12 — AR differentiators (Tier 3, this session)
- [x] **Per-category auto-fit** (`garmentAnchors.js`): `getAutoFit(layer)` + `combineFit(auto, user)`
  apply a sensible per-category baseline (tops 1.16×/+0.04y, outerwear 1.26×/+0.02y, bottoms
  1.10×/+0.05y) *before* the user's fit sliders, so a freshly-selected garment drapes naturally
  (real clothes sit wider than the joint centres and hang below the hip line) without anyone touching
  the controls. Both renderers compose it with the slider value. Heuristic constants — user can still
  adjust around them.
- [x] **Arm-in-front occlusion** (`garmentAnchors.js#getOcclusionCapsules`, `webglRenderer.js`
  shader): uses MediaPipe per-landmark `z` (depth) to detect upper-arm/forearm segments in front of
  the torso, passes them to the fragment shader as up to 4 capsules (segment + radius), which carves
  them out of the garment alpha (soft-edged) so the real arm shows through when you cross it over your
  chest. The binary person-mask can't do this (it only separates person from background). Gated by the
  same `u_occlusion` debug toggle.
- [x] **Short clip recording** (`WebcamAR.jsx`): "Record clip" composites live video + garment overlay
  onto an offscreen canvas, captures via `captureStream` + `MediaRecorder` for 4s with a REC countdown
  overlay, then shares (`navigator.share` with the file) or downloads the `.webm`. Mirroring matches
  what the user sees; button hidden when `MediaRecorder`/`captureStream` unsupported; recording torn
  down on unmount. (Forward clip, not a true boomerang — see README limitations.)
- [x] Build-verified: `npm run build` passes.

### Phase 13 — AR realism + calibration from manual-test feedback (this session)
- [x] **Calibration from real-device feedback**: default `AUTO_FIT` scales reduced (top 1.16→1.02,
  outerwear 1.26→1.12, bottom 1.10→1.00) — garments were too large by default. Body occlusion now
  **off by default** (steadier overlay) with a first-class "Body occlusion: on/off" toolbar toggle
  (was hidden behind debug). Occlusion artifacts reduced when on: mask EMA 0.5→0.35, fragment
  `smoothstep(0.35,0.65)` on the mask edge, silhouette blend 0.75→0.55.
- [x] **Garment relighting** (`webglRenderer.js` + `WebcamAR.jsx`): a 32×24 downscaled video sample
  each pose tick gives an average scene RGB; the fragment shader nudges the garment toward the room's
  colour cast (`CAST_STRENGTH`) and brightness (`EXPOSURE_STRENGTH`) so it stops looking pasted on.
  Neutral grey fallback = no change; tainted-canvas guard skips it safely.
- [x] **Contact shadow + edge feather**: a second offset draw pass renders a flat dark silhouette
  (`SHADOW_ALPHA`) under each garment to ground it on the body; the garment's semi-transparent rim is
  eroded (`smoothstep` on alpha) to kill the die-cut look.
- [x] **Procedural fold relief**: the shader amplifies the garment photo's own luminance contrast
  (`FOLD_STRENGTH`) so existing folds/seams read as fabric depth — no per-garment maps needed.
- [x] **Lookbook redesigned as a mood board** (`Lookbook.jsx`): denser 2/3/4-col collage, full-bleed
  imagery with gradient caption overlays, occasion tags, hover zoom, serif editorial header — visually
  distinct from the Outfits list.
- [x] **Bugfix**: `Dashboard.jsx` rendered the weather *object* directly (React crash) — now shows
  temp/condition fields.
- [x] Build-verified after each change (`npm run build`).

### Next up
- [ ] **Manual browser test**: verify fashion-brand aesthetic end-to-end — navbar wordmark, warm
  off-white background, Inter font, mobile bottom sheet, Dashboard stats, Lookbook masonry, 5-step
  quiz on new account, AI auto-tag (if OPENAI_API_KEY set), tiered recommendations with nudge.

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
