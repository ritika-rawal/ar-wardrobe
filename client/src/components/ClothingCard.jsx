export default function ClothingCard({ item, onDelete, onEdit, selectable, selected, onToggleSelect, processing }) {
  return (
    <div
      className={`bg-white rounded-lg shadow overflow-hidden border-2 transition relative ${
        selected ? 'border-indigo-500' : 'border-transparent'
      } ${selectable ? 'cursor-pointer' : ''}`}
      onClick={selectable ? () => onToggleSelect(item) : undefined}
    >
      <div className="w-full h-40 bg-slate-100 flex items-center justify-center overflow-hidden">
        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
      </div>
      {processing && (
        <div className="absolute top-1 right-1 bg-slate-900/80 text-white text-xs px-2 py-1 rounded">
          ✨ Preparing AR cutout...
        </div>
      )}
      {!processing && item.tryOnAssetUrl && (
        <div className="absolute top-1 right-1 bg-green-600/90 text-white text-xs px-2 py-1 rounded">
          AR ready
        </div>
      )}
      <div className="p-3">
        <p className="font-medium truncate">{item.name}</p>
        <p className="text-xs text-slate-500 capitalize">
          {item.category} · {item.color || 'no color'} · warmth {item.warmth}/5
        </p>
        {item.seasons?.length > 0 && (
          <p className="text-xs text-slate-400">{item.seasons.join(', ')}</p>
        )}
        <div className="flex gap-3 mt-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
              className="min-h-[36px] text-sm text-indigo-600 hover:underline"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item._id);
              }}
              className="min-h-[36px] text-sm text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
