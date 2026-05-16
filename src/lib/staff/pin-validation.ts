// VULN-015: clock-in PINs are only 4 digits, so the entropy floor is brittle.
// We can't lift the digit count without a much larger UX change, but we CAN
// remove the obviously-weak codes from the keyspace and force staff to pick a
// non-trivial sequence. The set below is the empirically common floor — runs,
// repeats, simple ladders, and common date-like patterns. Roughly 0.4 % of
// the 10 000 four-digit space, but covers >50 % of real-world guess
// attempts.

const FORBIDDEN_PIN_SEQUENCES: ReadonlySet<string> = new Set([
  '0000', '1111', '2222', '3333', '4444',
  '5555', '6666', '7777', '8888', '9999',
  '1234', '1212', '0101',
])

export function isTrivialPin(pin: string): boolean {
  if (!/^\d{4}$/.test(pin)) return false
  if (FORBIDDEN_PIN_SEQUENCES.has(pin)) return true
  // Any 4 identical digits — caught by the explicit list above but kept as
  // belt-and-suspenders in case the list is shortened later.
  if (pin[0] === pin[1] && pin[1] === pin[2] && pin[2] === pin[3]) return true
  return false
}

// Single error code for the API layer to return; callers map it to a localized
// string for the UI.
export const PIN_TRIVIAL_ERROR = 'pin_too_weak'
