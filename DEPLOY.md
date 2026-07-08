# Deploying Virtual Wardrobe (free)

The app deploys as **one** free service: the Express server serves the API *and*
the built React frontend from the same origin (no CORS, no second deploy, no tunnels).
Uploaded images are stored in MongoDB, so they survive restarts/redeploys.

## What you need (all free)
- A **MongoDB Atlas** account (free M0 cluster)
- A **Render** account (free Web Service)
- This repo on **GitHub**

## 1. Database — MongoDB Atlas
1. Create a free **M0** cluster.
2. Database Access → add a user (username + password).
3. Network Access → allow `0.0.0.0/0` (so Render can connect).
4. Copy the connection string:
   `mongodb+srv://USER:PASSWORD@cluster.mongodb.net/virtual-wardrobe`

## 2. Deploy — Render (Blueprint)
1. Push this repo to GitHub.
2. Render → **New +** → **Blueprint** → pick this repo. It reads `render.yaml`.
3. When prompted, set **`MONGO_URI`** to your Atlas string. `JWT_SECRET` is
   auto-generated; `SEED_DEMO=true` seeds the demo account on first boot.
4. Deploy. You get a public URL like `https://virtual-wardrobe.onrender.com`.

Demo login: `demo@demo.com` / `demo1234`.

### Manual setup (instead of Blueprint)
- Build: `npm install --omit=dev --prefix server && npm install --prefix client && npm run build --prefix client`
- Start: `node server/index.js`
- Env: `MONGO_URI`, `JWT_SECRET`, `SEED_DEMO=true`, `NODE_VERSION=20`

## Notes
- **Cold start:** Render free sleeps after ~15 min idle; the first request then
  takes ~50s. To keep it warm, point a free pinger (e.g. cron-job.org) at
  `https://<your-app>.onrender.com/api/health` every ~10 min.
- **Local dev is unchanged:** run `npm run dev` in `server/` and `client/`
  separately. With no `MONGO_URI`, the server uses a zero-install in-memory Mongo.
