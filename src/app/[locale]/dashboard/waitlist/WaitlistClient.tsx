'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Bell,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { buildWaLinkForPhone } from '@/constants/contact'
import type { WaitlistStatus } from '@/lib/supabase/custom-types'
import {
  addToWaitlist,
  getWaitlist,
  updateStatus,
  type AddWaitlistInput,
  type WaitlistEntry,
} from './actions'

interface BranchOption {
  id:     string
  nameAr: string
  nameEn: string
}

interface Props {
  initialEntries: WaitlistEntry[]
  branchId:       string
  branches:       BranchOption[]
  isGlobalAdmin:  boolean
  locale:         'ar' | 'en'
}

type AddFormState = {
  guest_name: string
  phone:      string
  party_size: number
  notes:      string
}

const initialForm: AddFormState = {
  guest_name: '',
  phone:      '+973',
  party_size: 2,
  notes:      '',
}

const ACTIVE_STATUSES: WaitlistStatus[] = ['waiting', 'notified']

export default function WaitlistClient({
  initialEntries,
  branchId,
  branches,
  isGlobalAdmin,
  locale,
}: Props) {
  const t = useTranslations('waitlist')
  const isAr = locale === 'ar'
  const [entries, setEntries] = useState<WaitlistEntry[]>(initialEntries)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<AddFormState>(initialForm)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedBranch = branches.find((branch) => branch.id === branchId)
  const branchName = selectedBranch ? (isAr ? selectedBranch.nameAr : selectedBranch.nameEn) : branchId

  const activeEntries = useMemo(
    () => entries.filter((entry) => ACTIVE_STATUSES.includes(entry.status)),
    [entries],
  )

  const waitingCount = entries.filter((entry) => entry.status === 'waiting').length
  const seatedCount = entries.filter((entry) => entry.status === 'seated').length

  const refresh = useCallback(async () => {
    try {
      const nextEntries = await getWaitlist(branchId)
      setEntries(nextEntries)
      setError(null)
    } catch {
      setError(t('refreshError'))
    }
  }, [branchId, t])

  useEffect(() => {
    setEntries(initialEntries)
  }, [initialEntries])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`waitlist-${branchId}`)

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'waitlist_entries', filter: `branch_id=eq.${branchId}` },
      () => { refresh() },
    )

    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED')
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId, refresh])

  async function handleAdd() {
    const payload: AddWaitlistInput = {
      branch_id:   branchId,
      guest_name:  form.guest_name,
      phone:       form.phone,
      party_size:  form.party_size,
      notes:       form.notes,
    }

    startTransition(async () => {
      try {
        await addToWaitlist(payload)
        await refresh()
        setForm(initialForm)
        setModalOpen(false)
        setError(null)
      } catch {
        setError(t('addError'))
      }
    })
  }

  async function setStatus(entry: WaitlistEntry, status: WaitlistStatus) {
    setPendingId(`${entry.id}:${status}`)
    try {
      await updateStatus(entry.id, status)
      await refresh()
      setError(null)
      if (status === 'notified') {
        window.open(buildWaLinkForPhone(entry.phone, t('whatsappMsg', { name: entry.guest_name })), '_blank', 'noopener,noreferrer')
      }
    } catch {
      setError(t('actionError'))
    } finally {
      setPendingId(null)
    }
  }

  function waitMinutes(createdAt: string) {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  }

  return (
    <div className="min-h-screen bg-brand-black px-4 py-6 text-brand-text sm:px-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-4 border-b border-brand-border pb-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-brand-muted">
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-success' : 'bg-brand-error'}`} />
              <span>{connected ? t('live') : t('offline')}</span>
            </div>
            <h1 className={`text-3xl font-black text-brand-gold ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
              {t('title')}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-brand-muted">
              <span>{branchName}</span>
              <span>{t('waitingCount', { count: waitingCount })}</span>
              <span>{t('completedCount', { count: seatedCount })}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isGlobalAdmin && (
              <form action="" method="get" className="flex min-h-[44px] items-center gap-2">
                <select
                  name="branch"
                  defaultValue={branchId}
                  aria-label={t('branch')}
                  className="min-h-[44px] rounded-lg border border-brand-border bg-brand-surface px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {isAr ? branch.nameAr : branch.nameEn}
                    </option>
                  ))}
                </select>
                <button type="submit" className="min-h-[44px] rounded-lg border border-brand-border px-4 text-sm font-bold text-brand-gold">
                  {t('apply')}
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-brand-border px-4 text-sm font-bold text-brand-muted transition-colors hover:border-brand-gold/40 hover:text-brand-gold"
              aria-label={t('refresh')}
            >
              <RefreshCw size={16} />
              {t('refresh')}
            </button>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-gold px-4 text-sm font-black text-brand-black transition-colors hover:bg-brand-gold/90"
              aria-label={t('addGuest')}
            >
              <Plus size={18} />
              {t('addGuest')}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-brand-error/40 bg-brand-error/10 px-4 py-3 text-sm font-bold text-brand-error">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
          <div className="grid grid-cols-[48px_minmax(140px,1fr)_96px_110px_110px_minmax(220px,auto)] gap-3 border-b border-brand-border px-4 py-3 text-xs font-bold uppercase tracking-wide text-brand-muted max-lg:hidden">
            <span>{t('rank')}</span>
            <span>{t('guestName')}</span>
            <span>{t('partySize')}</span>
            <span>{t('waitTime')}</span>
            <span>{t('status')}</span>
            <span>{t('actions')}</span>
          </div>

          {activeEntries.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 px-4 py-10 text-center text-brand-muted">
              <Users size={34} />
              <p className="text-base font-bold">{t('empty')}</p>
            </div>
          ) : (
            <ol className="divide-y divide-brand-border">
              {activeEntries.map((entry, index) => (
                <li
                  key={entry.id}
                  className="grid gap-3 px-4 py-4 lg:grid-cols-[48px_minmax(140px,1fr)_96px_110px_110px_minmax(220px,auto)] lg:items-center"
                >
                  <div className="hidden text-sm font-black text-brand-gold lg:block">{index + 1}</div>
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-3 lg:block">
                      <div>
                        <p className="truncate text-base font-black text-brand-text">{entry.guest_name}</p>
                        {entry.notes && <p className="mt-1 text-sm text-brand-muted">{entry.notes}</p>}
                      </div>
                      <span className="rounded-full bg-brand-gold/10 px-2 py-1 text-xs font-bold text-brand-gold lg:hidden">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-brand-text">
                    {t('peopleCount', { count: entry.party_size })}
                  </div>
                  <div className="text-sm text-brand-muted">
                    {t('minuteCount', { count: waitMinutes(entry.created_at) })}
                  </div>
                  <StatusPill status={entry.status} label={t(entry.status)} />
                  <div className="flex flex-wrap gap-2">
                    {entry.status === 'waiting' && (
                      <ActionButton
                        label={t('notify')}
                        icon={<Bell size={15} />}
                        busy={pendingId === `${entry.id}:notified`}
                        onClick={() => setStatus(entry, 'notified')}
                      />
                    )}
                    {entry.status === 'notified' && (
                      <ActionButton
                        label={t('markSeated')}
                        icon={<CheckCircle2 size={15} />}
                        busy={pendingId === `${entry.id}:seated`}
                        onClick={() => setStatus(entry, 'seated')}
                      />
                    )}
                    <ActionButton
                      label={t('cancel')}
                      icon={<XCircle size={15} />}
                      busy={pendingId === `${entry.id}:cancelled`}
                      variant="muted"
                      onClick={() => setStatus(entry, 'cancelled')}
                    />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-brand-black/70 p-0 sm:items-center sm:justify-center sm:p-6">
          <div className="w-full rounded-t-xl border border-brand-border bg-brand-surface p-5 shadow-2xl sm:max-w-lg sm:rounded-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-brand-gold">{t('addGuestTitle')}</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-brand-muted hover:bg-brand-surface-2 hover:text-brand-text"
                aria-label={t('close')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-brand-muted">
                {t('guestName')}
                <input
                  value={form.guest_name}
                  onChange={(event) => setForm((current) => ({ ...current, guest_name: event.target.value }))}
                  className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-brand-muted">
                {t('phone')}
                <input
                  dir="ltr"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                />
              </label>
              <div className="grid gap-2">
                <span className="text-sm font-bold text-brand-muted">{t('partySize')}</span>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, party_size: size }))}
                      className={`min-h-[48px] rounded-lg border text-base font-black transition-colors ${
                        form.party_size === size
                          ? 'border-brand-gold bg-brand-gold text-brand-black'
                          : 'border-brand-border bg-brand-black text-brand-text hover:border-brand-gold/50'
                      }`}
                      aria-label={t('peopleCount', { count: size })}
                    >
                      {size === 4 ? t('fourPlus') : size}
                    </button>
                  ))}
                </div>
                {form.party_size >= 4 && (
                  <input
                    type="number"
                    min={4}
                    max={20}
                    value={form.party_size}
                    onChange={(event) => setForm((current) => ({ ...current, party_size: Number(event.target.value) }))}
                    className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                    aria-label={t('partySize')}
                  />
                )}
              </div>
              <label className="grid gap-2 text-sm font-bold text-brand-muted">
                {t('notes')}
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-[96px] rounded-lg border border-brand-border bg-brand-black px-3 py-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="min-h-[44px] rounded-lg border border-brand-border px-4 text-sm font-bold text-brand-muted hover:text-brand-text"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={isPending}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand-gold px-5 text-sm font-black text-brand-black disabled:opacity-60"
              >
                {isPending && <Loader2 size={16} className="animate-spin" />}
                {t('add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusPill({ status, label }: { status: WaitlistStatus; label: string }) {
  const tone = status === 'notified'
    ? 'border-brand-gold/40 bg-brand-gold/10 text-brand-gold'
    : 'border-brand-border bg-brand-black text-brand-muted'

  return (
    <span className={`inline-flex min-h-[32px] w-fit items-center rounded-full border px-3 text-sm font-bold ${tone}`}>
      {label}
    </span>
  )
}

function ActionButton({
  label,
  icon,
  busy,
  variant,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  busy: boolean
  variant?: 'muted'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors disabled:opacity-60 ${
        variant === 'muted'
          ? 'border-brand-border text-brand-muted hover:border-brand-error/40 hover:text-brand-error'
          : 'border-brand-gold/40 text-brand-gold hover:bg-brand-gold hover:text-brand-black'
      }`}
    >
      {busy ? <Loader2 size={15} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}
