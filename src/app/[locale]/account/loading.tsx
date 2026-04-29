export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-brand-black px-4 sm:px-6 pt-8 pb-16 max-w-lg mx-auto">
      <div className="mb-6">
        <div className="h-8 w-36 rounded-lg bg-brand-surface-2 animate-pulse mb-2" />
        <div className="h-4 w-48 rounded bg-brand-surface-2 animate-pulse" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-brand-surface-2 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
