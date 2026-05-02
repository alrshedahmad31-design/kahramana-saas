'use server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import type { CateringOrderStatus, CateringPackageItem } from '@/lib/supabase/custom-types'

// ── Role guards ───────────────────────────────────────────────────────────────

const CATERING_ROLES = ['owner', 'general_manager', 'branch_manager', 'inventory_manager'] as const

async function requireCateringRole() {
  const session = await getSession()
  if (!session) return { session: null, error: 'Unauthorized' } as const
  if (!(CATERING_ROLES as readonly string[]).includes(session.role ?? '')) {
    return { session: null, error: 'Forbidden' } as const
  }
  return { session, error: null } as const
}

function revalidateCatering() {
  revalidatePath('/ar/dashboard/inventory/catering')
  revalidatePath('/en/dashboard/inventory/catering')
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateOrderSchema = z.object({
  branch_id:            z.string().min(1),
  package_id:           z.string().uuid().nullable().optional(),
  event_date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'event_date must be YYYY-MM-DD'),
  event_time:           z.string().nullable().optional(),
  venue_name:           z.string().nullable().optional(),
  venue_address:        z.string().nullable().optional(),
  guest_count:          z.number().int().min(1, 'يجب أن يكون عدد الضيوف 1 على الأقل'),
  client_name:          z.string().min(1, 'اسم العميل مطلوب'),
  client_phone:         z.string().min(1, 'رقم الهاتف مطلوب'),
  client_email:         z.string().email().nullable().optional(),
  price_per_person_bhd: z.number().min(0).default(0),
  deposit_bhd:          z.number().min(0).default(0),
  deposit_paid:         z.boolean().default(false),
  notes:                z.string().nullable().optional(),
})

const UpdateStatusSchema = z.object({
  orderId:   z.string().uuid(),
  newStatus: z.enum(['draft','quoted','confirmed','prep_started','delivered','invoiced','cancelled']),
})

const ConfirmOrderSchema = z.object({
  orderId:    z.string().uuid(),
  supplierId: z.string().uuid().nullable().optional(),
})

const DeleteOrderSchema = z.object({
  orderId: z.string().uuid(),
})

const CateringPackageItemSchema = z.object({
  menu_item_slug: z.string().min(1),
  qty_per_person: z.number().positive(),
  name_ar:        z.string().min(1),
  name_en:        z.string().min(1),
})

const UpsertPackageSchema = z.object({
  id:                   z.string().uuid().optional(),
  branch_id:            z.string().min(1),
  name_ar:              z.string().min(1, 'اسم الباقة بالعربي مطلوب'),
  name_en:              z.string().min(1, 'Package name in English is required'),
  description_ar:       z.string().nullable().optional(),
  description_en:       z.string().nullable().optional(),
  min_guests:           z.number().int().min(1).default(10),
  max_guests:           z.number().int().nullable().optional(),
  price_per_person_bhd: z.number().min(0),
  items:                z.array(CateringPackageItemSchema).default([]),
  is_active:            z.boolean().default(true),
})

// ── Actions ───────────────────────────────────────────────────────────────────

export async function createCateringOrder(formData: {
  branch_id:            string
  package_id?:          string | null
  event_date:           string
  event_time?:          string | null
  venue_name?:          string | null
  venue_address?:       string | null
  guest_count:          number
  client_name:          string
  client_phone:         string
  client_email?:        string | null
  price_per_person_bhd?: number
  deposit_bhd?:         number
  deposit_paid?:        boolean
  notes?:               string | null
}): Promise<{ orderId?: string; error?: string }> {
  const { session, error: authError } = await requireCateringRole()
  if (authError || !session) return { error: authError ?? 'Unauthorized' }

  const parsed = CreateOrderSchema.safeParse(formData)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { error: firstError?.message ?? 'بيانات غير صحيحة' }
  }

  const data = parsed.data
  const subtotal_bhd = data.price_per_person_bhd * data.guest_count

  const supabase = createServiceClient()
  const { data: order, error } = await supabase
    .from('catering_orders')
    .insert({
      branch_id:            data.branch_id,
      package_id:           data.package_id ?? null,
      event_date:           data.event_date,
      event_time:           data.event_time ?? null,
      venue_name:           data.venue_name ?? null,
      venue_address:        data.venue_address ?? null,
      guest_count:          data.guest_count,
      client_name:          data.client_name,
      client_phone:         data.client_phone,
      client_email:         data.client_email ?? null,
      price_per_person_bhd: data.price_per_person_bhd,
      subtotal_bhd,
      deposit_bhd:          data.deposit_bhd,
      deposit_paid:         data.deposit_paid,
      status:               'draft' as const,
      notes:                data.notes ?? null,
      created_by:           session.id,
    })
    .select('id')
    .single()

  if (error || !order) return { error: error?.message ?? 'فشل في إنشاء طلب التقديم' }

  revalidateCatering()
  return { orderId: order.id }
}

export async function updateCateringStatus(
  orderId: string,
  newStatus: CateringOrderStatus,
): Promise<{ error?: string }> {
  const { session, error: authError } = await requireCateringRole()
  if (authError || !session) return { error: authError ?? 'Unauthorized' }

  const parsed = UpdateStatusSchema.safeParse({ orderId, newStatus })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' }
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('catering_orders')
    .update({ status: parsed.data.newStatus, updated_at: new Date().toISOString() })
    .eq('id', parsed.data.orderId)

  if (error) return { error: error.message }

  revalidateCatering()
  return {}
}

export async function confirmCateringOrder(
  orderId: string,
  supplierId?: string,
): Promise<{ poId: string | null; error?: string }> {
  const { session, error: authError } = await requireCateringRole()
  if (authError || !session) return { poId: null, error: authError ?? 'Unauthorized' }

  const parsed = ConfirmOrderSchema.safeParse({ orderId, supplierId })
  if (!parsed.success) {
    return { poId: null, error: parsed.error.errors[0]?.message ?? 'بيانات غير صحيحة' }
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('rpc_catering_confirm', {
    p_order_id:    parsed.data.orderId,
    p_supplier_id: parsed.data.supplierId ?? undefined,
  })

  if (error) return { poId: null, error: error.message }

  revalidateCatering()
  revalidatePath('/ar/dashboard/inventory/purchases')
  revalidatePath('/en/dashboard/inventory/purchases')

  return { poId: data ?? null }
}

export async function calcCateringIngredients(
  orderId: string,
): Promise<{ snapshot?: unknown; error?: string }> {
  const { session, error: authError } = await requireCateringRole()
  if (authError || !session) return { error: authError ?? 'Unauthorized' }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('rpc_catering_calc_ingredients', {
    p_order_id: orderId,
  })

  if (error) return { error: error.message }

  revalidateCatering()
  return { snapshot: data }
}

export async function deleteCateringOrder(
  orderId: string,
): Promise<{ error?: string }> {
  const { session, error: authError } = await requireCateringRole()
  if (authError || !session) return { error: authError ?? 'Unauthorized' }

  const parsed = DeleteOrderSchema.safeParse({ orderId })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'معرّف الطلب غير صحيح' }
  }

  const supabase = createServiceClient()

  const { data: order, error: fetchError } = await supabase
    .from('catering_orders')
    .select('id, status')
    .eq('id', parsed.data.orderId)
    .single()

  if (fetchError || !order) return { error: fetchError?.message ?? 'طلب التقديم غير موجود' }

  if (!['draft', 'cancelled'].includes(order.status)) {
    return { error: 'لا يمكن حذف الطلبات إلا إذا كانت في حالة مسودة أو ملغاة' }
  }

  const { error } = await supabase
    .from('catering_orders')
    .delete()
    .eq('id', parsed.data.orderId)

  if (error) return { error: error.message }

  revalidateCatering()
  return {}
}

export async function upsertCateringPackage(data: {
  id?:                   string
  branch_id:             string
  name_ar:               string
  name_en:               string
  description_ar?:       string | null
  description_en?:       string | null
  min_guests?:           number
  max_guests?:           number | null
  price_per_person_bhd:  number
  items?:                CateringPackageItem[]
  is_active?:            boolean
}): Promise<{ packageId?: string; error?: string }> {
  const { session, error: authError } = await requireCateringRole()
  if (authError || !session) return { error: authError ?? 'Unauthorized' }

  const parsed = UpsertPackageSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'بيانات الباقة غير صحيحة' }
  }

  const { id, ...rest } = parsed.data
  const payload = { ...rest, updated_at: new Date().toISOString() }

  const supabase = createServiceClient()

  if (id) {
    const { error } = await supabase
      .from('catering_packages')
      .update(payload)
      .eq('id', id)

    if (error) return { error: error.message }

    revalidateCatering()
    return { packageId: id }
  }

  const { data: pkg, error } = await supabase
    .from('catering_packages')
    .insert(payload)
    .select('id')
    .single()

  if (error || !pkg) return { error: error?.message ?? 'فشل في حفظ الباقة' }

  revalidateCatering()
  return { packageId: pkg.id }
}
