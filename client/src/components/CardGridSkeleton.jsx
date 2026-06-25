export default function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow overflow-hidden animate-pulse">
          <div className="w-full h-40 bg-slate-200" />
          <div className="p-3 space-y-2">
            <div className="h-3 bg-slate-200 rounded w-3/4" />
            <div className="h-2 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
