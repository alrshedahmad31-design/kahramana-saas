export default function MenuLoading() {
  return (
    <main className="min-h-screen bg-brand-black ps-4 pe-4 pt-24 pb-16 sm:ps-6 sm:pe-6">
      <div className="mx-auto max-w-7xl">
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-brand-surface-2 sm:w-1/3" />
        <div className="mt-5 h-28 animate-pulse rounded-lg bg-brand-surface" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[420px] animate-pulse rounded-lg border border-brand-border bg-brand-surface"
            />
          ))}
        </div>
      </div>
    </main>
  )
}
