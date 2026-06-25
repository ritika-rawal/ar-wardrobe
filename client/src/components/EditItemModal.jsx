import { useState } from 'react';

const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export default function EditItemModal({ item, onSave, onClose }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [color, setColor] = useState(item.color || '');
  const [warmth, setWarmth] = useState(item.warmth);
  const [seasons, setSeasons] = useState(item.seasons || []);
  const [saving, setSaving] = useState(false);

  function toggleSeason(s) {
    setSeasons((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ name, category, color, warmth, seasons });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-5">
        <h2 className="text-lg font-semibold mb-3">Edit item</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <select
              className="border rounded px-3 py-2 flex-1"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Color"
              className="border rounded px-3 py-2 flex-1"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600">Warmth: {warmth}/5</label>
            <input
              type="range"
              min="1"
              max="5"
              value={warmth}
              onChange={(e) => setWarmth(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex gap-3 text-sm flex-wrap">
            {SEASONS.map((s) => (
              <label key={s} className="flex items-center gap-1 capitalize">
                <input type="checkbox" checked={seasons.includes(s)} onChange={() => toggleSeason(s)} />
                {s}
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
