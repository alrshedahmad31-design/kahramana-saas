export default function OrdersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 bg-brand-surface-2 rounded-lg" />
        <div className="h-9 w-52 bg-brand-surface-2 rounded-lg" />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-2">
            <div className="h-3 w-20 bg-brand-surface-2 rounded" />
            <div className="h-6 w-16 bg-brand-surface-2 rounded" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 bg-brand-surface-2 rounded-lg" />
        ))}
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="flex flex-col gap-3">
            <div className="h-11 bg-brand-surface-2 rounded-xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-2">
                <div className="h-3 w-2/3 bg-brand-surface-2 rounded" />
                <div className="h-4 w-4/5 bg-brand-surface-2 rounded" />
                <div className="h-3 w-1/2 bg-brand-surface-2 rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
