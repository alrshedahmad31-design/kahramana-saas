'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { getCustomerSession } from '@/lib/auth/customerSession'
import type { TablesUpdate } from '@/lib/supabase/custom-types'

type FieldKey = 'name' | 'phone' | 'address'
type CustomerProfileUpdate = Pick<
  TablesUpdate<'customer_profiles'>,
  'name' | 'phone' | 'default_block' | 'default_road' | 'default_building' | 'default_flat' | 'default_area'
>
export type UpdateProfileResult =
  | { success: true }
  | { success: false; error: string; field?: FieldKey }

const profileSchema = z.object({
  name:             z.string().max(120, 'name_too_long').optional(),
  phone:            z.string().regex(/^\+973[0-9]{8}$/, 'phone_invalid').optional(),
  default_block:    z.string().max(60).optional(),
  default_road:     z.string().max(60).optional(),
  default_building: z.string().max(60).optional(),
  default_flat:     z.string().max(60).optional(),
  default_area:     z.string().max(60).optional(),
})

function normalizePhone(raw: string): string {
  const s = raw.replace(/[\s\-().]/g, '')
  if (s.startsWith('00973')) return '+973' + s.slice(5)
  if (s.startsWith('+973'))  return s
  if (s.startsWith('973') && s.length === 11) return '+' + s
  if (/^\d{8}$/.test(s)) return '+973' + s
  return s
}

export async function updateCustomerProfile(input: {
  name?: string
  phone?: string
  default_block?: string
  default_road?: string
  default_building?: string
  default_flat?: string
  default_area?: string
}): Promise<UpdateProfileResult> {
  const session = await getCustomerSession()
  if (!session) return { success: false, error: 'not_authenticated' }

  const normalizedPhone = input.phone ? normalizePhone(input.phone) : undefined
  const parsed = profileSchema.safeParse({
    ...input,
    phone: normalizedPhone,
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue.path[0]
    return {
      success: false,
      error: issue.message,
      field: field === 'name' ? 'name' : field === 'phone' ? 'phone' : 'address',
    }
  }

  const data = parsed.data
  const update: CustomerProfileUpdate = {}
  if (data.name             !== undefined) update.name             = data.name.trim() || null
  if (data.phone            !== undefined) update.phone            = data.phone
  if (data.default_block    !== undefined) update.default_block    = data.default_block.trim()    || null
  if (data.default_road     !== undefined) update.default_road     = data.default_road.trim()     || null
  if (data.default_building !== undefined) update.default_building = data.default_building.trim() || null
  if (data.default_flat     !== undefined) update.default_flat     = data.default_flat.trim()     || null
  if (data.default_area     !== undefined) update.default_area     = data.default_area.trim()     || null

  if (Object.keys(update).length === 0) {
    return { success: true }
  }

  const auth = await createClient()
  const { error } = await auth
    .from('customer_profiles')
    .update(update)
    .eq('id', session.id)

  if (error) {
    // 23505 = unique_violation on phone (taken by another customer).
    if (error.code === '23505') {
      return { success: false, error: 'phone_taken', field: 'phone' }
    }
    Sentry.captureException(new Error(error.message), {
      tags: { stage: 'account.updateCustomerProfile', code: error.code ?? 'unknown' },
      extra: { userId: session.id },
    })
    return { success: false, error: 'update_failed' }
  }

  revalidatePath('/[locale]/account', 'page')
  return { success: true }
}
