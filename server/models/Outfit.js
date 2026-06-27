import mongoose from 'mongoose';

const outfitSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ClothingItem' }],
    snapshotUrl: { type: String, default: null },
    worn: { type: Boolean, default: false },
    wornAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Outfit', outfitSchema);
