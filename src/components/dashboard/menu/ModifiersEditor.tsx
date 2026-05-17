'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import {
  listMenuOptionGroups,
  upsertMenuOptionGroup,
  deleteMenuOptionGroup,
  upsertMenuOption,
  deleteMenuOption,
  type MenuOptionGroupRow,
} from '@/app/[locale]/dashboard/menu/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { toast } from '@/lib/toast'

interface Props {
  menuItemSlug: string
  isAr?: boolean
}

export default function ModifiersEditor({ menuItemSlug, isAr = true }: Props) {
  const [groups, setGroups]   = useState<MenuOptionGroupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [groupToDelete, setGroupToDelete] = useState<MenuOptionGroupRow | null>(null)
  const [optionToDelete, setOptionToDelete] = useState<string | null>(null)

  // Ref always holds the latest groups state — avoids stale-closure bugs in
  // onBlur handlers that capture the group value at render time.
  const groupsRef = useRef<MenuOptionGroupRow[]>(groups)
  useEffect(() => { groupsRef.current = groups }, [groups])

  async function reload() {
    setLoading(true)
    const res = await listMenuOptionGroups(menuItemSlug)
    if (res.success && res.groups) {
      setGroups(res.groups)
    } else if (res.error) {
      toast.error(res.error)
    }
    setLoading(false)
  }

  useEffect(() => {
    void reload()
  // reload is intentionally stable — menuItemSlug is the only real dep
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItemSlug])

  async function addGroup() {
    setBusy(true)
    const res = await upsertMenuOptionGroup({
      menu_item_slug: menuItemSlug,
      name_ar:        isAr ? 'مجموعة جديدة' : 'New group',
      name_en:        'New group',
      required:       false,
      multi_select:   false,
      sort_order:     groupsRef.current.length,
    })
    setBusy(false)
    if (res.success) {
      await reload()
      if (res.id) setOpenIds((s) => new Set(s).add(res.id!))
    } else {
      toast.error(res.error ?? 'Error')
    }
  }

  /** Save a group by reading the LATEST state from the ref to avoid stale closures. */
  async function saveGroupById(id: string) {
    const g = groupsRef.current.find((x) => x.id === id)
    if (!g) return
    setBusy(true)
    const res = await upsertMenuOptionGroup({
      id:             g.id,
      menu_item_slug: g.menu_item_slug,
      name_ar:        g.name_ar,
      name_en:        g.name_en,
      required:       g.required,
      multi_select:   g.multi_select,
      sort_order:     g.sort_order,
    })
    setBusy(false)
    if (res.success) {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
    } else {
      toast.error(res.error ?? 'Error')
    }
  }

  function removeGroup(g: MenuOptionGroupRow) {
    setGroupToDelete(g)
  }

  async function confirmRemoveGroup() {
    const g = groupToDelete
    if (!g) return
    setGroupToDelete(null)
    setBusy(true)
    const res = await deleteMenuOptionGroup(g.id, menuItemSlug)
    setBusy(false)
    if (res.success) {
      await reload()
    } else {
      toast.error(res.error ?? 'Error')
    }
  }

  async function addOption(g: MenuOptionGroupRow) {
    setBusy(true)
    const res = await upsertMenuOption({
      group_id:       g.id,
      name_ar:        isAr ? 'خيار جديد' : 'New option',
      name_en:        'New option',
      price_modifier: 0,
      is_available:   true,
      sort_order:     g.options.length,
    })
    setBusy(false)
    if (res.success) {
      await reload()
    } else {
      toast.error(res.error ?? 'Error')
    }
  }

  /** Save an option by reading the LATEST state from the ref. */
  async function saveOptionById(groupId: string, optionId: string) {
    const g = groupsRef.current.find((x) => x.id === groupId)
    const o = g?.options.find((x) => x.id === optionId)
    if (!o) return
    setBusy(true)
    const res = await upsertMenuOption({
      id:             o.id,
      group_id:       o.group_id,
      name_ar:        o.name_ar,
      name_en:        o.name_en,
      price_modifier: o.price_modifier,
      is_available:   o.is_available,
      sort_order:     o.sort_order,
    })
    setBusy(false)
    if (res.success) {
      toast.success(isAr ? 'تم الحفظ' : 'Saved')
    } else {
      toast.error(res.error ?? 'Error')
    }
  }

  function removeOption(optionId: string) {
    setOptionToDelete(optionId)
  }

  async function confirmRemoveOption() {
    const id = optionToDelete
    if (!id) return
    setOptionToDelete(null)
    setBusy(true)
    const res = await deleteMenuOption(id)
    setBusy(false)
    if (res.success) {
      await reload()
    } else {
      toast.error(res.error ?? 'Error')
    }
  }

  function patchGroup(id: string, patch: Partial<MenuOptionGroupRow>) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  function patchOption(
    groupId:  string,
    optionId: string,
    patch:    Partial<MenuOptionGroupRow['options'][number]>,
  ) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId ? g : {
          ...g,
          options: g.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
        },
      ),
    )
  }

  function toggleOpen(id: string) {
    setOpenIds((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-brand-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">
          {isAr
            ? 'أضف مجموعات اختيار (مثل: الحجم، الإضافات) ليختار الزبون من الخيارات.'
            : 'Add option groups (size, add-ons) for the customer to choose from.'}
        </p>
        <Button type="button" size="sm" onClick={addGroup} disabled={busy} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {isAr ? 'مجموعة' : 'Group'}
        </Button>
      </div>

      {groups.length === 0 && (
        <p className="rounded-md border border-dashed border-brand-border bg-brand-surface-2 px-3 py-6 text-center text-sm text-brand-muted">
          {isAr ? 'لا توجد مجموعات معدّلات.' : 'No modifier groups yet.'}
        </p>
      )}

      {groups.map((g) => {
        const isOpen = openIds.has(g.id)
        return (
          <div key={g.id} className="rounded-md border border-brand-border bg-brand-surface-2">
            {/* Group header */}
            <div className="flex items-start gap-2 p-3">
              <button
                type="button"
                onClick={() => toggleOpen(g.id)}
                className="mt-2 text-brand-muted hover:text-brand-text"
                aria-label={isOpen ? 'collapse' : 'expand'}
              >
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">{isAr ? 'الاسم (عربي)' : 'Name (AR)'}</Label>
                  <Input
                    value={g.name_ar}
                    onChange={(e) => patchGroup(g.id, { name_ar: e.target.value })}
                    onBlur={() => void saveGroupById(g.id)}
                    maxLength={120}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{isAr ? 'الاسم (إنجليزي)' : 'Name (EN)'}</Label>
                  <Input
                    value={g.name_en}
                    onChange={(e) => patchGroup(g.id, { name_en: e.target.value })}
                    onBlur={() => void saveGroupById(g.id)}
                    maxLength={120}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-brand-muted">
                  <input
                    type="checkbox"
                    checked={g.required}
                    onChange={(e) => {
                      patchGroup(g.id, { required: e.target.checked })
                      void saveGroupById(g.id)
                    }}
                  />
                  {isAr ? 'إلزامي' : 'Required'}
                </label>
                <label className="flex items-center gap-2 text-xs text-brand-muted">
                  <input
                    type="checkbox"
                    checked={g.multi_select}
                    onChange={(e) => {
                      patchGroup(g.id, { multi_select: e.target.checked })
                      void saveGroupById(g.id)
                    }}
                  />
                  {isAr ? 'اختيار متعدد' : 'Multi-select'}
                </label>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-brand-muted hover:text-red-500"
                onClick={() => void removeGroup(g)}
                disabled={busy}
                aria-label="delete-group"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Options */}
            {isOpen && (
              <div className="border-t border-brand-border bg-brand-surface px-3 py-2">
                {g.options.length === 0 && (
                  <p className="py-2 text-center text-xs text-brand-muted">
                    {isAr ? 'لا توجد خيارات بعد' : 'No options yet'}
                  </p>
                )}
                {g.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 py-1">
                    <Input
                      value={o.name_ar}
                      onChange={(e) => patchOption(g.id, o.id, { name_ar: e.target.value })}
                      onBlur={() => void saveOptionById(g.id, o.id)}
                      placeholder={isAr ? 'عربي' : 'AR'}
                      className="font-almarai"
                      maxLength={120}
                    />
                    <Input
                      value={o.name_en}
                      onChange={(e) => patchOption(g.id, o.id, { name_en: e.target.value })}
                      onBlur={() => void saveOptionById(g.id, o.id)}
                      placeholder="EN"
                      maxLength={120}
                    />
                    <Input
                      type="number"
                      step="0.001"
                      value={o.price_modifier}
                      onChange={(e) =>
                        patchOption(g.id, o.id, { price_modifier: Number(e.target.value) || 0 })
                      }
                      onBlur={() => void saveOptionById(g.id, o.id)}
                      className="w-24 tabular-nums text-end"
                      placeholder="+0.000"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-brand-muted hover:text-red-500"
                      onClick={() => void removeOption(o.id)}
                      disabled={busy}
                      aria-label="delete-option"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void addOption(g)}
                  disabled={busy}
                  className="mt-2 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  {isAr ? 'خيار' : 'Option'}
                </Button>
              </div>
            )}
          </div>
        )
      })}

      <ConfirmModal
        isOpen={groupToDelete !== null}
        message={
          groupToDelete
            ? isAr
              ? `حذف "${groupToDelete.name_ar}"؟`
              : `Delete "${groupToDelete.name_en}"?`
            : ''
        }
        variant="danger"
        onConfirm={() => void confirmRemoveGroup()}
        onCancel={() => setGroupToDelete(null)}
      />

      <ConfirmModal
        isOpen={optionToDelete !== null}
        message={isAr ? 'حذف هذا الخيار؟' : 'Delete this option?'}
        variant="danger"
        onConfirm={() => void confirmRemoveOption()}
        onCancel={() => setOptionToDelete(null)}
      />
    </div>
  )
}
