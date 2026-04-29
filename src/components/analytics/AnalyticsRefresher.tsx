'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Silently re-runs the server component every 30 seconds
export default function AnalyticsRefresher() {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(id)
  }, [router])

  return null
}
