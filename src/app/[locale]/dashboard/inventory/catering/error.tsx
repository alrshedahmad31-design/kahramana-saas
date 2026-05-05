'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <p className="text-brand-muted text-sm">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-xs font-bold text-brand-black bg-brand-gold rounded-full"
      >
        Try again
      </button>
    </div>
  )
}
