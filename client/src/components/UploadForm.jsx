import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add clothing item</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input type="file" accept="image/*" onChange={handleFileChange} required />
          <p className="text-xs text-muted-foreground">
            A front-facing photo on a plain background works best — background is removed automatically.
          </p>
          {preview && <img src={preview} alt="preview" className="h-24 object-cover rounded" />}

          <Input
            type="text"
            placeholder="Name (e.g. Blue denim jacket)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="flex gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="text"
              placeholder="Color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Warmth: {warmth}/5</Label>
            <Slider
              min={1} max={5} step={1}
              value={[warmth]}
              onValueChange={([v]) => setWarmth(v)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {SEASONS.map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <Checkbox
                  id={`season-upload-${s}`}
                  checked={seasons.includes(s)}
                  onCheckedChange={() => toggleSeason(s)}
                />
                <Label htmlFor={`season-upload-${s}`} className="capitalize text-sm font-normal">{s}</Label>
              </div>
            ))}
          </div>

          <Button type="submit" disabled={busy} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {busy ? 'Uploading…' : 'Add to closet'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
