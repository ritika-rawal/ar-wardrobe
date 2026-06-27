import express from 'express';
import Lookbook from '../models/Lookbook.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const pins = await Lookbook.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .populate({ path: 'outfitId', populate: { path: 'itemIds' } });
    res.json({ pins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load lookbook', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { outfitId, caption } = req.body;
    if (!outfitId) return res.status(400).json({ error: 'outfitId is required' });
    const pin = await Lookbook.create({ userId: req.userId, outfitId, caption: caption || '' });
    const populated = await pin.populate({ path: 'outfitId', populate: { path: 'itemIds' } });
    res.status(201).json({ pin: populated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to pin outfit', detail: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const pin = await Lookbook.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!pin) return res.status(404).json({ error: 'Pin not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unpin', detail: err.message });
  }
});

export default router;
