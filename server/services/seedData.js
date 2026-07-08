import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import ClothingItem from '../models/ClothingItem.js';

export const DEMO_EMAIL = 'demo@demo.com';
export const DEMO_PASSWORD = 'demo1234';

// Real garment photos (user-provided) processed into AR-ready transparent PNGs.
const DEMO_ITEMS = [
  { name: 'Navy T-Shirt',  category: 'top',    color: 'blue',  warmth: 2, seasons: ['summer', 'spring'],           asset: 'tshirt-blue.png' },
  { name: 'White T-Shirt', category: 'top',    color: 'white', warmth: 1, seasons: ['summer'],                     asset: 'tshirt-white.png' },
  { name: 'Black T-Shirt', category: 'top',    color: 'black', warmth: 2, seasons: ['summer', 'spring', 'autumn'], asset: 'tshirt-black.png' },
  { name: 'Blue Jeans',    category: 'bottom', color: 'blue',  warmth: 3, seasons: ['autumn', 'spring', 'winter'], asset: 'jeans-blue.png' },
  { name: 'Black Jeans',   category: 'bottom', color: 'black', warmth: 3, seasons: ['autumn', 'spring', 'winter'], asset: 'jeans-black.png' },
];

// Seeds a demo account with a ready-to-go, AR-ready wardrobe on first boot.
// Only runs when the database has no users at all, so it never touches real user data
// and never re-seeds on every restart.
export async function seedIfEmpty() {
  const userCount = await User.countDocuments();
  if (userCount > 0) return;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const demoUser = await User.create({
    name: 'Demo User',
    email: DEMO_EMAIL,
    passwordHash,
    preferences: { styles: ['casual'], favoriteColors: ['blue', 'black'], avoidColors: [] },
  });

  await ClothingItem.insertMany(
    DEMO_ITEMS.map((item) => {
      const url = `/assets/${item.asset}`;
      return {
        userId: demoUser._id,
        name: item.name,
        category: item.category,
        color: item.color,
        warmth: item.warmth,
        seasons: item.seasons,
        imageUrl: url,
        tryOnAssetUrl: url, // SVGs are already transparent - usable directly as AR overlay assets
      };
    })
  );

  console.log(`[seed] Created demo account ${DEMO_EMAIL} / ${DEMO_PASSWORD} with ${DEMO_ITEMS.length} wardrobe items.`);
}
