// Unit tests for src/lib/payments/tap-client.ts
// Run with:  npx tsx --test tests/unit/tap-client.test.ts
//
// Covers VULN-CRY-03 (amount object-form signature) and the fail-closed
// behaviors on the HMAC verifier. Tap signs id+amount+currency+status+secret,
// and our normalizer must canonicalize the object-form `amount` to the
// numeric scalar before hashing.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import {
  extractAmountScalar,
  extractOrderReference,
  verifyWebhookSignature,
} from '../../src/lib/payments/tap-client'

const SECRET = 'test_secret_12345'

function signTap(args: {
  id:       string
  amount:   number
  currency: string
  status:   string
  secret?:  string
}): string {
  const toHash = `${args.id}${args.amount}${args.currency}${args.status}${args.secret ?? SECRET}`
  return createHmac('sha256', args.secret ?? SECRET).update(toHash).digest('hex')
}

test('extractAmountScalar: numeric form', () => {
  assert.equal(extractAmountScalar({ amount: 1234 }), 1234)
  assert.equal(extractAmountScalar({ amount: 0 }), 0)
})

test('extractAmountScalar: object form { value, currency }', () => {
  assert.equal(extractAmountScalar({ amount: { value: 5000, currency: 'BHD' } }), 5000)
})

test('extractAmountScalar: missing or malformed returns null', () => {
  assert.equal(extractAmountScalar({}), null)
  assert.equal(extractAmountScalar({ amount: 'oops' }), null)
  assert.equal(extractAmountScalar({ amount: { currency: 'BHD' } }), null)
  assert.equal(extractAmountScalar({ amount: null }), null)
})

test('extractOrderReference: string and object forms', () => {
  assert.equal(extractOrderReference({ reference: 'order_123' }), 'order_123')
  assert.equal(
    extractOrderReference({ reference: { order: 'order_abc', transaction: 'tx_xyz' } }),
    'order_abc',
  )
  assert.equal(extractOrderReference({ reference: { transaction: 'tx_only' } }), null)
  assert.equal(extractOrderReference({}), null)
})

test('verifyWebhookSignature: scalar amount form verifies', () => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET
  const payload = {
    id:       'chg_scalar_1',
    amount:   1500,
    currency: 'BHD',
    status:   'CAPTURED',
  }
  const sig = signTap({ id: payload.id, amount: payload.amount, currency: payload.currency, status: payload.status })
  assert.equal(verifyWebhookSignature(payload, sig), true)
})

test('verifyWebhookSignature: object amount form { value, currency } verifies (VULN-CRY-03)', () => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET
  const payload = {
    id:     'chg_object_1',
    amount: { value: 2500, currency: 'BHD' },
    status: 'CAPTURED',
    // Note: no top-level `currency` — Tap nests it under `amount` in this shape.
  }
  // Tap's hash recipe is amount.value + amount.currency.
  const sig = signTap({ id: payload.id, amount: 2500, currency: 'BHD', status: payload.status })
  assert.equal(verifyWebhookSignature(payload, sig), true)
})

test('verifyWebhookSignature: tampered hash rejected', () => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET
  const payload = { id: 'chg_x', amount: 100, currency: 'BHD', status: 'CAPTURED' }
  const sig = signTap({ id: payload.id, amount: payload.amount, currency: payload.currency, status: payload.status })
  // Flip a byte (keep same length so the timingSafeEqual path is exercised)
  const tampered = sig.slice(0, -2) + (sig.slice(-2) === 'aa' ? 'bb' : 'aa')
  assert.equal(verifyWebhookSignature(payload, tampered), false)
})

test('verifyWebhookSignature: length mismatch rejected', () => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET
  const payload = { id: 'chg_x', amount: 100, currency: 'BHD', status: 'CAPTURED' }
  assert.equal(verifyWebhookSignature(payload, 'tooshort'), false)
})

test('verifyWebhookSignature: missing secret fails closed', () => {
  delete process.env.PAYMENT_WEBHOOK_SECRET
  const payload = { id: 'chg_x', amount: 100, currency: 'BHD', status: 'CAPTURED' }
  // Any non-empty hashstring should still fail-closed.
  assert.equal(verifyWebhookSignature(payload, 'a'.repeat(64)), false)
})

test('verifyWebhookSignature: missing hashstring fails closed', () => {
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET
  const payload = { id: 'chg_x', amount: 100, currency: 'BHD', status: 'CAPTURED' }
  assert.equal(verifyWebhookSignature(payload, ''), false)
})

test('verifyWebhookSignature: scalar form signature does NOT validate object payload with different value', () => {
  // Sanity check that we are actually using `amount.value` and not falling
  // back to "[object Object]" — the historical VULN-CRY-03 bug. If the bug
  // regressed, both payloads below would either both validate or both fail.
  process.env.PAYMENT_WEBHOOK_SECRET = SECRET
  const sigFor2500 = signTap({ id: 'chg_y', amount: 2500, currency: 'BHD', status: 'CAPTURED' })
  // Object form whose value is *not* 2500 must be rejected with sigFor2500.
  const wrong = {
    id:     'chg_y',
    amount: { value: 9999, currency: 'BHD' },
    status: 'CAPTURED',
  }
  assert.equal(verifyWebhookSignature(wrong, sigFor2500), false)
})
