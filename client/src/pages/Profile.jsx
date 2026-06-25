import { useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Profile() {
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const [styles, setStyles] = useState((user?.preferences?.styles || []).join(', '));
  const [favoriteColors, setFavoriteColors] = useState(
    (user?.preferences?.favoriteColors || []).join(', ')
  );
  const [avoidColors, setAvoidColors] = useState((user?.preferences?.avoidColors || []).join(', '));

  function toList(s) {
    return s
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  }

  async function handleSave(e) {
    e.preventDefault();
    const res = await api.put('/auth/me/preferences', {
      preferences: {
        styles: toList(styles),
        favoriteColors: toList(favoriteColors),
        avoidColors: toList(avoidColors),
      },
    });
    updateUser(res.data.user);
    toast.success('Preferences saved');
  }

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-semibold mb-4">Preferences</h1>
      <p className="text-sm text-slate-500 mb-4">
        These shape your outfit recommendations — favorite colors are boosted, avoided colors are
        filtered down, and styles (matched to item tags) are preferred.
      </p>
      <form onSubmit={handleSave} className="space-y-3">
        <div>
          <label className="text-sm text-slate-600">Styles (comma separated)</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="casual, formal, sporty"
            value={styles}
            onChange={(e) => setStyles(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Favorite colors</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="black, navy, white"
            value={favoriteColors}
            onChange={(e) => setFavoriteColors(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-slate-600">Colors to avoid</label>
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="orange, neon green"
            value={avoidColors}
            onChange={(e) => setAvoidColors(e.target.value)}
          />
        </div>
        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded">
          Save preferences
        </button>
      </form>
    </div>
  );
}
