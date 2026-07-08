import mongoose from 'mongoose';

// Binary image storage in MongoDB so uploads survive restarts/redeploys on hosts
// with ephemeral disks (Render free tier, etc.). Each doc is one uploaded image;
// it is served back out via GET /uploads/:id (see routes/uploads.js).
const uploadedImageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('UploadedImage', uploadedImageSchema);
