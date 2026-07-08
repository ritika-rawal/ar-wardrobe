# AR Virtual Wardrobe: A Browser-Based Augmented-Reality Try-On and Weather-Aware Outfit Recommendation System

**Final Year Project Report**

Author: Ritika Rawal
Programme: BSc (Hons) Computing / Software Engineering
Supervisor: _[supervisor name]_
Submission date: _[date]_
Word count: _[fill after export]_

Live demonstration: <https://virtual-wardrobe-bqyn.onrender.com> (demo account `demo@demo.com` / `demo1234`)
Source repository: <https://github.com/ritika-rawal/ar-wardrobe>

---

> **Note on references.** All citations in this report refer to real, well-known works, but the author is responsible for verifying every bibliographic detail (authors, year, venue, page numbers) against the original source before final submission. Fabricated or inaccurate references are heavily penalised, so do not submit without checking each entry in the References section.

---

## Abstract

Online fashion retail suffers from a persistent "fit and look" uncertainty problem: shoppers cannot see how a garment will appear on their own body before purchase, which contributes to high return rates and low buyer confidence. Commercial solutions to this problem typically rely on proprietary 3D body scanning, native mobile applications, or paid cloud APIs, placing them out of reach for small retailers, students, and hobbyists. This project designs, implements, and deploys **AR Virtual Wardrobe**, a full-stack web application that lets a user (a) build a digital wardrobe from ordinary garment photographs, (b) try those garments on live through the webcam using markerless augmented reality, and (c) receive weather-aware outfit recommendations — entirely in the browser, using only free and open technologies, with no paid APIs and no native app.

The core technical contribution is a real-time, keypoint-anchored AR try-on pipeline that runs wholly on the client. Google's MediaPipe pose estimator supplies body landmarks and a person-segmentation mask; a projective homography maps each garment image onto a body-aligned quadrilateral; and a WebGL mesh renderer applies silhouette conforming, cylindrical shading, and mask-based occlusion so that garments wrap around the body and clip realistically to its outline. A One-Euro filter stabilises the overlay. The application is completed by a rule-based recommendation engine driven by the free Open-Meteo weather service, and is deployed as a single free cloud service backed by MongoDB Atlas, with uploaded images persisted as binary documents so they survive restarts on ephemeral-disk hosts.

This report presents the business case, a review of the relevant literature in augmented reality, virtual try-on, pose estimation and image warping, the technical specification and implementation, and a critical evaluation of the outcomes against the stated objectives. The system meets all of its core objectives and is publicly deployed, while its limitations — chiefly the absence of physical cloth simulation and of formal user testing — define a clear programme of further work.

---

## Table of Contents

1. [Background and Business Case](#1-background-and-business-case)
2. [Literature Review](#2-literature-review)
3. [Development, Technical Specification and Implementation](#3-development-technical-specification-and-implementation)
4. [Discussion, Conclusion and Further Work](#4-discussion-conclusion-and-further-work)
5. [Ethics Statement](#5-ethics-statement)
6. [References](#6-references)
7. [Appendices](#7-appendices)

_(A paginated contents page with page numbers should be generated automatically on export to Word/PDF.)_

---

## 1. Background and Business Case

### 1.1 Introduction

Clothing is bought increasingly online. The convenience of e-commerce, however, removes the single most important step of in-store shopping: physically trying a garment on. A shopper browsing a website sees clothing on a professional model whose body, pose, and lighting differ from their own, and must imagine the result on themselves. This imagination gap has measurable commercial consequences — most visibly in return rates, which are substantially higher for online fashion than for almost any other product category (Deldjoo et al., 2022). Returns are costly for retailers (reverse logistics, restocking, lost margin) and environmentally damaging (transport emissions, product write-off), and they erode customer trust.

Augmented reality (AR) offers a direct response to this gap by overlaying digital garments onto a live view of the shopper's own body. Where early "virtual mirror" installations required dedicated hardware and in-store kiosks, the maturation of on-device machine learning and the graphics capabilities of the modern web browser now make it feasible to deliver a comparable experience through a webpage, on a commodity laptop or phone, with no installation. This project sets out to demonstrate exactly that: a production-quality, browser-only AR try-on experience built entirely from free and open components.

### 1.2 Problem context and business case

The problem this project addresses can be stated precisely: **shoppers lack an accessible way to preview how clothing will look on their own body before purchase, and existing solutions to this are expensive, hardware-dependent, or locked into proprietary platforms.**

The business case rests on three observations:

1. **The pain is real and quantifiable.** Fit and appearance uncertainty is a leading driver of online fashion returns, and returns are a well-documented cost centre for e-tailers (Deldjoo et al., 2022). Any tool that increases pre-purchase confidence has a plausible path to reducing returns and increasing conversion.
2. **Existing solutions are inaccessible to the "long tail" of retail.** Commercial virtual try-on typically depends on 3D body scanning, per-garment 3D asset creation, native app development, or paid computer-vision APIs. These impose cost and integration barriers that exclude small and independent retailers, market traders, and individuals who simply want to organise and visualise their own wardrobe.
3. **The enabling technology is now free.** Markerless pose estimation (MediaPipe), in-browser background removal (U²-Net-derived models), WebGL rendering, and free weather data (Open-Meteo) can all be combined on the client at zero marginal cost. The opportunity is to assemble these into a coherent product.

The target users are therefore twofold: **individual consumers** who want a digital, "try-before-you-decide" wardrobe, and **small retailers/developers** who need a reference architecture for adding try-on to a website without a cloud-vision budget. The value proposition is *accessible, zero-cost, no-install augmented try-on*.

This is an implementation-and-investigation project rather than a hypothesis-testing study: the central question is whether a credible AR try-on experience can be engineered from free browser technologies alone, and what the resulting quality/limitations are.

### 1.3 Aims and objectives

**Aim.** To design, implement, and deploy a full-stack web application that provides real-time, markerless augmented-reality garment try-on and weather-aware outfit recommendation, using only free and open technologies and requiring no native app or paid API.

**Objectives.**

- **O1 — Digital wardrobe.** Allow users to upload garment photographs and organise them by category, colour, season, and warmth, with per-user authentication and persistence.
- **O2 — In-browser garment preparation.** Automatically remove garment backgrounds client-side to produce clean cut-outs suitable for overlay, with no server cost and no API key.
- **O3 — Real-time AR try-on.** Track the user's body from the webcam and render selected garments onto it in real time so that they follow the body's position, width, and orientation, and clip to its outline.
- **O4 — Weather-aware recommendation.** Suggest outfits appropriate to current weather conditions and the user's stated style/colour preferences using a transparent, rule-based engine.
- **O5 — Free cloud deployment.** Deploy the complete system to the public internet at zero cost, with persistent data, so it can be demonstrated without a local machine or a tunnelling tool.
- **O6 — Engineering quality.** Produce a maintainable, documented codebase with a clear architecture and a graceful-degradation strategy for lower-capability devices.

### 1.4 Scope and deliverables

**In scope:** user authentication; wardrobe CRUD with image upload; client-side background removal; markerless AR try-on with pose tracking, warping, shading and occlusion; save/share of AR snapshots; rule-based, weather-aware recommendations; and free single-service cloud deployment.

**Out of scope (by deliberate decision, given the time frame):** physically based cloth simulation (fabric drape and wrinkle physics); learned, per-pixel garment/body segmentation; a native mobile application; size/measurement estimation and true sizing advice; and a formal large-scale user study.

**Deliverables:** the deployed web application; the source repository with README, progress log and deployment guide; this report.

### 1.5 Methodology and justification

The project followed an **iterative, incremental development methodology** in the spirit of Agile, structured as a sequence of short, self-contained phases (recorded in the project's `PROGRESS.md` log, which documents fifteen phases from initial scaffold through AR refinement to cloud deployment). Each phase delivered a working, testable increment — for example, "AR core polish", "body-wrapping mesh renderer", "AR realism + calibration", and finally "cloud deployment" — and ended with verification before the next began.

This methodology was chosen over a plan-driven (waterfall) approach for two reasons. First, the central risk in the project was *technical uncertainty*: it was not known in advance how accurate a browser-only AR overlay could be made, so the work needed to be exploratory, with frequent build-measure-adjust cycles rather than an up-front fixed specification. Second, the single-developer, fixed-deadline context made an incremental "always shippable" approach the safest way to guarantee a working artefact at the deadline, even if later refinements were cut. The trade-off — less up-front design documentation — was mitigated by maintaining the living progress log and by keeping architectural decisions deliberately simple.

### 1.6 Risk analysis and mitigation

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Browser AR overlay too inaccurate to be credible | Medium | High | Iterative calibration phases; silhouette conforming and occlusion to improve realism; automatic WebGL→2D fallback; adaptive model tier |
| R2 | Performance too low on mobile/low-end devices | Medium | Medium | Adaptive `lite`/`full` pose model, user-overridable quality control, on-screen FPS HUD, GPU delegate with CPU fallback |
| R3 | Dependence on a paid API or cloud service | Low | High | Explicit constraint: free/open only — MediaPipe, Open-Meteo, in-browser background removal, free Atlas + Render tiers |
| R4 | Data loss / non-persistent uploads on free hosting | Medium | Medium | Images stored as binary documents in MongoDB rather than on ephemeral disk |
| R5 | Camera requires secure context; hard to demo | Medium | Medium | HTTPS cloud deployment so mobile webcam works without a tunnel |
| R6 | Single developer, fixed deadline, scope creep | High | Medium | Incremental "always shippable" phases; explicit out-of-scope list |
| R7 | Loss of code / environment | Low | High | Version control with a remote GitHub repository; reproducible zero-install local setup |

### 1.7 Report structure

Section 2 reviews the literature underpinning the technical choices. Section 3 presents the requirements, architecture, and implementation in detail. Section 4 critically evaluates the outcomes against the objectives, reflects on project management, and defines further work. Section 5 is the ethics statement, followed by references and appendices.

---

## 2. Literature Review

### 2.1 Introduction

This review situates the project within four bodies of work: (i) augmented reality in retail and the broader definition of AR; (ii) approaches to virtual clothing try-on; (iii) the enabling computer-vision techniques — human pose estimation, geometric image warping, interactive signal smoothing, and background segmentation; and (iv) fashion recommendation and the practicalities of deploying machine learning in the browser. It closes with a synthesis that identifies the gap this project fills.

### 2.2 Augmented reality in retail

Augmented reality is classically defined by Azuma (1997) as a system that combines real and virtual content, is interactive in real time, and registers virtual objects in three dimensions with the real world. These three properties — combination, real-time interactivity, and spatial registration — are a useful yardstick for any try-on system: a static clothing "sticker" pasted onto a photo satisfies only the first, whereas a system that anchors a garment to a moving body in real time approaches all three.

In retail specifically, AR has been adopted for furniture placement, cosmetics, eyewear, and apparel. The commercial "magic mirror" lineage placed cameras and displays in stores; more recent work moves the experience onto consumers' own devices. The consistent finding across this literature is that AR's value lies in reducing pre-purchase uncertainty and increasing engagement, which motivates the business case in Section 1. What has changed recently is *feasibility*: on-device inference and web graphics now allow the "3D registration in real time" property to be achieved without specialised hardware.

### 2.3 Approaches to virtual try-on

Research on virtual try-on divides broadly into three families.

**Image-based (2D) generative try-on.** A large and influential line of work synthesises a photo of a person wearing a target garment using deep generative networks. VITON (Han et al., 2018) introduced an image-based virtual try-on network that warps a garment onto a target person using a coarse-to-fine strategy; CP-VTON (Wang et al., 2018) improved garment warping with a learnable thin-plate-spline transformation to better preserve garment characteristics. Subsequent work such as VITON-HD (Choi et al., 2021) and parser-free approaches (Ge et al., 2021) pushed resolution and robustness further. These methods produce highly realistic still images but are computationally heavy, typically require server-side GPUs, and operate on static images rather than a live video feed — making them poorly suited to a free, real-time, client-only setting.

**3D/model-based try-on.** A second family reconstructs or fits a 3D body model (for example, parametric human-body models) and drapes simulated cloth over it. This can yield physically plausible fit and drape but depends on 3D body capture or estimation and on per-garment 3D assets, both of which are expensive to produce and integrate. This is the approach behind many commercial scanning solutions and is precisely what the present project seeks to avoid on cost and accessibility grounds.

**Keypoint-anchored AR overlay.** A third, lighter-weight family — the one adopted here — does not synthesise or simulate cloth but instead *registers* a garment image to the body using detected keypoints and a geometric transform, overlaying it on the live camera feed. This trades photorealistic drape for real-time performance and zero training cost. It is the pragmatic choice when the constraints are "in the browser, in real time, for free", and it aligns most closely with Azuma's (1997) definition of AR because it maintains live 3D-ish registration. The project's contribution is to make this lightweight approach visually convincing through silhouette conforming, cylindrical shading, and mask-based occlusion, narrowing the gap toward the heavier families.

### 2.4 Human pose estimation

Registering a garment to a body requires knowing where the body is. Multi-person 2D pose estimation was advanced significantly by OpenPose (Cao et al., 2019), which used part affinity fields to associate body joints in real time. For on-device use, Google's BlazePose (Bazarevsky et al., 2020) provides a lightweight topology of 33 body landmarks designed to run in real time on mobile CPUs/GPUs, and is exposed to developers through the MediaPipe framework (Lugaresi et al., 2019), which packages perception pipelines for the web via WebAssembly and GPU delegates.

This project uses MediaPipe's pose landmarker directly. Two properties are exploited: the 33-landmark skeleton, from which shoulder and hip/knee points are taken to anchor garments; and the accompanying person-segmentation mask, which is reused for occlusion and silhouette conforming. MediaPipe's availability as a free, in-browser, WASM-delivered model is what makes the project's "no server, no key" constraint achievable for pose tracking — the single most important enabling dependency.

### 2.5 Geometric image warping and homography

Given body anchor points, the garment image must be transformed to align with them. The underlying mathematics is projective geometry: a **homography** is a 3×3 projective transformation mapping one plane to another, and the standard reference is Hartley and Zisserman (2004). Mapping a source image quadrilateral to a destination quadrilateral is a classic operation in texture mapping and image warping; Heckbert's (1989) treatment of texture mapping and image warping provides the unit-square method used to compute a quad-to-quad projective transform, which this project implements directly in its `homography.js` module.

A single planar homography assumes the garment lies on a plane, which is only approximately true for a body. The project therefore does not rely on the homography alone: it subdivides the garment into a fine vertex mesh and additionally deforms the mesh toward the body silhouette and applies a cylindrical shading/UV remap, approximating the curvature of the torso. This combination of a global projective transform with local mesh correction is a pragmatic, well-established graphics strategy for making a planar texture appear to wrap a curved surface.

### 2.6 Signal smoothing for interactive AR

Pose landmarks estimated per-frame are noisy; overlaying a garment directly on raw landmarks produces visible jitter. Naïve fixes — such as a fixed low-pass or exponential moving average — reduce jitter only by introducing lag, which makes the overlay feel like it is "sliding" to catch up with movement. The **One-Euro filter** (Casiez, Roussel and Vogel, 2012) resolves this trade-off with a speed-adaptive low-pass filter: it smooths heavily when the signal is nearly stationary (removing jitter) and reduces smoothing as speed increases (removing lag). This is the standard technique for interactive systems and is implemented here in `oneEuroFilter.js` to stabilise the landmark stream feeding the renderer.

### 2.7 Background removal and segmentation

For a garment image to overlay cleanly, its background must be removed to yield a transparent cut-out. Salient-object-detection networks such as U²-Net (Qin et al., 2020) produce high-quality foreground masks and underpin several browser background-removal libraries; this project uses the `@imgly/background-removal` package, which runs such a model client-side via WebAssembly, again satisfying the "no server, no key" constraint. For the separate task of detecting a garment held up to the camera during capture, the project uses a lightweight border flood-fill heuristic rather than a learned model — adequate for a uniform backdrop, and explicitly identified as an upgrade target. The general-purpose successor for both tasks would be a promptable segmentation model such as Segment Anything (Kirillov et al., 2023), whose per-pixel masks could replace both the flood-fill capture heuristic and the landmark-based occlusion approximation; it is noted as future work rather than adopted, on grounds of size and runtime cost.

### 2.8 Outfit and fashion recommendation

Fashion recommendation is a mature sub-field of recommender systems; Deldjoo et al. (2022) survey modern approaches, which range from collaborative filtering to deep visual-compatibility models. Such data-hungry, learned recommenders are inappropriate for a single-user demonstrator with no interaction history (the classic cold-start problem) and would also conflict with the project's transparency and zero-cost goals. This project therefore adopts a **rule-based** recommendation engine that scores outfits against current weather (retrieved from the free Open-Meteo API) and the user's declared style and colour preferences. Rule-based recommenders trade personalisation depth for transparency, predictability, and zero training data — an appropriate engineering choice at this scale, and one whose reasoning can be explained to the user, which learned models struggle to do.

### 2.9 Deploying machine learning in the browser and to free infrastructure

A recurring theme above is the migration of computation from the server to the client. Running inference in the browser via WebAssembly and WebGL/WebGPU eliminates per-request server cost and protects user privacy (camera frames never leave the device), at the price of shipping large model/WASM assets and depending on client hardware. This informs several design decisions: model assets are cached after first load; an adaptive model tier and a WebGL→2D fallback handle capability variance; and the heavy assets are code-split so the initial page remains usable.

On the hosting side, the relevant practical constraint of free Platform-as-a-Service tiers is the **ephemeral filesystem**: containers are periodically recycled, so anything written to local disk is lost. The standard remedies are external object storage or storing binary data in the database. This project takes the latter route — persisting uploaded images as binary documents in MongoDB — which keeps the deployment to a single free service with a single external dependency (a free database), avoiding an object-storage account entirely.

### 2.10 Synthesis and gap analysis

The literature shows two poles. At one pole, image-based and 3D try-on methods (Han et al., 2018; Wang et al., 2018; Choi et al., 2021; Ge et al., 2021) achieve high realism but demand server GPUs, training, or 3D capture, and generally operate offline on static images. At the other pole, a garment "sticker" is cheap but fails Azuma's (1997) real-time-registration test and looks unconvincing. The enabling technologies — MediaPipe pose tracking (Bazarevsky et al., 2020; Lugaresi et al., 2019), projective warping (Hartley and Zisserman, 2004; Heckbert, 1989), the One-Euro filter (Casiez, Roussel and Vogel, 2012), and browser segmentation (Qin et al., 2020) — exist independently, but there is comparatively little work assembling them into a *single, free, browser-only, real-time* try-on product that also handles occlusion and silhouette conforming and is publicly deployed.

**The gap this project fills** is therefore integrative and engineering-focused: to show that a credible, real-time AR try-on experience — with body-width conforming and body-outline occlusion, not merely a flat overlay — can be built and deployed end-to-end using only free, open, in-browser technologies, and to characterise honestly how far that approach can be pushed and where it breaks down.

---

## 3. Development, Technical Specification and Implementation

### 3.1 Requirements

**Functional requirements.**

| ID | Requirement | Objective |
|----|-------------|-----------|
| F1 | Users can register, log in, and remain authenticated across sessions | O1 |
| F2 | Users can upload a garment photo and set name, category, colour, season, warmth | O1 |
| F3 | Garment backgrounds are removed automatically to produce a cut-out for AR | O2 |
| F4 | Users can view, filter, edit, and delete wardrobe items | O1 |
| F5 | Users can select garments and see them overlaid on their body via the webcam in real time | O3 |
| F6 | The overlay tracks body position, follows body width, and clips to the body outline | O3 |
| F7 | Users can capture a snapshot / short clip of a look and save it | O3 |
| F8 | The system recommends outfits based on current weather and user preferences | O4 |
| F9 | The system is reachable on the public internet with persistent data | O5 |

**Non-functional requirements.**

| ID | Requirement |
|----|-------------|
| N1 | AR runs at an interactive frame rate on a typical laptop, degrading gracefully on weaker devices |
| N2 | No paid APIs, API keys, or native application required |
| N3 | Camera frames are processed on-device; raw video is never uploaded (privacy) |
| N4 | Uploaded data persists across server restarts |
| N5 | The application is a secure-context (HTTPS) site so mobile cameras are permitted |
| N6 | The codebase is documented and maintainable, with clear module boundaries |

### 3.2 System architecture

The system is a conventional three-tier web application with an unusually thick client, because the AR and background-removal computation runs in the browser. In production a single Node/Express process serves both the JSON API and the built React application from one origin.

```
┌───────────────────────────── Browser (client) ─────────────────────────────┐
│  React + Vite SPA                                                            │
│    Pages: Closet · TryOn · Recommendations · Outfits · Lookbook · Profile    │
│    AR engine (client/src/ar):                                                │
│       poseTracker (MediaPipe) → oneEuroFilter → garmentAnchors               │
│         → homography → webglRenderer (2D-canvas fallback)                    │
│    backgroundRemoval (@imgly WASM)                                           │
└───────────────▲─────────────────────────────────────────────▲──────────────┘
                │ HTTPS (same origin)                          │ camera frames
                │ /api/*  /uploads/*  /assets/*  /static/*     │ stay on device
┌───────────────┴───────────── Server (Node + Express) ───────┴──────────────┐
│  Routes: auth · wardrobe · outfits · recommend · lookbook · uploads         │
│  Services: seedData · recommendService · weatherService                     │
│  Serves built client (SPA fallback) in production                           │
└───────────────▲─────────────────────────────────────────────▲──────────────┘
                │ Mongoose                                     │ HTTPS
        ┌───────┴────────┐                            ┌────────┴─────────┐
        │ MongoDB Atlas  │                            │  Open-Meteo API  │
        │ users, items,  │                            │ (free, no key)   │
        │ outfits, images│                            └──────────────────┘
        └────────────────┘
```

Two design decisions in this diagram are worth highlighting. First, **camera frames never leave the browser** — pose estimation and background removal are client-side — which satisfies the privacy requirement (N3) and removes server compute cost. Second, the **single-origin** arrangement (one service serving API + frontend) removes cross-origin complexity and allows the whole system to be deployed as one free unit (O5).

### 3.3 Technology choices and justification

| Layer | Choice | Justification |
|-------|--------|---------------|
| Frontend | React + Vite + Tailwind CSS | Fast HMR iteration; component model suits the multi-page SPA; utility CSS for a mobile-first UI |
| Pose tracking | MediaPipe Tasks-Vision (BlazePose) | Free, in-browser (WASM + GPU delegate), 33-landmark model with segmentation mask (Bazarevsky et al., 2020) |
| Rendering | WebGL2 with a 2D-canvas fallback | Perspective-correct UV mapping and per-vertex deformation without the weight of a full 3D engine; fallback for devices lacking WebGL |
| Background removal | `@imgly/background-removal` (WASM) | Client-side U²-Net-style segmentation (Qin et al., 2020); no server, no key |
| Backend | Node.js + Express | Lightweight JSON API; can also serve the built SPA; single language across the stack |
| Database | MongoDB (Atlas in prod; in-memory in dev) | Schema-flexible document store; `mongodb-memory-server` gives a zero-install local database |
| Image storage | Binary documents in MongoDB | Persists across restarts on ephemeral-disk hosts without an object-storage account |
| Weather | Open-Meteo REST API | Completely free, requires no API key |
| Hosting | Render (free Web Service) | Free single-service Node hosting with a public HTTPS URL |

The unifying principle is the **zero-cost, no-key constraint** (N2), which drove nearly every choice: MediaPipe over a paid vision API, Open-Meteo over a keyed weather service, in-browser segmentation over a cloud endpoint, and database-blob storage over a paid object store.

### 3.4 Data model

Four Mongoose collections back the application:

```
User            { name, email, passwordHash, preferences{ styles, favoriteColors, avoidColors } }
ClothingItem    { userId→User, name, category, color, seasons[], warmth,
                  imageUrl, tryOnAssetUrl, imageAnchors[4], tags[], styleTags[] }
Outfit          { userId→User, name, itemIds[]→ClothingItem, snapshotUrl, worn, wornAt }
UploadedImage   { userId→User, contentType, data:Buffer }   // binary image bytes
```

`ClothingItem.imageUrl` and `tryOnAssetUrl` hold **relative** URLs (`/uploads/<id>` for user uploads, `/assets/<file>` for seed art). Relative URLs were adopted deliberately during deployment so that image references resolve against whichever host serves the app, making the same data valid in local development and in the cloud. `imageAnchors` caches the four per-garment anchor points auto-detected from the cut-out at upload time, so the renderer does not have to recompute them each session.

### 3.5 The AR try-on pipeline (core implementation)

The AR engine is the heart of the project. Each webcam frame is processed through the following stages (implemented across the modules in `client/src/ar/`):

1. **Pose estimation** (`poseTracker.js`). MediaPipe's `PoseLandmarker` returns 33 body landmarks and a person-segmentation mask. The model runs on the GPU delegate where available and falls back to CPU. An adaptive tier selects the lighter `lite` model on mobile/low-core/low-memory devices and the more accurate `full` model otherwise; the user can override this via an in-app Quality control, and an FPS/latency HUD exposes the cost (addressing N1).
2. **Smoothing** (`oneEuroFilter.js`). The raw landmark stream is passed through a One-Euro filter (Casiez, Roussel and Vogel, 2012), removing jitter when the user is still without introducing lag when they move.
3. **Anchor correspondence** (`garmentAnchors.js`, `garmentAnchorDetect.js`). Four body landmarks (shoulders and hips, or knees for lower-body garments) define a destination quadrilateral on the body. Four corresponding points inside the garment image are used as the source quadrilateral; these are auto-detected per garment from the cut-out's alpha bounding box, with per-category calibrated defaults as a fallback. Per-category auto-fit scales and positions the garment appropriately (e.g. tops vs. trousers).
4. **Projective transform** (`homography.js`). A quad-to-quad homography (Heckbert's unit-square method; Hartley and Zisserman, 2004) maps the garment image plane onto the body quadrilateral.
5. **Mesh rendering** (`webglRenderer.js`). Rather than warping the whole image with one transform, the garment is drawn as a 16×10 vertex mesh. For each vertex the renderer: (a) computes a baseline position from the homography; (b) **conforms to the silhouette** by scanning the segmentation-mask row at that height and blending the mesh edge toward the actual body edge, so the garment follows real body width; (c) applies **cylindrical shading** (a `sin(u·π)` factor across each column) to suggest torso curvature; (d) applies a perspective-correct **UV remap** so the texture appears wrapped rather than flat; and (e) multiplies garment alpha by the mask in screen space to **occlude** — clipping the garment to the body outline so it does not bleed past it. A depth approximation additionally carves out forearm/upper-arm capsules when MediaPipe's landmark *z* places an arm in front of the torso.
6. **Fallback** (`garmentRenderer.js`). On devices without WebGL2, a 2D-canvas renderer using the same anchor correspondence produces a consistent, if simpler, result — a graceful-degradation strategy central to N1.

For chest-up desktop framing, where knee landmarks are usually off-screen, the renderer extrapolates a synthetic knee by continuing the shoulder→hip vector, so trousers and skirts still render without a full-body shot. Captured looks are recorded from the canvas (`captureStream` + `MediaRecorder`) into a short `.webm`.

This staged pipeline is the concrete realisation of the "keypoint-anchored AR overlay" family from Section 2.3, extended with the conforming, shading and occlusion steps that distinguish it from a flat sticker.

### 3.6 Recommendation engine

The recommendation flow (`recommendService.js`, `weatherService.js`, `routes/recommend.js`) resolves the user's location (browser geolocation or a typed city), fetches current conditions from Open-Meteo, and scores candidate outfits from the user's wardrobe. Scoring combines the garment `warmth` attribute against temperature bands, season suitability against the current date, and the user's declared style and colour preferences (favoured colours boost a look; avoided colours penalise it). Because the rules are explicit, the resulting suggestions are explainable to the user — a deliberate advantage over a black-box learned recommender (Section 2.8).

### 3.7 Persistence and image storage

Uploads originally used multer disk storage, writing files under `server/uploads/` and serving them statically. This design fails on free hosting, whose filesystems are ephemeral (Section 2.9). The implementation was therefore changed so that multer uses in-memory storage and each uploaded file is persisted as a binary document in the `UploadedImage` collection; a dedicated route serves images back out (`GET /uploads/:id`) with the correct content-type and a long cache header, while `persistUpload()` saves an incoming file and returns its relative URL. This keeps uploaded garments and saved snapshots intact across restarts and redeploys (N4) using only the database, with no object-storage service.

### 3.8 Deployment

The system deploys as a **single free service**. In production the Express server additionally serves the built React bundle (`client/dist`) with an SPA fallback so client-side routes resolve on refresh and deep links; all server paths are resolved relative to the module directory so the process runs regardless of the launching directory. A `render.yaml` blueprint provisions one free Render Web Service (build: install both packages and build the client; start: run the server; health check: `/api/health`), with the MongoDB Atlas connection string as the only user-supplied secret.

Two issues surfaced only in the production build and were fixed: seed image URLs had been hardcoded to `http://localhost:5000/...` and were made relative; and Vite's default build output directory (`/assets`) collided with the server's seed-art `/assets` route, so the build output was relocated to `/static`. A final deployment failure was diagnosed from the logs as a MongoDB Atlas network-access restriction — Render's dynamic egress IPs required the cluster's IP access list to permit `0.0.0.0/0`. After this, the deployment succeeded and was verified live.

### 3.9 Testing and verification

Given the single-developer, fixed-deadline context, verification was **manual and continuous** rather than an automated suite (an honestly acknowledged limitation, Section 4.2). Three complementary strategies were used:

- **API round-trip testing** with `curl` at each phase — register/login, upload, attach cut-out, recommend — confirming endpoints end-to-end.
- **Build-gate verification**: `npm run build` was required to pass, catching import/syntax and bundling errors (including the WebGL shader reserved-word fix and the `/assets` collision).
- **Live post-deployment smoke testing** of the public URL: health endpoint, SPA deep links, seed-asset serving, demo login, seeded wardrobe retrieval, static-bundle loading, and a full upload→store→serve round-trip confirming images persist in Atlas and are served back from MongoDB.

The AR experience itself was evaluated by iterative manual observation against the on-screen FPS/latency HUD and by the visual quality of overlay tracking, conforming, and occlusion across the calibration phases.

### 3.10 Code quality and maintainability

The codebase is organised by clear responsibility: `server/routes` (HTTP), `server/services` (domain logic), `server/models` (schemas), and on the client a dedicated `ar/` package whose modules each own one pipeline stage (pose, filtering, anchors, homography, rendering, background removal). This separation makes the complex AR pipeline navigable and testable stage by stage. Configuration is environment-driven (database URI, JWT secret, model asset locations), a zero-install local mode lowers the barrier to running the project, and the repository carries a README, a fifteen-phase progress log, and a deployment guide.

---

## 4. Discussion, Conclusion and Further Work

### 4.1 Evaluation against objectives

| Objective | Outcome | Evidence |
|-----------|---------|----------|
| O1 Digital wardrobe | **Met** | Auth + wardrobe CRUD with per-user persistence; verified via API tests and live |
| O2 In-browser garment prep | **Met** | Client-side background removal produces cut-outs; no server, no key |
| O3 Real-time AR try-on | **Met** | Pose-tracked overlay with conforming, shading, occlusion, snapshots/clips; WebGL + 2D fallback |
| O4 Weather-aware recommendation | **Met** | Rule-based engine over Open-Meteo + user preferences; live weather verified |
| O5 Free cloud deployment | **Met** | Publicly deployed on Render + Atlas; smoke-tested live; uploads persist |
| O6 Engineering quality | **Largely met** | Clear modular architecture, docs, graceful degradation; gap: no automated tests |

All six objectives were achieved, with the only qualification being the absence of an automated test suite under O6.

### 4.2 Critical discussion and limitations

The project succeeds in its central claim: a credible, real-time AR try-on experience can be assembled entirely from free, in-browser technologies and deployed at no cost. The conforming and occlusion steps meaningfully raise the overlay above a flat sticker, and the system is genuinely usable by anyone with a webcam and a browser. Nonetheless, several limitations are important to state plainly, as they bound the contribution:

- **No physical cloth simulation.** The garment is a keypoint-anchored, mesh-warped image, not simulated fabric. It does not drape, fold, or wrinkle in response to body shape or motion (Section 2.3). This is the fundamental ceiling of the chosen approach and the clearest distinction from the image-based/3D families.
- **Approximate, not per-pixel, occlusion.** Arm-in-front occlusion uses landmark-*z* capsules rather than a true depth or body-part segmentation, so it handles gross cases (crossed arms) but not fine boundaries (fingers).
- **Segmentation-dependent capture.** The camera-capture garment highlight uses a border flood-fill, which assumes a fairly uniform background; on busy backdrops it simply stays quiet and the user captures manually.
- **Relighting is coarse.** Garment tint matches the *average* scene colour, so a strongly coloured background can bias it.
- **No formal user study.** Evaluation was technical and observational; there is no quantitative usability or accuracy data from real participants (see Further Work).
- **No automated tests.** Verification relied on manual round-trips and the build gate. For a system of this complexity, a regression suite would materially improve maintainability.
- **Minimal authentication and known housekeeping gaps** (e.g. deleting a wardrobe item does not currently remove its orphaned image blob), acceptable for a demonstrator but not for production.

These limitations were, in most cases, conscious scope decisions taken to guarantee a working, deployed artefact within the timeframe rather than oversights — a distinction that matters for evaluating the project's management.

### 4.3 Reflection on project conduct and management

The iterative, phase-based methodology (Section 1.5) worked well for a technically uncertain, single-developer project: because each phase ended in a shippable increment, there was never a risk of finishing the deadline with a non-working system, and the living progress log preserved decision rationale that would otherwise have been lost. The deployment phase in particular validated the "always shippable" discipline — most of the deployment defects (hardcoded URLs, the asset-path collision, the Atlas IP rule) were latent issues that only a real production environment could surface, and the incremental, test-as-you-go approach isolated and fixed each quickly.

With hindsight, two things would have been done differently. First, an automated test suite introduced early would have paid for itself across fifteen phases of change. Second, the ephemeral-storage problem could have been anticipated at design time rather than discovered at deployment; designing for cloud constraints from the outset (relative URLs, database-backed uploads) would have avoided rework. Both lessons are reflected in the Further Work.

### 4.4 Conclusion

This project set out to determine whether an accessible, real-time augmented-reality clothing try-on system — together with a digital wardrobe and weather-aware recommendations — could be built and publicly deployed using only free and open technologies, and to characterise the quality of the result. The answer is affirmative. The delivered system meets all of its stated objectives, is deployed and demonstrable on the public internet, and advances the lightweight keypoint-anchored try-on approach with silhouette conforming and body-outline occlusion that narrow the gap toward far heavier methods. Its honest limitations — the absence of true cloth simulation and of formal user evaluation — do not undermine the central finding but rather define its boundary and its future. The project demonstrates that the barrier to entry for augmented retail experiences has fallen dramatically: what once required specialised hardware and proprietary platforms can now be delivered from a webpage, for free.

### 4.5 Further work

The limitations above map directly onto a prioritised programme of future work:

1. **Learned segmentation for occlusion and capture.** Replace the landmark-*z* capsules and the flood-fill capture heuristic with a promptable segmentation model such as Segment Anything (Kirillov et al., 2023) or an on-device body-parsing network, enabling per-pixel occlusion and robust capture on any background.
2. **Toward cloth realism.** Introduce thin-plate-spline or learned appearance-flow warping (as in CP-VTON and parser-free try-on; Wang et al., 2018; Ge et al., 2021) to add plausible folds, and explore a hybrid where a lightweight generative pass refines the warped overlay.
3. **Sizing and fit estimation.** Infer rough garment dimensions from the cut-out and body measurements from pose, moving from "how it looks" toward "how it fits" and directly attacking the returns problem.
4. **Formal user evaluation.** Conduct a usability and perceived-realism study with human participants (subject to ethics approval; Section 5), yielding the quantitative evidence this report lacks.
5. **Engineering hardening.** Add an automated test suite, orphaned-image cleanup on delete, stronger authentication (verification, reset, refresh tokens), and self-hosted MediaPipe assets for a fully offline demonstration.
6. **Personalised recommendation.** Evolve the transparent rule-based engine toward a hybrid that layers learned visual-compatibility signals (Deldjoo et al., 2022) on top of the explainable rules once interaction data exists.

---

## 5. Ethics Statement

This project did not involve any primary research with human participants. No surveys, interviews, questionnaires, or user studies were conducted, and no personal data was collected from third parties for research purposes. Development and evaluation were carried out by the author using the author's own camera input and a synthetic demonstration account; consequently no ethical approval for human-participant research was required.

Two ethical considerations nonetheless inform the design. **Privacy:** the augmented-reality pipeline processes all camera frames locally in the browser and never transmits raw video or images of the user to the server, minimising the collection of sensitive biometric-adjacent data by design. **User data:** the application stores only the data a user knowingly provides (account credentials, uploaded garment images, saved outfits); passwords are stored as bcrypt hashes rather than in plaintext. Should the further work in Section 4.5 proceed to a formal user study, that study would require ethical approval in line with university policy, including participant information sheets, informed consent, the right to withdraw, and a data-management plan covering the storage, anonymisation, and disposal of any collected data.

---

## 6. References

> Verify each entry against the original source before submission (authors, year, venue, pages). Harvard style.

Azuma, R.T. (1997) 'A survey of augmented reality', *Presence: Teleoperators and Virtual Environments*, 6(4), pp. 355–385.

Bazarevsky, V., Grishchenko, I., Raveendran, K., Zhu, T., Zhang, F. and Grundmann, M. (2020) 'BlazePose: on-device real-time body pose tracking', *arXiv preprint* arXiv:2006.10204.

Cao, Z., Hidalgo, G., Simon, T., Wei, S.-E. and Sheikh, Y. (2019) 'OpenPose: realtime multi-person 2D pose estimation using part affinity fields', *IEEE Transactions on Pattern Analysis and Machine Intelligence*, 43(1), pp. 172–186.

Casiez, G., Roussel, N. and Vogel, D. (2012) '1€ filter: a simple speed-based low-pass filter for noisy input in interactive systems', in *Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (CHI '12)*. New York: ACM, pp. 2527–2530.

Choi, S., Park, S., Lee, M. and Choo, J. (2021) 'VITON-HD: high-resolution virtual try-on via misalignment-aware normalization', in *Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*, pp. 14131–14140.

Deldjoo, Y., Nazary, F., Ramisa, A., McAuley, J., Pellegrini, G., Bellogín, A. and Di Noia, T. (2022) 'A review of modern fashion recommender systems', *ACM Computing Surveys*, 55(4), pp. 1–37.

Ge, Y., Song, Y., Zhang, R., Ge, C., Liu, W. and Luo, P. (2021) 'Parser-free virtual try-on via distilling appearance flows', in *Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*, pp. 8485–8493.

Han, X., Wu, Z., Wu, Z., Yu, R. and Davis, L.S. (2018) 'VITON: an image-based virtual try-on network', in *Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR)*, pp. 7543–7552.

Hartley, R. and Zisserman, A. (2004) *Multiple view geometry in computer vision*. 2nd edn. Cambridge: Cambridge University Press.

Heckbert, P.S. (1989) *Fundamentals of texture mapping and image warping*. Master's thesis. University of California, Berkeley.

Kirillov, A., Mintun, E., Ravi, N., Mao, H., Rolland, C., Gustafson, L., Xiao, T., Whitehead, S., Berg, A.C., Lo, W.-Y., Dollár, P. and Girshick, R. (2023) 'Segment Anything', in *Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV)*, pp. 4015–4026.

Lugaresi, C., Tang, J., Nash, H., McClanahan, C., Uboweja, E., Hays, M., Zhang, F., Chang, C.-L., Yong, M.G., Lee, J., Chang, W.-T., Hua, W., Georg, M. and Grundmann, M. (2019) 'MediaPipe: a framework for building perception pipelines', *arXiv preprint* arXiv:1906.08172.

Qin, X., Zhang, Z., Huang, C., Dehghan, M., Zaiane, O.R. and Jagersand, M. (2020) 'U²-Net: going deeper with nested U-structure for salient object detection', *Pattern Recognition*, 106, 107404.

Wang, B., Zheng, H., Liang, X., Chen, Y., Lin, L. and Yang, M. (2018) 'Toward characteristic-preserving image-based virtual try-on network', in *Proceedings of the European Conference on Computer Vision (ECCV)*, pp. 589–604.

---

## 7. Appendices

### Appendix A — Running the system

**Live:** <https://virtual-wardrobe-bqyn.onrender.com> — log in with `demo@demo.com` / `demo1234`.

**Locally (zero install of a database):**

```bash
# Terminal 1 — backend (auto-starts an in-memory MongoDB)
cd server && npm install && npm run dev      # http://localhost:5000

# Terminal 2 — frontend
cd client && npm install && npm run dev      # http://localhost:5173
```

Full cloud-deployment instructions are in `DEPLOY.md`.

### Appendix B — Repository map

See the README for a full module-by-module breakdown of `server/` and `client/src/`. The AR engine lives in `client/src/ar/`; the deployment configuration is `render.yaml`; the fifteen-phase development history is in `PROGRESS.md`.

### Appendix C — Objective-to-evidence traceability

Each functional requirement (F1–F9, Section 3.1) maps to an objective (O1–O5) and was verified as described in Section 3.9 (Testing and Verification) and summarised in Section 4.1.
