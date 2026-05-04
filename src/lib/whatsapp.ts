import { BRANCHES, buildWaLinkForPhone, type BranchId } from '@/constants/contact'
import { type CartItem, SIZE_LABELS, selectSubtotal } from '@/lib/cart'

// ── Message formatter — Arabic only (per PLAN.md) ────────────────────────────

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━'

export function formatOrderMessage(
  items: CartItem[],
  branchId: BranchId,
): string {
  if (items.length === 0) return ''

  const branch   = BRANCHES[branchId]
  const subtotal = selectSubtotal(items)

  const itemLines = items.flatMap((item) => {
    const sizeLabel    = item.selectedSize
      ? ` (${SIZE_LABELS[item.selectedSize]?.ar ?? item.selectedSize})`
      : ''
    const variantLabel = item.selectedVariant ? ` — ${item.selectedVariant}` : ''
    const lineTotal    = (item.priceBhd * item.quantity).toFixed(3)
    const line = `• ${item.quantity}× ${item.nameAr}${sizeLabel}${variantLabel} — ${lineTotal} BD`
    return item.notes ? [line, `  ↳ ${item.notes}`] : [line]
  })

  return [
    'طلب جديد',
    DIVIDER,
    `الفرع: ${branch.nameAr}`,
    '',
    'الطلب:',
    ...itemLines,
    DIVIDER,
    `الإجمالي: ${subtotal.toFixed(3)} BD`,
  ].join('\n')
}

// ── Checkout message — includes customer details + order number ────────────────

export interface CheckoutMessageOptions {
  customerName?:  string
  customerPhone?: string
  address?:       string  // formatted delivery address or Maps link
  notes?:         string
  orderNumber?:   string  // short ID shown to customer, e.g. last 8 chars of UUID
  trackingUrl?:   string
}

export function formatCheckoutMessage(
  items: CartItem[],
  branchId: BranchId,
  options: CheckoutMessageOptions = {},
): string {
  if (items.length === 0) return ''

  const branch   = BRANCHES[branchId]
  const subtotal = selectSubtotal(items)

  const itemLines = items.flatMap((item) => {
    const sizeLabel    = item.selectedSize
      ? ` (${SIZE_LABELS[item.selectedSize]?.ar ?? item.selectedSize})`
      : ''
    const variantLabel = item.selectedVariant ? ` — ${item.selectedVariant}` : ''
    const lineTotal    = (item.priceBhd * item.quantity).toFixed(3)
    const line = `• ${item.quantity}× ${item.nameAr}${sizeLabel}${variantLabel} — ${lineTotal} BD`
    return item.notes ? [line, `  ↳ ${item.notes}`] : [line]
  })

  const lines: string[] = [
    'طلب جديد',
    DIVIDER,
    `الفرع: ${branch.nameAr}`,
  ]

  if (options.orderNumber) lines.push(`رقم الطلب: #${options.orderNumber}`)
  if (options.customerName)  lines.push(`الاسم: ${options.customerName}`)
  if (options.customerPhone) lines.push(`الهاتف: ${options.customerPhone}`)
  if (options.address)       lines.push(`العنوان: ${options.address}`)

  lines.push('', 'الطلب:', ...itemLines, DIVIDER, `الإجمالي: ${subtotal.toFixed(3)} BD`)

  if (options.notes) {
    lines.push('', `ملاحظات: ${options.notes}`)
  }
  if (options.trackingUrl) {
    lines.push('', 'تتبع طلبك:', options.trackingUrl)
  }

  return lines.join('\n')
}

// ── Link builders ─────────────────────────────────────────────────────────────

export function buildWhatsAppOrderLink(
  items: CartItem[],
  branchId: BranchId,
): string {
  const branch  = BRANCHES[branchId]
  const message = formatOrderMessage(items, branchId)
  return buildWaLinkForPhone(branch.whatsapp, message)
}

export function buildWhatsAppCheckoutLink(
  items: CartItem[],
  branchId: BranchId,
  options: CheckoutMessageOptions = {},
): string {
  const branch  = BRANCHES[branchId]
  const message = formatCheckoutMessage(items, branchId, options)
  return buildWaLinkForPhone(branch.whatsapp, message)
}

// ── Customer contact link (dynamic phone from order data) ─────────────────────

export function buildCustomerContactLink(customerPhone: string, message?: string): string {
  return buildWaLinkForPhone(customerPhone, message)
}

export function buildOrderTrackingUrl(
  orderId: string,
  locale: string,
  accessToken?: string | null,
): string {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '')
  const localePrefix = locale === 'en' ? '/en' : ''
  const path = `${localePrefix}/order/${orderId}${accessToken ? `?t=${encodeURIComponent(accessToken)}` : ''}`
  return siteUrl ? `${siteUrl}${path}` : path
}
