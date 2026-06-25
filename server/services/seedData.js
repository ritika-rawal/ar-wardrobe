import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import ClothingItem from '../models/ClothingItem.js';

export const DEMO_EMAIL = 'demo@demo.com';
export const DEMO_PASSWORD = 'demo1234';

// Hand-drawn transparent SVGs in /assets - genuinely transparent, no upload/background-removal needed,
// so the AR try-on demo works perfectly on a totally fresh boot.
const DEMO_ITEMS = [
  { name: 'Blue T-Shirt', category: 'top', color: 'blue', warmth: 2, seasons: ['summer', 'spring'], asset: 'tshirt-blue.svg' },
  { name: 'White T-Shirt', category: 'top', color: 'white', warmth: 1, seasons: ['summer'], asset: 'tshirt-white.svg' },
  { name: 'Black T-Shirt', category: 'top', color: 'black', warmth: 2, seasons: ['summer', 'spring', 'autumn'], asset: 'tshirt-black.svg' },
  { name: 'Grey Hoodie', category: 'outerwear', color: 'grey', warmth: 4, seasons: ['autumn', 'winter'], asset: 'hoodie-grey.svg' },
  { name: 'Black Jacket', category: 'outerwear', color: 'black', warmth: 5, seasons: ['winter'], asset: 'jacket-black.svg' },
  { name: 'Blue Jeans', category: 'bottom', color: 'blue', warmth: 3, seasons: ['autumn', 'spring', 'winter'], asset: 'jeans-blue.svg' },
  { name: 'Grey Shorts', category: 'bottom', color: 'grey', warmth: 1, seasons: ['summer'], asset: 'shorts-grey.svg' },
  { name: 'White Sneakers', category: 'shoes', color: 'white', warmth: 3, seasons: [], asset: 'shoes-white.svg' },
];

// Seeds a demo account with a ready-to-go, AR-ready wardrobe on first boot.
// Only runs when the database has no users at all, so it never touches real user data
// and never re-seeds on every restart.
export async function seedIfEmpty(baseUrl) {
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
      const url = `${baseUrl}/assets/${item.asset}`;
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
