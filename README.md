# AR-Powered Virtual Wardrobe

A final-year project: organize your closet digitally, try on clothes live with webcam AR, and get
weather + preference-aware outfit recommendations.

See `PROGRESS.md` for current build status and `~/.claude/plans/developing-an-ar-powered-virtual-purring-crane.md`
for the full design plan.

## Stack
- **Frontend:** React + Vite + Tailwind, MediaPipe `tasks-vision` for pose tracking
- **Backend:** Node + Express + Mongoose
- **DB:** MongoDB — auto-falls back to an in-memory instance if `MONGO_URI` isn't set, so it runs
  with zero installs
- **Weather:** Open-Meteo (free, no API key)

Everything used is free — no paid services, no API keys required to run the demo.

## Running locally

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev          # http://localhost:5000

# Terminal 2 — frontend
cd client
npm install
npm run dev          # http://localhost:5173
```

Open http://localhost:5173 and register an account.

## Project structure
```
server/    Express API, MongoDB models, auth, wardrobe CRUD, weather + recommendations
client/    React app — closet, AR try-on, recommendations, profile
```
