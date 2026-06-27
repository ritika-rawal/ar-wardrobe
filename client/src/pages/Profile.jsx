import { useState } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function Profile() {
  const toast = useToast();
  const { user, updateUser } = useAuth();
  const [styles, setStyles] = useState((user?.preferences?.styles || []).join(', '));
  const [favoriteColors, setFavoriteColors] = useState(
    (user?.preferences?.favoriteColors || []).join(', ')
  );
  const [avoidColors, setAvoidColors] = useState((user?.preferences?.avoidColors || []).join(', '));
  const [saving, setSaving] = useState(false);

  function toList(s) {
    return s
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/me/preferences', {
        preferences: {
          styles: toList(styles),
          favoriteColors: toList(favoriteColors),
          avoidColors: toList(avoidColors),
        },
      });
      updateUser(res.data.user);
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      <h1 className="text-2xl font-medium mb-1">Profile</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {user?.name} &middot; {user?.email}
      </p>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">Style preferences</CardTitle>
          <CardDescription>
            These shape your outfit recommendations — favorite colors are boosted, avoided colors
            filtered, and styles matched to item tags.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="styles">Styles</Label>
              <Input
                id="styles"
                placeholder="casual, formal, sporty"
                value={styles}
                onChange={(e) => setStyles(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fav-colors">Favorite colors</Label>
              <Input
                id="fav-colors"
                placeholder="black, navy, white"
                value={favoriteColors}
                onChange={(e) => setFavoriteColors(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avoid-colors">Colors to avoid</Label>
              <Input
                id="avoid-colors"
                placeholder="orange, neon green"
                value={avoidColors}
                onChange={(e) => setAvoidColors(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save preferences'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
