export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-black px-4 sm:px-6 pt-8 pb-16 max-w-7xl mx-auto">
      {/* Page header skeleton */}
      <div className="mb-8">
        <div className="h-9 w-48 rounded-lg bg-brand-surface-2 animate-pulse mb-2" />
        <div className="h-4 w-64 rounded bg-brand-surface-2 animate-pulse" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 rounded-lg bg-brand-surface-2 animate-pulse shrink-0"
            style={{ width: `${60 + (i % 3) * 20}px`, animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="bg-brand-surface border border-brand-border rounded-lg overflow-hidden"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {/* Image placeholder */}
            <div className="aspect-square bg-brand-surface-2 animate-pulse" />
            {/* Content placeholder */}
            <div className="p-4 flex flex-col gap-2">
              <div className="h-5 w-3/4 rounded bg-brand-surface-2 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-brand-surface-2 animate-pulse" />
              <div className="mt-2 flex items-center justify-between">
                <div className="h-6 w-16 rounded bg-brand-surface-2 animate-pulse" />
                <div className="h-8 w-16 rounded-lg bg-brand-surface-2 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
