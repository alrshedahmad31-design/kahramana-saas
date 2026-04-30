'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

interface Props {
  intervalMs?: number
}

export default function AutoRefresh({ intervalMs = 30_000 }: Props) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
