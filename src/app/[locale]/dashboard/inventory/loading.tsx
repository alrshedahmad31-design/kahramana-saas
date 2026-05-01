export default function Loading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-64 bg-brand-surface-2 rounded-lg" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-brand-surface-2 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-brand-surface-2 rounded-xl" />
    </div>
  )
}
