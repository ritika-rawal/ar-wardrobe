import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Item name"
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
                  id={`season-edit-${s}`}
                  checked={seasons.includes(s)}
                  onCheckedChange={() => toggleSeason(s)}
                />
                <Label htmlFor={`season-edit-${s}`} className="capitalize text-sm font-normal">{s}</Label>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
