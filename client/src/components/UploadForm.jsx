import { useState } from 'react';

const CATEGORIES = ['top', 'bottom', 'outerwear', 'shoes', 'accessory'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

export default function UploadForm({ onSubmit, busy }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('top');
  const [color, setColor] = useState('');
  const [warmth, setWarmth] = useState(3);
  const [seasons, setSeasons] = useState([]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  function toggleSeason(s) {
    setSeasons((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function handleFileChange(e) {
    const f = e.target.files[0];
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    formData.append('name', name);
    formData.append('category', category);
    formData.append('color', color);
    formData.append('warmth', warmth);
    formData.append('seasons', seasons.join(','));

    await onSubmit(formData);
    setName('');
    setColor('');
    setWarmth(3);
    setSeasons([]);
    setFile(null);
    setPreview(null);
    e.target.reset?.();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow space-y-3">
      <h2 className="font-semibold">Add clothing item</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} required />
      <p className="text-xs text-slate-500">
        For the best AR try-on fit: a front-facing, centered photo (flat-lay or worn) on a plain
        background works best — the background is removed automatically.
      </p>
      {preview && <img src={preview} alt="preview" className="h-24 object-cover rounded" />}
      <input
        type="text"
        placeholder="Name (e.g. Blue denim jacket)"
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
          onChange={(e) => setWarmth(e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {SEASONS.map((s) => (
          <label key={s} className="flex items-center gap-1 capitalize">
            <input type="checkbox" checked={seasons.includes(s)} onChange={() => toggleSeason(s)} />
            {s}
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded disabled:opacity-50"
      >
        {busy ? 'Uploading...' : 'Add to closet'}
      </button>
    </form>
  );
}
