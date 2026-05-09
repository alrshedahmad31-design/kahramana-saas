'use client'

import { useState, useTransition } from 'react'
import { toggleMenuItemAvailability } from '@/app/[locale]/dashboard/menu/actions'
import { useTranslations } from 'next-intl'
import { toast } from '@/lib/toast'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

interface Props {
  slug:             string
  initialAvailable: boolean
  onSuccess?:       () => void
}

export default function AvailabilityToggle({ slug, initialAvailable, onSuccess }: Props) {
  const t = useTranslations('dashboard')
  const [isPending, startTransition] = useTransition()
  const [available, setAvailable]    = useState(initialAvailable)

  const handleToggle = (checked: boolean) => {
    setAvailable(checked) // optimistic
    startTransition(async () => {
      const result = await toggleMenuItemAvailability(slug, checked)
      if (result.success) {
        toast.success(checked ? t('item_available_toast') : t('item_out_of_stock_toast'))
        onSuccess?.()
      } else {
        setAvailable(!checked) // revert
        toast.error(t('update_failed_toast'))
      }
    })
  }

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      <Switch
        checked={available}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label={t('toggle_availability')}
      />
    </div>
  )
}
