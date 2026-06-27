import express from 'express';
import ClothingItem from '../models/ClothingItem.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { geocodeCity, getCurrentWeather } from '../services/weatherService.js';
import { recommendOutfits } from '../services/recommendService.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/recommend?lat=..&lon=..  OR  ?city=..
router.get('/', async (req, res) => {
  try {
    const { lat, lon, city, occasion } = req.query;

    let coords;
    let locationLabel;
    if (lat && lon) {
      coords = { lat: Number(lat), lon: Number(lon) };
      locationLabel = 'your location';
    } else if (city) {
      const place = await geocodeCity(city);
      coords = { lat: place.lat, lon: place.lon };
      locationLabel = place.label;
    } else {
      return res.status(400).json({ error: 'Provide lat & lon, or city' });
    }

    const weather = await getCurrentWeather(coords);
    const wardrobe = await ClothingItem.find({ userId: req.userId }).lean();
    const user = await User.findById(req.userId).lean();

    if (wardrobe.length === 0) {
      return res.json({
        location: locationLabel,
        weather,
        outfits: [],
        message: 'Your closet is empty — add some clothing items to get outfit recommendations.',
      });
    }

    const { weatherSummary, outfits } = recommendOutfits({
      wardrobe,
      weather,
      preferences: user?.preferences || {},
      occasion: occasion || '',
    });

    if (outfits.length === 0) {
      return res.json({
        location: locationLabel,
        weather: weatherSummary,
        outfits: [],
        message: 'Not enough variety in your closet yet — add at least one top and one bottom.',
      });
    }

    res.json({ location: locationLabel, weather: weatherSummary, outfits });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build recommendations', detail: err.message });
  }
});

export default router;
