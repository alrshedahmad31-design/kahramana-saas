'use client'

import { useState } from 'react'
import { deleteMenuItem } from '@/app/[locale]/dashboard/menu/actions'
import { toast } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2 } from 'lucide-react'

interface DeleteTranslations {
  delete:                  string
  delete_item_title:       string
  delete_item_description: string
  cannot_undo:             string
  cancel:                  string
  delete_success:          string
  error:                   string
}

interface Props {
  id: string
  name: string
  translations: DeleteTranslations
}

export default function DeleteMenuItemConfirm({ id, name, translations: t }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await deleteMenuItem(id)
      if (res.success) {
        toast.success(t.delete_success)
        setOpen(false)
      } else {
        toast.error(res.error || t.error)
      }
    } catch {
      toast.error(t.error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.delete_item_title}</DialogTitle>
          <DialogDescription>
            {t.delete_item_description} <strong>{name}</strong>? {t.cannot_undo}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
            {t.cancel}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
