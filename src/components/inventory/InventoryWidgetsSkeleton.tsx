export default function InventoryWidgetsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="rounded-xl border border-brand-border bg-brand-surface p-4 h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-brand-border bg-brand-surface h-52" />
        ))}
      </div>
    </div>
  )
}
