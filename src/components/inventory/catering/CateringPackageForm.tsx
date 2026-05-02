'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { upsertCateringPackage } from '@/app/[locale]/dashboard/inventory/catering/actions'
import type { CateringPackageItem, CateringPackageRow } from '@/lib/supabase/custom-types'

interface MenuItem {
  slug: string
  name_ar: string
  name_en: string
}

interface Props {
  mode:      'create' | 'edit'
  package?:  CateringPackageRow
  branchId:  string
  menuItems: MenuItem[]
  prefix:    string
  isAr?:     boolean
}

export default function CateringPackageForm({
  mode,
  package: pkgData,
  branchId,
  menuItems,
  prefix,
  isAr = true,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [nameAr, setNameAr]     = useState(pkgData?.name_ar ?? '')
  const [nameEn, setNameEn]     = useState(pkgData?.name_en ?? '')
  const [descAr, setDescAr]     = useState(pkgData?.description_ar ?? '')
  const [descEn, setDescEn]     = useState(pkgData?.description_en ?? '')
  const [pricePerPerson, setPricePerPerson] = useState<number>(Number(pkgData?.price_per_person_bhd ?? 0))
  const [minGuests, setMinGuests] = useState<number>(pkgData?.min_guests ?? 10)
  const [maxGuests, setMaxGuests] = useState<number | ''>(pkgData?.max_guests ?? '')
  const [isActive, setIsActive] = useState<boolean>(pkgData?.is_active ?? true)
  const [items, setItems] = useState<CateringPackageItem[]>(
    (pkgData?.items ?? []) as CateringPackageItem[],
  )

  // Item builder
  const [selectedSlug, setSelectedSlug] = useState('')
  const [qtyPerPerson, setQtyPerPerson] = useState<number>(1)

  function addItem() {
    const menuItem = menuItems.find((m) => m.slug === selectedSlug)
    if (!menuItem) return
    if (items.some((i) => i.menu_item_slug === selectedSlug)) return
    setItems((prev) => [
      ...prev,
      {
        menu_item_slug: menuItem.slug,
        qty_per_person: qtyPerPerson,
        name_ar:        menuItem.name_ar,
        name_en:        menuItem.name_en,
      },
    ])
    setSelectedSlug('')
    setQtyPerPerson(1)
  }

  function removeItem(slug: string) {
    setItems((prev) => prev.filter((i) => i.menu_item_slug !== slug))
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await upsertCateringPackage({
        id:                   mode === 'edit' ? pkgData?.id : undefined,
        branch_id:            branchId,
        name_ar:              nameAr,
        name_en:              nameEn,
        description_ar:       descAr || null,
        description_en:       descEn || null,
        price_per_person_bhd: pricePerPerson,
        min_guests:           minGuests,
        max_guests:           maxGuests === '' ? null : (maxGuests as number),
        items,
        is_active:            isActive,
      })

      if (result.error) {
        setError(result.error)
      } else {
        router.push(`${prefix}/dashboard/inventory/catering/packages`)
      }
    })
  }

  const inputClass =
    'w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2.5 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none'
  const labelClass = 'font-satoshi text-xs text-brand-muted uppercase tracking-wide'

  return (
    <div className="bg-brand-surface border border-brand-border rounded-xl p-6 flex flex-col gap-5 max-w-lg w-full">

      {/* Names */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'الاسم بالعربي *' : 'Name (AR) *'}</label>
          <input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            className={inputClass}
            dir="rtl"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'الاسم بالإنجليزي *' : 'Name (EN) *'}</label>
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
        </div>
      </div>

      {/* Descriptions */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'الوصف بالعربي' : 'Description (AR)'}</label>
          <textarea
            value={descAr}
            onChange={(e) => setDescAr(e.target.value)}
            className={inputClass}
            rows={2}
            dir="rtl"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'الوصف بالإنجليزي' : 'Description (EN)'}</label>
          <textarea
            value={descEn}
            onChange={(e) => setDescEn(e.target.value)}
            className={inputClass}
            rows={2}
            dir="ltr"
          />
        </div>
      </div>

      {/* Price */}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>{isAr ? 'السعر للشخص (BD) *' : 'Price per Person (BD) *'}</label>
        <input
          value={pricePerPerson}
          onChange={(e) => setPricePerPerson(Number(e.target.value))}
          className={inputClass}
          type="number"
          min={0}
          step={0.001}
          dir="ltr"
        />
      </div>

      {/* Guests */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'الحد الأدنى للضيوف' : 'Min Guests'}</label>
          <input
            value={minGuests}
            onChange={(e) => setMinGuests(Number(e.target.value))}
            className={inputClass}
            type="number"
            min={1}
            dir="ltr"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className={labelClass}>{isAr ? 'الحد الأقصى للضيوف' : 'Max Guests'}</label>
          <input
            value={maxGuests}
            onChange={(e) =>
              setMaxGuests(e.target.value === '' ? '' : Number(e.target.value))
            }
            className={inputClass}
            type="number"
            min={1}
            dir="ltr"
            placeholder={isAr ? 'اختياري' : 'Optional'}
          />
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
            isActive ? 'bg-brand-gold' : 'bg-brand-surface-2'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-brand-text transition-transform ${
              isActive ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="font-satoshi text-sm text-brand-text">
          {isAr
            ? isActive ? 'نشطة' : 'غير نشطة'
            : isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Items builder */}
      <div className="flex flex-col gap-3 pt-2 border-t border-brand-border">
        <p className={labelClass}>{isAr ? 'أصناف الباقة' : 'Package Items'}</p>

        <div className="flex items-center gap-2">
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="flex-1 rounded-lg border border-brand-border bg-brand-surface px-3 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
          >
            <option value="">{isAr ? '— اختر صنفاً —' : '— Select item —'}</option>
            {menuItems.map((item) => (
              <option key={item.slug} value={item.slug}>
                {isAr ? item.name_ar : item.name_en}
              </option>
            ))}
          </select>

          <input
            value={qtyPerPerson}
            onChange={(e) => setQtyPerPerson(Number(e.target.value))}
            type="number"
            min={0.1}
            step={0.1}
            className="w-20 rounded-lg border border-brand-border bg-brand-surface px-2 py-2 font-satoshi text-sm text-brand-text focus:border-brand-gold focus:outline-none"
            dir="ltr"
            title={isAr ? 'الكمية لكل شخص' : 'Qty per person'}
          />
          <span className="font-satoshi text-xs text-brand-muted whitespace-nowrap">
            /{isAr ? 'شخص' : 'pp'}
          </span>

          <button
            type="button"
            onClick={addItem}
            disabled={!selectedSlug || qtyPerPerson <= 0}
            className="rounded-lg bg-brand-gold px-3 py-2 font-satoshi text-sm font-bold text-brand-black hover:bg-brand-goldLight disabled:opacity-50 transition-colors"
          >
            {isAr ? 'إضافة' : 'Add'}
          </button>
        </div>

        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <div
                key={item.menu_item_slug}
                className="flex items-center gap-1.5 bg-brand-surface-2 border border-brand-border rounded-lg px-2.5 py-1.5"
              >
                <span className="font-satoshi text-xs text-brand-text">
                  {isAr ? item.name_ar : item.name_en}
                  <span className="text-brand-muted">
                    {' '}× {item.qty_per_person}/{isAr ? 'شخص' : 'pp'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.menu_item_slug)}
                  className="font-satoshi text-xs text-brand-muted hover:text-red-400 transition-colors leading-none"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="font-satoshi text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-brand-border">
        <button
          type="button"
          onClick={() => router.back()}
          className="font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors"
        >
          {isAr ? 'إلغاء' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !nameAr || !nameEn || pricePerPerson <= 0}
          className="rounded-lg bg-brand-gold px-4 py-2 font-satoshi text-sm font-bold text-brand-black hover:bg-brand-goldLight disabled:opacity-50 transition-colors"
        >
          {isPending
            ? (isAr ? 'جارٍ الحفظ...' : 'Saving...')
            : mode === 'create'
            ? (isAr ? 'إنشاء الباقة' : 'Create Package')
            : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
        </button>
      </div>
    </div>
  )
}
