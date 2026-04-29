export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 bg-brand-surface-2 rounded-lg" />
          <div className="h-4 w-48 bg-brand-surface-2 rounded-lg" />
        </div>
        <div className="h-9 w-64 bg-brand-surface-2 rounded-lg" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-3">
            <div className="h-3 w-24 bg-brand-surface-2 rounded" />
            <div className="h-8 w-28 bg-brand-surface-2 rounded" />
            <div className="h-3 w-16 bg-brand-surface-2 rounded" />
          </div>
        ))}
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-xl p-5">
        <div className="h-4 w-32 bg-brand-surface-2 rounded mb-5" />
        <div className="h-[220px] bg-brand-surface-2 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-5">
            <div className="h-4 w-36 bg-brand-surface-2 rounded mb-5" />
            <div className="h-[240px] bg-brand-surface-2 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
