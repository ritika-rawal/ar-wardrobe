import mongoose from 'mongoose';

const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const clothingItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true },
    color: { type: String, default: '' },
    seasons: { type: [String], enum: SEASONS, default: [] },
    warmth: { type: Number, min: 1, max: 5, default: 3 }, // 1 = very light, 5 = very warm
    imageUrl: { type: String, required: true }, // original uploaded photo
    tryOnAssetUrl: { type: String, default: null }, // transparent PNG used by AR overlay
    tags: { type: [String], default: [] },
    autoTagged: { type: Boolean, default: false },
    styleTags: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const CLOTHING_CATEGORIES = CATEGORIES;
export const CLOTHING_SEASONS = SEASONS;
export default mongoose.model('ClothingItem', clothingItemSchema);
