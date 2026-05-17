'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, X } from 'lucide-react'
import type { PromotionInput } from './actions'
import type { PromotionRow, PromotionType } from '@/lib/promotions/types'

interface BranchOption {
  id:     string
  nameAr: string
  nameEn: string
}

interface Props {
  existing:        PromotionRow | null
  branches:        BranchOption[]
  isGlobalAdmin:   boolean
  callerBranchId:  string | null
  locale:          'ar' | 'en'
  onCancel:        () => void
  onSubmit:        (input: PromotionInput) => Promise<void>
}

const TYPES: PromotionType[] = ['bogo', 'bundle', 'time_discount', 'item_discount', 'spend_discount']
const DAY_LABELS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function PromotionForm({
  existing, branches, isGlobalAdmin, callerBranchId, locale, onCancel, onSubmit,
}: Props) {
  const t = useTranslations('promotions')
  const isAr = locale === 'ar'

  const [nameAr, setNameAr]   = useState(existing?.name_ar ?? '')
  const [nameEn, setNameEn]   = useState(existing?.name_en ?? '')
  const [type, setType]       = useState<PromotionType>(existing?.type ?? 'time_discount')
  const [branchId, setBranchId] = useState<string | null>(
    existing?.branch_id ?? (isGlobalAdmin ? null : callerBranchId),
  )
  const [startsAt, setStartsAt] = useState<string>(toDatetimeLocal(existing?.starts_at))
  const [endsAt,   setEndsAt]   = useState<string>(toDatetimeLocal(existing?.ends_at))
  const [isActive, setIsActive] = useState<boolean>(existing?.is_active ?? true)
  const [maxUses, setMaxUses]   = useState<string>(
    existing?.max_uses != null ? String(existing.max_uses) : '',
  )

  // Type-specific fields
  type Cfg = Record<string, unknown>
  const initCfg: Cfg = (existing?.config as Cfg) ?? {}
  const [buySlug, setBuySlug]         = useState<string>(asString(initCfg.buy_slug))
  const [getSlug, setGetSlug]         = useState<string>(asString(initCfg.get_slug))
  const [bundleItems, setBundleItems] = useState<string>(
    Array.isArray(initCfg.items) ? (initCfg.items as string[]).join(', ') : '',
  )
  const [bundlePrice, setBundlePrice] = useState<string>(asString(initCfg.price_bhd))
  const [discountPct, setDiscountPct] = useState<string>(asString(initCfg.discount_pct))
  const [days, setDays]               = useState<number[]>(
    Array.isArray(initCfg.days) ? (initCfg.days as number[]) : [],
  )
  const [startTime, setStartTime] = useState<string>(asString(initCfg.start_time))
  const [endTime,   setEndTime]   = useState<string>(asString(initCfg.end_time))
  const [itemSlug,  setItemSlug]  = useState<string>(asString(initCfg.slug))
  const [minSpend,  setMinSpend]  = useState<string>(asString(initCfg.min_spend_bhd))

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function buildConfig(): Record<string, unknown> {
    switch (type) {
      case 'bogo':
        return { buy_slug: buySlug.trim(), get_slug: getSlug.trim() }
      case 'bundle':
        return {
          items:     bundleItems.split(',').map((s) => s.trim()).filter(Boolean),
          price_bhd: parseFloat(bundlePrice) || 0,
        }
      case 'time_discount':
        return {
          discount_pct: parseFloat(discountPct) || 0,
          days,
          start_time:   startTime || undefined,
          end_time:     endTime   || undefined,
        }
      case 'item_discount':
        return { slug: itemSlug.trim(), discount_pct: parseFloat(discountPct) || 0 }
      case 'spend_discount':
        return {
          min_spend_bhd: parseFloat(minSpend)    || 0,
          discount_pct:  parseFloat(discountPct) || 0,
        }
    }
  }

  function submit() {
    setError(null)
    if (!nameAr.trim() || !nameEn.trim()) {
      setError(t('errorRequired'))
      return
    }
    const input: PromotionInput = {
      id:        existing?.id,
      branch_id: branchId,
      name_ar:   nameAr.trim(),
      name_en:   nameEn.trim(),
      type,
      config:    buildConfig(),
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at:   endsAt   ? new Date(endsAt).toISOString()   : null,
      is_active: isActive,
      max_uses:  maxUses ? Math.max(1, parseInt(maxUses, 10)) : null,
    }
    startTransition(async () => {
      try {
        await onSubmit(input)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed')
      }
    })
  }

  function toggleDay(d: number) {
    setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort())
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-brand-surface w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl border-t sm:border border-brand-border max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-brand-border">
          <h2 className={`text-lg font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {existing ? t('edit') : t('create')}
          </h2>
          <button onClick={onCancel} aria-label="close" className="text-brand-muted hover:text-brand-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {error && (
            <div className="bg-brand-error/15 border border-brand-error/40 rounded-md px-3 py-2 text-sm text-brand-error">
              {error}
            </div>
          )}

          <Field label={t('fields.nameAr')} required>
            <input
              type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)} maxLength={120}
              className={inputCls(isAr)}
            />
          </Field>
          <Field label={t('fields.nameEn')} required>
            <input
              type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={120}
              className={inputCls(isAr)}
            />
          </Field>

          <Field label={t('fields.type')} required>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as PromotionType)}
              className={inputCls(isAr)}
            >
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>{t(`type.${tp}` as 'type.bogo')}</option>
              ))}
            </select>
          </Field>

          <Field label={t('fields.branch')}>
            <select
              value={branchId ?? ''}
              onChange={(e) => setBranchId(e.target.value || null)}
              disabled={!isGlobalAdmin}
              className={inputCls(isAr)}
            >
              {isGlobalAdmin && <option value="">{t('branchAll')}</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {isAr ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          </Field>

          {/* ── Type-specific config ─────────────────────────────────────── */}
          {type === 'bogo' && (
            <>
              <Field label={t('fields.buySlug')} required>
                <input
                  type="text" value={buySlug} onChange={(e) => setBuySlug(e.target.value)}
                  placeholder="shawarma-chicken" className={inputCls(isAr)}
                />
              </Field>
              <Field label={t('fields.getSlug')} required>
                <input
                  type="text" value={getSlug} onChange={(e) => setGetSlug(e.target.value)}
                  placeholder="shawarma-chicken" className={inputCls(isAr)}
                />
              </Field>
            </>
          )}

          {type === 'bundle' && (
            <>
              <Field label={t('fields.bundleItems')} required>
                <input
                  type="text" value={bundleItems} onChange={(e) => setBundleItems(e.target.value)}
                  placeholder="quzi, hummus, salad" className={inputCls(isAr)}
                />
              </Field>
              <Field label={t('fields.bundlePrice')} required>
                <input
                  type="number" min="0" step="0.001" value={bundlePrice}
                  onChange={(e) => setBundlePrice(e.target.value)} className={inputCls(isAr)}
                />
              </Field>
            </>
          )}

          {type === 'time_discount' && (
            <>
              <Field label={t('fields.discountPct')} required>
                <input
                  type="number" min="1" max="100" step="1" value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)} className={inputCls(isAr)}
                />
              </Field>
              <Field label={t('fields.days')}>
                <div className="flex gap-1.5 flex-wrap">
                  {(isAr ? DAY_LABELS_AR : DAY_LABELS_EN).map((label, idx) => {
                    const on = days.includes(idx)
                    return (
                      <button
                        key={idx} type="button" onClick={() => toggleDay(idx)}
                        className={`min-h-[34px] px-2.5 rounded text-xs font-bold transition-colors ${
                          on
                            ? 'bg-brand-gold text-brand-black'
                            : 'bg-brand-black/40 border border-brand-border text-brand-muted'
                        } ${isAr ? 'font-almarai' : 'font-satoshi'}`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('fields.startTime')}>
                  <input
                    type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                    className={inputCls(isAr)}
                  />
                </Field>
                <Field label={t('fields.endTime')}>
                  <input
                    type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                    className={inputCls(isAr)}
                  />
                </Field>
              </div>
            </>
          )}

          {type === 'item_discount' && (
            <>
              <Field label={t('fields.itemSlug')} required>
                <input
                  type="text" value={itemSlug} onChange={(e) => setItemSlug(e.target.value)}
                  placeholder="masgouf-fish" className={inputCls(isAr)}
                />
              </Field>
              <Field label={t('fields.discountPct')} required>
                <input
                  type="number" min="1" max="100" step="1" value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)} className={inputCls(isAr)}
                />
              </Field>
            </>
          )}

          {type === 'spend_discount' && (
            <>
              <Field label={t('fields.minSpendBhd')} required>
                <input
                  type="number" min="0" step="0.001" value={minSpend}
                  onChange={(e) => setMinSpend(e.target.value)} className={inputCls(isAr)}
                />
              </Field>
              <Field label={t('fields.discountPct')} required>
                <input
                  type="number" min="1" max="100" step="1" value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)} className={inputCls(isAr)}
                />
              </Field>
            </>
          )}

          {/* ── Window + cap + active ────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            <Field label={t('fields.startsAt')}>
              <input
                type="datetime-local" value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)} className={inputCls(isAr)}
              />
            </Field>
            <Field label={t('fields.endsAt')}>
              <input
                type="datetime-local" value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)} className={inputCls(isAr)}
              />
            </Field>
          </div>

          <Field label={t('fields.maxUses')}>
            <input
              type="number" min="1" step="1" value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder={t('unlimited')} className={inputCls(isAr)}
            />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox" checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded border-brand-border bg-brand-black/40 accent-brand-gold"
            />
            <span className={`text-sm ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
              {t('fields.isActive')}
            </span>
          </label>
        </div>

        <div className="shrink-0 border-t border-brand-border px-4 py-3 flex items-center justify-end gap-2">
          <button
            type="button" onClick={onCancel}
            className={`min-h-[44px] px-4 rounded-md border border-brand-border text-brand-muted hover:text-brand-text text-sm font-bold ${isAr ? 'font-almarai' : 'font-satoshi'}`}
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button" onClick={submit} disabled={isPending}
            className={`min-h-[44px] px-5 rounded-md bg-brand-gold text-brand-black font-black text-sm flex items-center gap-2 disabled:opacity-50 ${isAr ? 'font-cairo' : 'font-satoshi'}`}
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {isAr ? 'حفظ' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-brand-muted mb-1">
        {label}{required && <span className="text-brand-error ms-1">*</span>}
      </span>
      {children}
    </label>
  )
}

function inputCls(isAr: boolean): string {
  return `w-full min-h-[44px] bg-brand-black/40 border border-brand-border rounded-md px-3 py-2 text-base text-brand-text placeholder:text-brand-muted focus:outline-none focus:border-brand-gold/40 ${isAr ? 'font-almarai' : 'font-satoshi'}`
}

function asString(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
