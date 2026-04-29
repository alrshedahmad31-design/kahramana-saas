export default function ReportsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-28 bg-brand-surface-2 rounded-lg" />
          <div className="h-4 w-44 bg-brand-surface-2 rounded-lg" />
        </div>
        <div className="h-9 w-64 bg-brand-surface-2 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-3">
            <div className="h-5 w-36 bg-brand-surface-2 rounded" />
            <div className="h-4 w-full bg-brand-surface-2 rounded" />
            <div className="h-4 w-3/4 bg-brand-surface-2 rounded" />
            <div className="flex gap-2 pt-2">
              <div className="h-9 w-24 bg-brand-surface-2 rounded-lg" />
              <div className="h-9 w-20 bg-brand-surface-2 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
