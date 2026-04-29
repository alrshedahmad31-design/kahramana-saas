export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-brand-black px-4 sm:px-6 pt-8 pb-16 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="h-8 w-40 rounded-lg bg-brand-surface-2 animate-pulse mb-2" />
        <div className="h-4 w-56 rounded bg-brand-surface-2 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl bg-brand-surface-2 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
