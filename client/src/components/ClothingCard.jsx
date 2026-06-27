import { Pencil, Sparkles, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ClothingCard({ item, onDelete, onEdit, selectable, selected, onToggleSelect, processing }) {
  return (
    <Card
      className={`overflow-hidden border-2 transition relative ${
        selected ? 'border-indigo-500' : 'border-transparent'
      } ${selectable ? 'cursor-pointer' : ''}`}
      onClick={selectable ? () => onToggleSelect(item) : undefined}
    >
      <div className="w-full h-40 bg-muted flex items-center justify-center overflow-hidden">
        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
      </div>

      {processing && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" /> Processing…
          </Badge>
        </div>
      )}
      {!processing && item.tryOnAssetUrl && (
        <div className="absolute top-2 right-2">
          <Badge variant="success" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" /> AR ready
          </Badge>
        </div>
      )}

      <CardContent className="p-3">
        <p className="font-medium truncate">{item.name}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          <Badge variant="outline" className="text-xs capitalize">{item.category}</Badge>
          {item.color && <Badge variant="outline" className="text-xs capitalize">{item.color}</Badge>}
        </div>
        {item.seasons?.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">{item.seasons.join(', ')}</p>
        )}
        <div className="flex gap-1 mt-2">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => { e.stopPropagation(); onEdit(item); }}
              aria-label="Edit item"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(item._id); }}
              aria-label="Delete item"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
