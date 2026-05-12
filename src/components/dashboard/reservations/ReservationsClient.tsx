'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  UserX,
  X,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ReservationSource, ReservationStatus } from '@/lib/supabase/custom-types'
import {
  createReservation,
  findAvailableTables,
  getReservations,
  updateReservationStatus,
  type AvailableTable,
  type CreateReservationInput,
  type Reservation,
} from '@/app/[locale]/dashboard/reservations/actions'

interface BranchOption {
  id:     string
  nameAr: string
  nameEn: string
}

interface Props {
  initialReservations: Reservation[]
  branchId:            string
  branches:            BranchOption[]
  isGlobalAdmin:       boolean
  locale:              'ar' | 'en'
}

type FormState = {
  guest_name:       string
  phone:            string
  party_size:       number
  reserved_date:    string
  reserved_time:    string
  duration_minutes: number
  special_requests: string
  source:           ReservationSource
  table_id:         string | null
}

const initialForm: FormState = {
  guest_name:       '',
  phone:            '+973',
  party_size:       2,
  reserved_date:    '',
  reserved_time:    '',
  duration_minutes: 90,
  special_requests: '',
  source:           'staff',
  table_id:         null,
}

const SOURCES: ReservationSource[]    = ['website', 'phone', 'walk_in', 'staff']

function todayISODate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm   = String(d.getMonth() + 1).padStart(2, '0')
  const dd   = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function combineDateTimeToISO(date: string, time: string): string | null {
  if (!date || !time) return null
  const parsed = new Date(`${date}T${time}:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export default function ReservationsClient({
  initialReservations,
  branchId,
  branches,
  isGlobalAdmin,
  locale,
}: Props) {
  const t  = useTranslations('reservations')
  const isAr = locale === 'ar'

  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [modalOpen,    setModalOpen]    = useState(false)
  const [form,         setForm]         = useState<FormState>(() => ({
    ...initialForm,
    reserved_date: todayISODate(),
  }))
  const [availableTables, setAvailableTables] = useState<AvailableTable[]>([])
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [connected,    setConnected]    = useState(false)
  const [pendingId,    setPendingId]    = useState<string | null>(null)
  const [isPending,    startTransition] = useTransition()

  const selectedBranch = branches.find((b) => b.id === branchId)
  const branchName = selectedBranch ? (isAr ? selectedBranch.nameAr : selectedBranch.nameEn) : branchId

  const pendingCount   = reservations.filter((r) => r.status === 'pending').length
  const confirmedCount = reservations.filter((r) => r.status === 'confirmed').length

  const refresh = useCallback(async () => {
    try {
      const next = await getReservations(branchId)
      setReservations(next)
      setError(null)
    } catch {
      setError(t('refreshError'))
    }
  }, [branchId, t])

  useEffect(() => {
    setReservations(initialReservations)
  }, [initialReservations])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel(`reservations-${branchId}`)

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reservations', filter: `branch_id=eq.${branchId}` },
      () => { refresh() },
    )

    channel.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED')
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [branchId, refresh])

  // Look up available tables when the modal has enough info.
  useEffect(() => {
    if (!modalOpen) return
    const iso = combineDateTimeToISO(form.reserved_date, form.reserved_time)
    if (!iso || form.party_size < 1) {
      setAvailableTables([])
      setAvailabilityError(null)
      return
    }

    let cancelled = false
    setAvailabilityLoading(true)
    setAvailabilityError(null)
    findAvailableTables({
      branch_id:        branchId,
      party_size:       form.party_size,
      reserved_for:     iso,
      duration_minutes: form.duration_minutes,
    })
      .then((rows) => {
        if (cancelled) return
        setAvailableTables(rows)
        // Drop the selected table if it's no longer available
        if (form.table_id && !rows.some((row) => row.table_id === form.table_id)) {
          setForm((current) => ({ ...current, table_id: null }))
        }
      })
      .catch(() => {
        if (cancelled) return
        setAvailableTables([])
        setAvailabilityError(t('errorGeneric'))
      })
      .finally(() => {
        if (cancelled) return
        setAvailabilityLoading(false)
      })

    return () => { cancelled = true }
  }, [
    modalOpen,
    branchId,
    form.reserved_date,
    form.reserved_time,
    form.party_size,
    form.duration_minutes,
    form.table_id,
    t,
  ])

  async function handleAdd() {
    setError(null)
    const iso = combineDateTimeToISO(form.reserved_date, form.reserved_time)
    if (!form.guest_name.trim() || !iso) {
      setError(t('errorMissingFields'))
      return
    }
    if (!/^\+973\d{8}$/.test(form.phone)) {
      setError(t('errorInvalidPhone'))
      return
    }
    if (form.party_size < 1 || form.party_size > 50) {
      setError(t('errorInvalidPartySize'))
      return
    }

    const payload: CreateReservationInput = {
      branch_id:        branchId,
      guest_name:       form.guest_name,
      phone:            form.phone,
      party_size:       form.party_size,
      reserved_for:     iso,
      duration_minutes: form.duration_minutes,
      table_id:         form.table_id,
      special_requests: form.special_requests.trim() || undefined,
      source:           form.source,
    }

    startTransition(async () => {
      try {
        await createReservation(payload)
        await refresh()
        setForm({ ...initialForm, reserved_date: todayISODate() })
        setAvailableTables([])
        setModalOpen(false)
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        if (message.includes('RESERVATION_CONFLICT')) {
          setError(t('errorConflict'))
        } else if (message.includes('INVALID_PHONE')) {
          setError(t('errorInvalidPhone'))
        } else if (message.includes('INVALID_PARTY_SIZE')) {
          setError(t('errorInvalidPartySize'))
        } else {
          setError(t('errorGeneric'))
        }
      }
    })
  }

  async function setStatus(row: Reservation, status: ReservationStatus) {
    setPendingId(`${row.id}:${status}`)
    try {
      await updateReservationStatus(row.id, status)
      await refresh()
      setError(null)
    } catch {
      setError(t('actionError'))
    } finally {
      setPendingId(null)
    }
  }

  const sortedReservations = useMemo(
    () => [...reservations].sort(
      (a, b) => new Date(a.reserved_for).getTime() - new Date(b.reserved_for).getTime(),
    ),
    [reservations],
  )

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
              <span>{t('pendingCount', { count: pendingCount })}</span>
              <span>{t('confirmedCount', { count: confirmedCount })}</span>
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
                <button
                  type="submit"
                  className="min-h-[44px] rounded-lg border border-brand-border px-4 text-sm font-bold text-brand-gold"
                >
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
              aria-label={t('addReservation')}
            >
              <Plus size={18} />
              {t('addReservation')}
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-brand-error/40 bg-brand-error/10 px-4 py-3 text-sm font-bold text-brand-error">
            {error}
          </div>
        )}

        {sortedReservations.length === 0 ? (
          <section className="flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-2xl border border-brand-border bg-brand-surface px-4 py-10 text-center">
            <Calendar size={36} className="text-brand-gold" aria-hidden="true" />
            <p className={`text-base font-bold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
              {t('empty')}
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {sortedReservations.map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-5 transition-colors hover:border-brand-gold/30"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* LEFT — guest info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`truncate text-base font-semibold text-brand-text ${isAr ? 'font-cairo' : 'font-satoshi'}`}>
                        {row.guest_name}
                      </p>
                      <span className="shrink-0 rounded-full border border-brand-border px-2 py-0.5 text-xs text-brand-muted tabular-nums">
                        {t('peopleCount', { count: row.party_size })}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-muted">
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Calendar size={13} aria-hidden="true" />
                        {formatDate(row.reserved_for, isAr)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 tabular-nums">
                        <Clock size={13} aria-hidden="true" />
                        {formatTime(row.reserved_for, isAr)}
                      </span>
                      <span className="tabular-nums" dir="ltr">{row.phone}</span>
                      {row.table_id && (
                        <span className="text-brand-gold">{t('tableLabel')}</span>
                      )}
                    </div>

                    {row.special_requests && (
                      <p className="mt-2 truncate text-xs text-brand-muted/70">
                        {row.special_requests}
                      </p>
                    )}
                  </div>

                  {/* RIGHT — status + actions */}
                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <StatusPill status={row.status} label={t(`status.${row.status}`)} />
                    {(row.status === 'pending' || row.status === 'confirmed') && (
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {row.status === 'pending' && (
                          <>
                            <ActionButton
                              label={t('actions.confirm')}
                              icon={<CheckCircle2 size={14} />}
                              busy={pendingId === `${row.id}:confirmed`}
                              onClick={() => setStatus(row, 'confirmed')}
                            />
                            <ActionButton
                              label={t('actions.cancel')}
                              icon={<XCircle size={14} />}
                              busy={pendingId === `${row.id}:cancelled`}
                              variant="muted"
                              onClick={() => setStatus(row, 'cancelled')}
                            />
                          </>
                        )}
                        {row.status === 'confirmed' && (
                          <>
                            <ActionButton
                              label={t('actions.seat')}
                              icon={<CheckCircle2 size={14} />}
                              busy={pendingId === `${row.id}:seated`}
                              onClick={() => setStatus(row, 'seated')}
                            />
                            <ActionButton
                              label={t('actions.noShow')}
                              icon={<UserX size={14} />}
                              busy={pendingId === `${row.id}:no_show`}
                              variant="muted"
                              onClick={() => setStatus(row, 'no_show')}
                            />
                            <ActionButton
                              label={t('actions.cancel')}
                              icon={<XCircle size={14} />}
                              busy={pendingId === `${row.id}:cancelled`}
                              variant="muted"
                              onClick={() => setStatus(row, 'cancelled')}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-brand-black/70 p-0 sm:items-center sm:justify-center sm:p-6">
          <div className="w-full max-h-[92vh] overflow-y-auto rounded-t-xl border border-brand-border bg-brand-surface p-5 shadow-2xl sm:max-w-lg sm:rounded-xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-brand-gold">{t('addReservation')}</h2>
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
                  onChange={(e) => setForm((c) => ({ ...c, guest_name: e.target.value }))}
                  className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-brand-muted">
                {t('phone')}
                <input
                  dir="ltr"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                  className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm font-bold text-brand-muted">
                  {t('date')}
                  <input
                    type="date"
                    value={form.reserved_date}
                    onChange={(e) => setForm((c) => ({ ...c, reserved_date: e.target.value }))}
                    className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-brand-muted">
                  {t('time')}
                  <input
                    type="time"
                    value={form.reserved_time}
                    onChange={(e) => setForm((c) => ({ ...c, reserved_time: e.target.value }))}
                    className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid gap-2">
                <span className="text-sm font-bold text-brand-muted">{t('partySize')}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  value={form.party_size}
                  onChange={(e) => setForm((c) => ({ ...c, party_size: Number(e.target.value) || 1 }))}
                  className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                />
              </div>

              <label className="grid gap-2 text-sm font-bold text-brand-muted">
                {t('duration')}
                <select
                  value={form.duration_minutes}
                  onChange={(e) => setForm((c) => ({ ...c, duration_minutes: Number(e.target.value) }))}
                  className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                >
                  {[60, 90, 120, 150, 180].map((mins) => (
                    <option key={mins} value={mins}>{mins}</option>
                  ))}
                </select>
              </label>

              <div className="grid gap-2">
                <span className="text-sm font-bold text-brand-muted">{t('availableTables')}</span>
                {availabilityLoading ? (
                  <div className="flex min-h-[48px] items-center gap-2 rounded-lg border border-brand-border bg-brand-black px-3 text-sm text-brand-muted">
                    <Loader2 size={16} className="animate-spin" />
                    {t('checkingAvailability')}
                  </div>
                ) : availabilityError ? (
                  <p className="text-sm text-brand-error">{availabilityError}</p>
                ) : availableTables.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-brand-border bg-brand-black px-3 py-3 text-sm text-brand-muted">
                    {t('noTablesAvailable')}
                  </p>
                ) : (
                  <select
                    value={form.table_id ?? ''}
                    onChange={(e) => setForm((c) => ({ ...c, table_id: e.target.value || null }))}
                    className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                  >
                    <option value="">{t('anyTable')}</option>
                    {availableTables.map((row) => {
                      const label = isAr ? row.label_ar : row.label_en
                      const display = label ?? `${t('tableLabel')} ${row.table_number}`
                      return (
                        <option key={row.table_id} value={row.table_id}>
                          {display} · {t('seatCount', { count: row.capacity })}
                        </option>
                      )
                    })}
                  </select>
                )}
              </div>

              <label className="grid gap-2 text-sm font-bold text-brand-muted">
                {t('source')}
                <select
                  value={form.source}
                  onChange={(e) => setForm((c) => ({ ...c, source: e.target.value as ReservationSource }))}
                  className="min-h-[48px] rounded-lg border border-brand-border bg-brand-black px-3 text-base text-brand-text focus:border-brand-gold/60 focus:outline-none"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{t(`sources.${s}`)}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-brand-muted">
                {t('specialRequests')}
                <textarea
                  value={form.special_requests}
                  onChange={(e) => setForm((c) => ({ ...c, special_requests: e.target.value }))}
                  rows={3}
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

function formatTime(iso: string, isAr: boolean): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(isAr ? 'ar-BH' : 'en-GB', {
      hour:   '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return iso.slice(11, 16)
  }
}

function formatDate(iso: string, isAr: boolean): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(isAr ? 'ar-BH' : 'en-GB', {
      day:   '2-digit',
      month: '2-digit',
      year:  'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

function StatusPill({ status, label }: { status: ReservationStatus; label: string }) {
  const tone =
    status === 'pending'
      ? 'border-brand-gold/40 text-brand-gold bg-brand-gold/10'
      : status === 'confirmed'
        ? 'border-green-500/40 text-green-400 bg-green-500/10'
        : status === 'seated'
          ? 'border-transparent bg-brand-gold text-brand-black'
          : status === 'no_show'
            ? 'border-red-500/40 text-red-400 bg-red-500/10'
            : 'border-brand-border text-brand-muted bg-transparent'

  return (
    <span className={`inline-flex min-h-[28px] w-fit items-center rounded-full border px-3 text-xs font-bold uppercase tracking-wide ${tone}`}>
      {label}
    </span>
  )
}

function ActionButton({
  label, icon, busy, variant, onClick,
}: {
  label:    string
  icon:     React.ReactNode
  busy:     boolean
  variant?: 'muted'
  onClick:  () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors disabled:opacity-60 ${
        variant === 'muted'
          ? 'border-transparent text-brand-muted hover:border-brand-error/40 hover:text-brand-error'
          : 'border-brand-gold/40 text-brand-gold hover:bg-brand-gold hover:text-brand-black'
      }`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
    </button>
  )
}
