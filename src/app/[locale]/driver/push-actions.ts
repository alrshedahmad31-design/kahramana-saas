'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import webpush from 'web-push'
import { toSafeError } from '@/lib/utils/safe-error'

// ── VAPID setup ────────────────────────────────────────────────────────────────
// Generate once with: npx web-push generate-vapid-keys
// Then add to .env.local + Vercel environment variables.

if (
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,   // 'mailto:admin@kahramanat.com'
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PushSubscriptionPayload {
  endpoint: string
  keys: {
    p256dh: string
    auth:   string
  }
  userAgent?: string
}

interface ActionResult {
  success: boolean
  error?:  string
}

// ── savePushSubscription ───────────────────────────────────────────────────────
// Called from the client after the browser grants notification permission
// and generates a PushSubscription object.

export async function savePushSubscription(
  sub: PushSubscriptionPayload,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthenticated' }

  // Validate driver role
  const { data: staff } = await supabase
    .from('staff_basic')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!staff || staff.role !== 'driver' || !staff.is_active) {
    return { success: false, error: 'Unauthorized' }
  }

  const service = await createServiceClient()

  const { error } = await service
    .from('driver_push_subscriptions')
    .upsert(
      {
        driver_id: user.id,
        endpoint:  sub.endpoint,
        p256dh:    sub.keys.p256dh,
        auth_key:  sub.keys.auth,
        user_agent: sub.userAgent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'driver_id,endpoint' },
    )

  if (error) return { success: false, error: toSafeError(error) }
  return { success: true }
}

// ── deletePushSubscription ─────────────────────────────────────────────────────
// Called when the driver opts out of notifications.

export async function deletePushSubscription(
  endpoint: string,
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthenticated' }

  const service = await createServiceClient()
  await service
    .from('driver_push_subscriptions')
    .delete()
    .eq('driver_id', user.id)
    .eq('endpoint', endpoint)

  return { success: true }
}

// ── sendPushToDriver ───────────────────────────────────────────────────────────
// Internal helper — called from server-side code (e.g. order assignment flow).
// driverId: UUID of the staff row.

export async function sendPushToDriver(
  driverId: string,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<void> {
  if (
    !process.env.VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_SUBJECT
  ) {
    // VAPID not configured — skip silently in dev
    console.warn('[push] VAPID env vars not set — skipping notification')
    return
  }

  const service = await createServiceClient()
  const { data: subs } = await service
    .from('driver_push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('driver_id', driverId)

  if (!subs || subs.length === 0) return

  const message = JSON.stringify({
    title: payload.title,
    body:  payload.body,
    url:   payload.url  ?? '/ar/driver',
    tag:   payload.tag  ?? 'driver-order',
  })

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          message,
          { TTL: 300 }, // 5-minute message expiry
        )
      } catch (err: unknown) {
        // 410 Gone = subscription expired — remove it
        if ((err as { statusCode?: number }).statusCode === 410) {
          await service
            .from('driver_push_subscriptions')
            .delete()
            .eq('endpoint', sub.endpoint)
        }
      }
    }),
  )
}
