'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Power, Trash2, Pencil, Loader2 } from 'lucide-react'
import {
  upsertPromotion,
  togglePromotion,
  deletePromotion,
  type PromotionInput,
} from './actions'
import {
  classifyPromotion,
  type PromotionRow,
  type PromotionStatus,
  type PromotionType,
} from '@/lib/promotions/types'
import PromotionForm from './PromotionForm'

interface BranchOption {
  id:     string
  nameAr: string
  nameEn: string
}

interface Props {
  initialPromotions: PromotionRow[]
  branches:          BranchOption[]
  isGlobalAdmin:     boolean
  callerBranchId:    string | null
  locale:            'ar' | 'en'
}

const TABS: { key: PromotionStatus | 'all'; label: string }[] = [
  { key: 'all',       label: 'all' },
  { key: 'active',    label: 'active' },
  { key: 'scheduled', label: 'scheduled' },
  { key: 'expired',   label: 'expired' },
  { key: 'inactive',  label: 'inactive' },
]

export default function PromotionsClient({
  initialPromotions, branches, isGlobalAdmin, callerBranchId, locale,
}: Props) {
  const t = useTranslations('promotions')
  const isAr = locale === 'ar'

  const [promotions, setPromotions] = useState<PromotionRow[]>(initialPromotions)
  const [tab, setTab] = useState<PromotionStatus | 'all'>('all')
  const [editing, setEditing] = useState<PromotionRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const visible = useMemo(() => {
    if (tab === 'all') return promotions
    const now = new Date()
    return promotions.filter((p) => classifyPromotion(p, now) === tab)
  }, [promotions, tab])

  function statusOf(p: PromotionRow): PromotionStatus {
    return classifyPromotion(p, new Date())
  }

  function statusLabel(s: PromotionStatus): string {
    if (s === 'inactive') return isAr ? 'موقوف' : 'Inactive'
    return t(s)
  }

  function typeLabel(type: PromotionType): string {
    return t(`type.${type}` as 'type.bogo')
  }

  async function handleSubmit(input: PromotionInput) {
    setError(null)
    const result = await upsertPromotion(input)
    if (result.error) {
      setError(result.error)
      return
    }
    // Refresh list locally — easier than a full page refetch.
    setPromotions((prev) => {
      if (input.id) {
        return prev.map((p) => p.id === input.id
          ? { ...p, ...inputToRow(input, p) }
          : p,
        )
      }
      const newRow: PromotionRow = {
        id:         result.id ?? crypto.randomUUID(),
        branch_id:  input.branch_id,
        name_ar:    input.name_ar,
        name_en:    input.name_en,
        type:       input.type,
        config:     input.config,
        starts_at:  input.starts_at,
        ends_at:    input.ends_at,
        is_active:  input.is_active,
        max_uses:   input.max_uses,
        use_count:  0,
        created_at: new Date().toISOString(),
      }
      return [newRow, ...prev]
    })
    setCreating(false)
    setEditing(null)
  }

  function handleToggle(p: PromotionRow) {
    setBusyId(p.id)
    startTransition(async () => {
      const result = await togglePromotion(p.id, !p.is_active)
      setBusyId(null)
      if (result.error) { setError(result.error); return }
      setPromotions((prev) => prev.map((row) =>
        row.id === p.id ? { ...row, is_active: !row.is_active } : row,
      ))
    })
  }

  function handleDelete(p: PromotionRow) {
    const msg = isAr
      ? `حذف عرض "${p.name_ar}"؟ لا يمكن التراجع.`
      : `Delete promotion "${p.name_en}"? This cannot be undone.`
    if (!confirm(msg)) return
    setBusyId(p.id)
    startTransition(async () => {
      const result = await deletePromotion(p.id)
      setBusyId(null)
      if (result.error) { setError(result.error); return }
      setPromotions((prev) => prev.filter((row) => row.id !== p.id))
    })
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto" dir={isAr ? 'rtl' : 'ltr'}>
      <header className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className={`text-2xl font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
            {t('title')}
          </h1>
          <p className={`text-sm text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {t('subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setCreating(true) }}
          className={`inline-flex items-center gap-2 min-h-[40px] px-4 rounded-lg bg-brand-gold text-brand-black font-bold text-sm hover:bg-brand-gold/90 ${isAr ? 'font-cairo' : 'font-satoshi'}`}
        >
          <Plus size={16} strokeWidth={2.5} />
          {t('create')}
        </button>
      </header>

      {error && (
        <div className="mb-4 bg-brand-error/15 border border-brand-error/40 rounded-lg px-3 py-2 flex items-center justify-between">
          <span className={`text-sm text-brand-error ${isAr ? 'font-almarai' : 'font-satoshi'}`}>{error}</span>
          <button onClick={() => setError(null)} className="text-brand-error text-xs underline">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {TABS.map((opt) => {
          const active = tab === opt.key
          const label = opt.key === 'all'
            ? (isAr ? 'الكل' : 'All')
            : statusLabel(opt.key as PromotionStatus)
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setTab(opt.key)}
              className={`shrink-0 min-h-[36px] px-3 rounded-lg text-xs font-bold transition-colors ${
                active
                  ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/40'
                  : 'bg-brand-surface border border-brand-border text-brand-muted hover:text-brand-text'
              } ${isAr ? 'font-almarai' : 'font-satoshi'}`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-8 text-center">
          <p className={`text-brand-muted ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
            {isAr ? 'لا توجد عروض في هذه الفئة' : 'No promotions in this filter'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => {
            const status = statusOf(p)
            const branchLabel = p.branch_id == null
              ? t('branchAll')
              : (() => {
                  const b = branches.find((x) => x.id === p.branch_id)
                  return b ? (isAr ? b.nameAr : b.nameEn) : (p.branch_id as string)
                })()
            return (
              <li
                key={p.id}
                className="bg-brand-surface border border-brand-border rounded-lg p-4 flex flex-wrap items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-black text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                      {isAr ? p.name_ar : p.name_en}
                    </span>
                    <span className={`text-[11px] uppercase rounded-full px-2 py-0.5 bg-brand-gold/10 text-brand-gold ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {typeLabel(p.type)}
                    </span>
                    <span className={`text-[11px] uppercase rounded-full px-2 py-0.5 ${
                      status === 'active'    ? 'bg-brand-success/15 text-brand-success' :
                      status === 'scheduled' ? 'bg-brand-gold/10 text-brand-gold' :
                      status === 'expired'   ? 'bg-brand-error/15 text-brand-error' :
                      'bg-brand-surface border border-brand-border text-brand-muted'
                    } ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                      {statusLabel(status)}
                    </span>
                  </div>
                  <p className={`text-xs text-brand-muted mt-1 ${isAr ? 'font-almarai' : 'font-satoshi'}`}>
                    {branchLabel}
                    {' · '}
                    {p.max_uses == null
                      ? t('useCount', { count: p.use_count }) + ' / ∞'
                      : `${t('useCount', { count: p.use_count })} / ${p.max_uses}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggle(p)}
                    disabled={busyId === p.id}
                    aria-label={p.is_active ? (isAr ? 'إيقاف' : 'Pause') : (isAr ? 'تفعيل' : 'Resume')}
                    className={`min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md border transition-colors ${
                      p.is_active
                        ? 'border-brand-success/40 text-brand-success hover:bg-brand-success/10'
                        : 'border-brand-border text-brand-muted hover:bg-white/5'
                    }`}
                  >
                    {busyId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setEditing(p) }}
                    aria-label={t('edit')}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md border border-brand-border text-brand-muted hover:text-brand-text hover:bg-white/5"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={busyId === p.id}
                    aria-label={t('delete')}
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md border border-brand-error/40 text-brand-error hover:bg-brand-error/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {(creating || editing) && (
        <PromotionForm
          existing={editing}
          branches={branches}
          isGlobalAdmin={isGlobalAdmin}
          callerBranchId={callerBranchId}
          locale={locale}
          onCancel={() => { setCreating(false); setEditing(null); setError(null) }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}

function inputToRow(input: PromotionInput, prev: PromotionRow): Partial<PromotionRow> {
  return {
    branch_id: input.branch_id,
    name_ar:   input.name_ar,
    name_en:   input.name_en,
    type:      input.type,
    config:    input.config,
    starts_at: input.starts_at,
    ends_at:   input.ends_at,
    is_active: input.is_active,
    max_uses:  input.max_uses,
    use_count: prev.use_count,
  }
}
