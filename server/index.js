import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { connectDB } from './db.js';
import { seedIfEmpty } from './services/seedData.js';

import authRoutes from './routes/auth.js';
import wardrobeRoutes from './routes/wardrobe.js';
import recommendRoutes from './routes/recommend.js';
import outfitRoutes from './routes/outfits.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.resolve('uploads')));
app.use('/assets', express.static(path.resolve('assets')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/wardrobe', wardrobeRoutes);
app.use('/api/recommend', recommendRoutes);
app.use('/api/outfits', outfitRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    if (process.env.SEED_DEMO !== 'false') {
      await seedIfEmpty(`http://localhost:${PORT}`);
    }
    app.listen(PORT, () => {
      console.log(`[server] Virtual Wardrobe API listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('[server] Failed to connect to database:', err);
    process.exit(1);
  });
