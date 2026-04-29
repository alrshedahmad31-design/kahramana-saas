export default function KDSLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 bg-brand-surface-2 rounded-lg" />
        <div className="h-9 w-48 bg-brand-surface-2 rounded-lg" />
      </div>

      {/* Station tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 bg-brand-surface-2 rounded-lg" />
        ))}
      </div>

      {/* KDS cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-brand-surface-2 rounded" />
              <div className="h-5 w-14 bg-brand-surface-2 rounded-full" />
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-3 bg-brand-surface-2 rounded" style={{ width: `${70 + j * 8}%` }} />
              ))}
            </div>
            <div className="h-8 bg-brand-surface-2 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
