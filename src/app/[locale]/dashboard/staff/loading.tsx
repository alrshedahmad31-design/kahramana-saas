export default function StaffLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-brand-surface-2 rounded-lg" />
          <div className="h-4 w-48 bg-brand-surface-2 rounded" />
        </div>
        <div className="h-10 w-36 bg-brand-surface-2 rounded-lg" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-4 space-y-2">
            <div className="h-3 w-20 bg-brand-surface-2 rounded" />
            <div className="h-7 w-12 bg-brand-surface-2 rounded" />
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-brand-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 bg-brand-surface-2 rounded" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 px-4 py-4 border-b border-brand-border last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-surface-2 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-3 w-20 bg-brand-surface-2 rounded" />
                <div className="h-2.5 w-28 bg-brand-surface-2 rounded" />
              </div>
            </div>
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-4 bg-brand-surface-2 rounded self-center" style={{ width: `${50 + j * 10}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
