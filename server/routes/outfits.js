import express from 'express';
import Outfit from '../models/Outfit.js';
import { requireAuth } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.use(requireAuth);

function toPublicUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

router.get('/', async (req, res) => {
  const outfits = await Outfit.find({ userId: req.userId })
    .populate('itemIds')
    .sort({ createdAt: -1 });
  res.json({ outfits });
});

router.post('/', upload.single('snapshot'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    let itemIds = req.body.itemIds;
    if (typeof itemIds === 'string') itemIds = itemIds ? itemIds.split(',') : [];
    if (!itemIds || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds is required (at least one item)' });
    }

    const outfit = await Outfit.create({
      userId: req.userId,
      name,
      itemIds,
      snapshotUrl: req.file ? toPublicUrl(req, req.file.filename) : null,
    });
    const populated = await outfit.populate('itemIds');

    res.status(201).json({ outfit: populated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save outfit', detail: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  const outfit = await Outfit.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  if (!outfit) return res.status(404).json({ error: 'Outfit not found' });
  res.json({ success: true });
});

export default router;
