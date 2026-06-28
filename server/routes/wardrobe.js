import express from 'express';
import ClothingItem, { CLOTHING_CATEGORIES, CLOTHING_SEASONS } from '../models/ClothingItem.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { autoTagItem } from '../services/autoTagService.js';

const router = express.Router();
router.use(requireAuth);

function toPublicUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Validates/normalizes AR image anchors: must be 4 finite {x,y} points. Returns the cleaned array
// or null if the shape is wrong (caller then leaves the field untouched).
function sanitizeAnchors(value) {
  if (!Array.isArray(value) || value.length !== 4) return null;
  const cleaned = value.map((p) => ({ x: Number(p?.x), y: Number(p?.y) }));
  if (cleaned.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  return cleaned;
}

// List items for the logged-in user, optional filters via query params.
router.get('/', async (req, res) => {
  const { category, season, color } = req.query;
  const filter = { userId: req.userId };
  if (category) filter.category = category;
  if (season) filter.seasons = season;
  // Colors aren't normalized on input (free text), so match case-insensitively.
  if (color) filter.color = new RegExp(`^${escapeRegex(color)}$`, 'i');

  const items = await ClothingItem.find(filter).sort({ createdAt: -1 });
  res.json({ items });
});

router.get('/meta', (req, res) => {
  res.json({ categories: CLOTHING_CATEGORIES, seasons: CLOTHING_SEASONS });
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file is required' });

    const { name, category, color, warmth } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'name and category are required' });
    }

    let seasons = req.body.seasons;
    if (typeof seasons === 'string') seasons = seasons ? seasons.split(',') : [];

    const item = await ClothingItem.create({
      userId: req.userId,
      name,
      category,
      color: color || '',
      seasons: seasons || [],
      warmth: warmth ? Number(warmth) : 3,
      imageUrl: toPublicUrl(req, req.file.filename),
    });

    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create item', detail: err.message });
  }
});

// Client computes a background-removed cutout (for AR overlay) and uploads it here.
router.post('/:id/try-on-asset', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'image file is required' });

    const update = { tryOnAssetUrl: toPublicUrl(req, req.file.filename) };
    // imageAnchors arrives as a JSON string in the multipart body (auto-detected on the client).
    if (req.body.imageAnchors) {
      try {
        const anchors = sanitizeAnchors(JSON.parse(req.body.imageAnchors));
        if (anchors) update.imageAnchors = anchors;
      } catch {
        // malformed anchors are non-fatal — keep the cutout, skip anchors
      }
    }

    const item = await ClothingItem.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      update,
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save AR cutout', detail: err.message });
  }
});

router.post('/:id/auto-tag', async (req, res) => {
  try {
    const item = await ClothingItem.findOne({ _id: req.params.id, userId: req.userId });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const tags = await autoTagItem(item);
    if (!tags) return res.json({ item }); // no-op when API key absent

    const VALID_CATS = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];
    if (tags.color) item.color = tags.color;
    if (tags.category && VALID_CATS.includes(tags.category)) item.category = tags.category;
    if (tags.warmth) item.warmth = Math.min(5, Math.max(1, Number(tags.warmth)));
    if (Array.isArray(tags.style_tags)) item.styleTags = tags.style_tags;
    item.autoTagged = true;
    await item.save();

    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Auto-tag failed', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, category, color, warmth, seasons, tryOnAssetUrl, tags, imageAnchors } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (category !== undefined) update.category = category;
  if (color !== undefined) update.color = color;
  if (warmth !== undefined) update.warmth = Number(warmth);
  if (seasons !== undefined) update.seasons = Array.isArray(seasons) ? seasons : seasons.split(',');
  if (tryOnAssetUrl !== undefined) update.tryOnAssetUrl = tryOnAssetUrl;
  if (tags !== undefined) update.tags = Array.isArray(tags) ? tags : tags.split(',');
  if (imageAnchors !== undefined) {
    const anchors = sanitizeAnchors(imageAnchors);
    if (anchors) update.imageAnchors = anchors;
  }

  const item = await ClothingItem.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    update,
    { new: true }
  );
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ item });
});

router.delete('/:id', async (req, res) => {
  const item = await ClothingItem.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({ success: true });
});

export default router;
