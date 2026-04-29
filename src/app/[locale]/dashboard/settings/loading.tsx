export default function SettingsLoading() {
  return (
    <div className="flex flex-col lg:flex-row gap-0 min-h-[calc(100vh-4rem)] animate-pulse">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:block w-64 shrink-0 bg-brand-surface border-e border-brand-border">
        <div className="px-4 pt-5 pb-3">
          <div className="h-8 bg-brand-surface-2 rounded-lg" />
        </div>
        <div className="px-3 pb-6 flex flex-col gap-5">
          {Array.from({ length: 4 }).map((_, g) => (
            <div key={g} className="flex flex-col gap-1">
              <div className="h-2.5 w-16 bg-brand-surface-2 rounded mb-2" />
              {Array.from({ length: g === 0 ? 2 : g === 1 ? 3 : 1 }).map((_, t) => (
                <div key={t} className="h-9 bg-brand-surface-2 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Content skeleton */}
      <main className="flex-1 min-w-0 p-6 lg:p-8 space-y-6">
        <div className="space-y-1">
          <div className="h-6 w-36 bg-brand-surface-2 rounded-lg" />
          <div className="h-4 w-52 bg-brand-surface-2 rounded" />
        </div>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 bg-brand-surface-2 rounded" />
              <div className="h-10 bg-brand-surface-2 rounded-lg" />
            </div>
          ))}
          <div className="h-10 w-32 bg-brand-surface-2 rounded-lg" />
        </div>
      </main>
    </div>
  )
}
