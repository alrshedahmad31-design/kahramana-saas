export default function CouponsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-brand-surface-2 rounded-lg" />
        <div className="h-9 w-40 bg-brand-surface-2 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-3">
            <div className="h-4 w-1/2 bg-brand-surface-2 rounded" />
            <div className="h-6 w-3/4 bg-brand-surface-2 rounded" />
            <div className="h-3 w-2/3 bg-brand-surface-2 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}
