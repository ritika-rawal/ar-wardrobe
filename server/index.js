import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './db.js';
import { seedIfEmpty } from './services/seedData.js';

import authRoutes from './routes/auth.js';
import wardrobeRoutes from './routes/wardrobe.js';
import recommendRoutes from './routes/recommend.js';
import outfitRoutes from './routes/outfits.js';
import lookbookRoutes from './routes/lookbook.js';
import uploadsRoutes from './routes/uploads.js';

// Resolve paths relative to this file (not the cwd) so the server works no matter
// which directory the host launches it from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(express.json());

// Uploaded images are stored in MongoDB and streamed back here (survives restarts).
app.use('/uploads', uploadsRoutes);
// Seed/demo garment art ships in the repo and is served as plain static files.
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/recommend', recommendRoutes);
app.use('/api/outfits', outfitRoutes);
app.use('/api/lookbook', lookbookRoutes);

// In production, serve the built React app from this same server (single-service
// deploy: one URL, no CORS). Any non-API route falls through to index.html so
// client-side routing works on refresh/deep links.
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    if (process.env.SEED_DEMO !== 'false') {
      await seedIfEmpty();
    }
    app.listen(PORT, () => {
      console.log(`[server] Virtual Wardrobe API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[server] Failed to connect to database:', err);
    process.exit(1);
  });
