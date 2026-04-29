export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-brand-black px-4 sm:px-6 pt-8 pb-16 max-w-2xl mx-auto">
      <div className="h-8 w-32 rounded-lg bg-brand-surface-2 animate-pulse mb-8" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-brand-surface-2 animate-pulse"
            style={{ animationDelay: `${i * 70}ms` }}
          />
        ))}
        <div className="h-12 w-full rounded-xl bg-brand-surface-2 animate-pulse mt-4" />
      </div>
    </div>
  )
}
