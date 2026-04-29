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

  const itemLines = items.map((item) => {
    const sizeLabel    = item.selectedSize
      ? ` (${SIZE_LABELS[item.selectedSize]?.ar ?? item.selectedSize})`
      : ''
    const variantLabel = item.selectedVariant ? ` — ${item.selectedVariant}` : ''
    const lineTotal    = (item.priceBhd * item.quantity).toFixed(3)
    return `• ${item.quantity}× ${item.nameAr}${sizeLabel}${variantLabel} — ${lineTotal} BD`
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
  notes?:         string
  orderNumber?:   string  // short ID shown to customer, e.g. last 8 chars of UUID
}

export function formatCheckoutMessage(
  items: CartItem[],
  branchId: BranchId,
  options: CheckoutMessageOptions = {},
): string {
  if (items.length === 0) return ''

  const branch   = BRANCHES[branchId]
  const subtotal = selectSubtotal(items)

  const itemLines = items.map((item) => {
    const sizeLabel    = item.selectedSize
      ? ` (${SIZE_LABELS[item.selectedSize]?.ar ?? item.selectedSize})`
      : ''
    const variantLabel = item.selectedVariant ? ` — ${item.selectedVariant}` : ''
    const lineTotal    = (item.priceBhd * item.quantity).toFixed(3)
    return `• ${item.quantity}× ${item.nameAr}${sizeLabel}${variantLabel} — ${lineTotal} BD`
  })

  const lines: string[] = [
    'طلب جديد',
    DIVIDER,
    `الفرع: ${branch.nameAr}`,
  ]

  if (options.orderNumber) lines.push(`رقم الطلب: #${options.orderNumber}`)
  if (options.customerName)  lines.push(`الاسم: ${options.customerName}`)
  if (options.customerPhone) lines.push(`الهاتف: ${options.customerPhone}`)

  lines.push('', 'الطلب:', ...itemLines, DIVIDER, `الإجمالي: ${subtotal.toFixed(3)} BD`)

  if (options.notes) {
    lines.push('', `ملاحظات: ${options.notes}`)
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
