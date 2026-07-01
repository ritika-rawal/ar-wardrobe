import express from 'express';
import mongoose from 'mongoose';
import UploadedImage from '../models/UploadedImage.js';

const router = express.Router();

// Persist a multer in-memory file as an UploadedImage doc and return its public
// (relative) URL. Relative so it resolves against whatever host serves the app,
// which keeps single-origin deploys and local dev both working.
export async function persistUpload(userId, file) {
  const doc = await UploadedImage.create({
    userId,
    contentType: file.mimetype || 'application/octet-stream',
    data: file.buffer,
  });
  return `/uploads/${doc._id}`;
}

// Public read endpoint used directly in <img src> and AR canvas draws, so no auth:
// these URLs are already effectively public (same as the old static file serving).
router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).end();
  }
  const img = await UploadedImage.findById(req.params.id);
  if (!img) return res.status(404).end();

  res.set('Content-Type', img.contentType);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(img.data);
});

export default router;
