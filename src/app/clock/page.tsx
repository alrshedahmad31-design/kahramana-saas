'use client'

import { useState, useEffect } from 'react'
import { verifyPin, clockIn, clockOut } from './actions'
import { BRANCHES } from '@/constants/contact'
import type { StaffRole } from '@/lib/supabase/custom-types'

const ROLE_LABEL: Record<StaffRole, string> = {
  owner:           'Owner',
  general_manager: 'General Manager',
  branch_manager:  'Branch Manager',
  cashier:         'Cashier',
  kitchen:         'Kitchen',
  driver:          'Driver',
  inventory:       'Inventory',
  marketing:       'Marketing',
  support:         'Support',
}

function formatClock(): string {
  return new Date().toLocaleTimeString('en-BH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
}

function formatHours(h: number): string {
  const whole = Math.floor(h)
  const mins  = Math.round((h - whole) * 60)
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`
}

export default function ClockPage() {
  const [clock, setClock]   = useState(formatClock)
  const [pin,   setPin]     = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [busy,  setBusy]    = useState(false)
  const [done,  setDone]    = useState<{ message: string; hours?: number } | null>(null)
  const [staffState, setStaffState] = useState<{
    staff:       { id: string; name: string; role: StaffRole; branch_id: string | null }
    activeEntry: string | null
  } | null>(null)

  useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1_000)
    return () => clearInterval(id)
  }, [])

  function handleDigit(d: string) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError(null)

    if (next.length === 4) {
      submitPin(next)
    }
  }

  function handleClear() {
    setPin('')
    setError(null)
    setStaffState(null)
    setDone(null)
  }

  async function submitPin(p: string) {
    setBusy(true)
    const result = await verifyPin(p)
    setBusy(false)
    if (!result.success) {
      setError(result.error === 'PIN not found' ? 'Wrong PIN. Try again.' : result.error)
      setPin('')
    } else {
      setStaffState({ staff: result.staff, activeEntry: result.activeEntry })
    }
  }

  async function handleClockIn() {
    if (!staffState || busy) return
    setBusy(true)
    const result = await clockIn(staffState.staff.id)
    setBusy(false)
    if (result.success) {
      setDone({ message: 'Clocked in! Have a great shift.' })
      setTimeout(() => resetAll(), 4_000)
    } else {
      setError(result.error ?? 'Failed to clock in')
    }
  }

  async function handleClockOut() {
    if (!staffState?.activeEntry || busy) return
    setBusy(true)
    const result = await clockOut(staffState.activeEntry, staffState.staff.id)
    setBusy(false)
    if (result.success) {
      setDone({ message: 'Clocked out!', hours: result.hoursWorked })
      setTimeout(() => resetAll(), 4_000)
    } else {
      setError(result.error ?? 'Failed to clock out')
    }
  }

  function resetAll() {
    setPin('')
    setError(null)
    setStaffState(null)
    setDone(null)
  }

  const branch = staffState?.staff.branch_id
    ? BRANCHES[staffState.staff.branch_id as keyof typeof BRANCHES]
    : null

  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4" dir="ltr">
      <div className="w-full max-w-sm flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <p className="font-satoshi font-black text-5xl text-brand-text tabular-nums mb-1">{clock}</p>
          <p className="font-satoshi text-sm text-brand-muted">
            {new Date().toLocaleDateString('en-BH', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Done state */}
        {done ? (
          <div className="rounded-xl border border-brand-success/30 bg-brand-success/10 p-6 text-center flex flex-col gap-2">
            <div className="text-4xl mb-2">✓</div>
            <p className="font-satoshi font-black text-xl text-brand-success">{done.message}</p>
            {done.hours !== undefined && (
              <p className="font-satoshi text-sm text-brand-muted">
                Hours worked: <span className="font-bold text-brand-text">{formatHours(done.hours)}</span>
              </p>
            )}
          </div>
        ) : staffState ? (
          /* Staff identified */
          <div className="flex flex-col gap-4">
            {/* Staff card */}
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5 text-center">
              <div className="w-14 h-14 rounded-xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mx-auto mb-3">
                <span className="font-satoshi font-black text-2xl text-brand-gold">
                  {staffState.staff.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <p className="font-satoshi font-black text-xl text-brand-text">{staffState.staff.name}</p>
              <p className="font-satoshi text-sm text-brand-muted">
                {ROLE_LABEL[staffState.staff.role]}
                {branch && <span> · {branch.nameEn}</span>}
              </p>
              <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-satoshi font-bold ${
                staffState.activeEntry
                  ? 'bg-brand-success/20 text-brand-success'
                  : 'bg-brand-muted/10 text-brand-muted'
              }`}>
                <span className={`w-2 h-2 rounded-full ${staffState.activeEntry ? 'bg-brand-success animate-pulse' : 'bg-brand-muted'}`} />
                {staffState.activeEntry ? 'Currently Clocked In' : 'Clocked Out'}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-brand-error/10 border border-brand-error/20 px-4 py-2.5 text-sm text-brand-error text-center font-satoshi">
                {error}
              </div>
            )}

            {/* Action buttons */}
            {staffState.activeEntry ? (
              <button
                type="button"
                onClick={handleClockOut}
                disabled={busy}
                className="w-full min-h-[64px] rounded-xl bg-brand-error text-brand-black font-satoshi font-black text-2xl hover:bg-brand-error/90 disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]"
              >
                {busy ? '…' : 'CLOCK OUT'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClockIn}
                disabled={busy}
                className="w-full min-h-[64px] rounded-xl bg-brand-success text-brand-black font-satoshi font-black text-2xl hover:bg-brand-success/90 disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]"
              >
                {busy ? '…' : 'CLOCK IN'}
              </button>
            )}

            <button
              type="button"
              onClick={resetAll}
              className="font-satoshi text-sm text-brand-muted hover:text-brand-text transition-colors duration-150 text-center py-2"
            >
              ← Back
            </button>
          </div>
        ) : (
          /* PIN entry */
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-brand-border bg-brand-surface p-5 text-center">
              <p className="font-satoshi text-xs text-brand-muted uppercase tracking-widest mb-4">
                Enter your PIN
              </p>

              {/* PIN display */}
              <div className="flex justify-center gap-4 mb-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-5 h-5 rounded-full border-2 transition-colors duration-150 ${
                      i < pin.length
                        ? 'bg-brand-gold border-brand-gold'
                        : 'bg-transparent border-brand-border'
                    }`}
                  />
                ))}
              </div>

              {error && (
                <p className="font-satoshi text-sm text-brand-error mb-3">{error}</p>
              )}

              {busy && (
                <p className="font-satoshi text-sm text-brand-muted animate-pulse">Verifying…</p>
              )}
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => {
                if (d === '') return <div key={i} />
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={busy}
                    onClick={() => d === '⌫' ? handleClear() : handleDigit(d)}
                    className={`
                      h-16 rounded-xl font-satoshi font-black text-2xl
                      transition-all duration-100 active:scale-95 disabled:opacity-30
                      ${d === '⌫'
                        ? 'bg-brand-surface border border-brand-border text-brand-error hover:border-brand-error/30'
                        : 'bg-brand-surface border border-brand-border text-brand-text hover:border-brand-gold/40 hover:bg-brand-surface-2'
                      }
                    `}
                  >
                    {d}
                  </button>
                )
              })}
            </div>

            <p className="font-satoshi text-xs text-brand-muted/40 text-center">
              Contact your manager to set up your PIN
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
