export default function ScheduleLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-brand-surface-2 rounded-lg" />
          <div className="h-4 w-56 bg-brand-surface-2 rounded-lg" />
        </div>
      </div>

      {/* Week nav */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-brand-surface-2 rounded-lg" />
        <div className="h-5 w-48 bg-brand-surface-2 rounded" />
        <div className="h-9 w-9 bg-brand-surface-2 rounded-lg" />
      </div>

      {/* Schedule grid */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-4 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-8 gap-2 mb-3">
          <div className="h-4 w-16 bg-brand-surface-2 rounded" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-8 bg-brand-surface-2 rounded-lg" />
          ))}
        </div>
        {/* Staff rows */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-8 gap-2 mb-2">
            <div className="h-10 bg-brand-surface-2 rounded" />
            {Array.from({ length: 7 }).map((_, j) => (
              <div key={j} className={`h-10 rounded ${j % 3 === 0 ? 'bg-brand-gold/10 border border-brand-gold/20' : 'bg-brand-surface-2'}`} />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 w-24 bg-brand-surface-2 rounded" />
        ))}
      </div>
    </div>
  )
}
