import mongoose from 'mongoose';

const lookbookSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    outfitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Outfit', required: true },
    caption: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Lookbook', lookbookSchema);
