# Progress Tracker — AR Virtual Wardrobe FYP

Living checklist. Update after each meaningful change. Plan reference: `~/.claude/plans/developing-an-ar-powered-virtual-purring-crane.md`.

**Git note:** repo is not yet committed/pushed — waiting on git credentials from the user. Everything below reflects local working-tree state only.

## Status: Phase 4 (deep AR refinement — WebGL perspective warp + occlusion) complete — browser/phone UI still needs a manual pass

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

### Next up
- [ ] **Manual in-browser test pass on desktop (user, not yet done)**: open http://localhost:5173,
  log in as `demo@demo.com` / `demo1234`, select a top + bottom in Try-On. Specifically for this
  session's work: **lean/twist your torso** and confirm the garment shears/foreshortens instead of
  staying a flat rectangle (perspective warp); **cross your arms** and confirm the garment is
  clipped to your silhouette, not bleeding past it (occlusion) — if it looks inverted (visible
  where your body *isn't*), see the fragment-shader note under "Known limitations"; stand still vs.
  move quickly and confirm smoothing feels steady-then-responsive, not jittery-or-laggy (One-Euro);
  try a "bottom" item while only chest-up is in frame and confirm pants still render (knee
  extrapolation fallback). Then the existing checks: fit sliders, flip-camera, snapshot+save,
  Recommendations + My Outfits.
- [ ] **Force the 2D fallback path once** (e.g. spoof `WebGL is not available` by temporarily
  throwing in `createGLRenderer`, or test in a browser/profile with WebGL disabled) and confirm
  Try-On still renders a garment overlay instead of nothing.
- [ ] **Manual in-browser test pass on a real phone (user, not yet done)**: camera access needs a
  secure context, so plain `http://<lan-ip>:5173` will NOT work on a phone — either open the dev
  server via `localhost` on the device itself, or tunnel it over HTTPS (e.g. `ngrok http 5173`).
  Beyond the desktop checks above, this is also where to judge whether the always-on segmentation +
  perspective WebGL rendering holds an acceptable frame rate on real (especially low-end) phone
  hardware — confirm: front camera by default + mirrored; flip switches to rear + un-mirrors;
  portrait stage fits a full body when held vertically; walk every page at 375px width with no
  horizontal scroll and comfortably tappable controls.
- [ ] `git init` + first commit + push — **blocked on user providing git credentials**.
- [ ] FYP write-up: architecture diagram, screenshots, README expansion.

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
