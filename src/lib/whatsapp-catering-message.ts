import { BRANCHES, DEFAULT_BRANCH_ID, type BranchId } from '@/constants/contact'

export type CateringServiceType = 'pickup' | 'delivery' | 'coordination'

export interface CateringInquiryValues {
  name: string
  phone: string
  occasionType: string
  eventDate: string
  eventTime: string
  guestCount: string
  area: string
  preferredBranch: BranchId | ''
  serviceType: CateringServiceType | ''
  notes: string
  budget: string
}

export interface CateringWhatsappCopy {
  title: string
  emptyValue: string
  labels: {
    name: string
    phone: string
    occasionType: string
    eventDate: string
    eventTime: string
    guestCount: string
    area: string
    preferredBranch: string
    serviceType: string
    notes: string
    budget: string
  }
}

function resolveBranchId(branchId: BranchId | ''): BranchId {
  if (branchId && BRANCHES[branchId].waLink) return branchId
  return DEFAULT_BRANCH_ID
}

function normalizeValue(value: string, emptyValue: string): string {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : emptyValue
}

export function formatCateringWhatsappMessage(
  values: CateringInquiryValues,
  copy: CateringWhatsappCopy,
): string {
  const empty = copy.emptyValue

  return [
    copy.title,
    `${copy.labels.name}: ${normalizeValue(values.name, empty)}`,
    `${copy.labels.phone}: ${normalizeValue(values.phone, empty)}`,
    `${copy.labels.occasionType}: ${normalizeValue(values.occasionType, empty)}`,
    `${copy.labels.eventDate}: ${normalizeValue(values.eventDate, empty)}`,
    `${copy.labels.eventTime}: ${normalizeValue(values.eventTime, empty)}`,
    `${copy.labels.guestCount}: ${normalizeValue(values.guestCount, empty)}`,
    `${copy.labels.area}: ${normalizeValue(values.area, empty)}`,
    `${copy.labels.preferredBranch}: ${normalizeValue(values.preferredBranch, empty)}`,
    `${copy.labels.serviceType}: ${normalizeValue(values.serviceType, empty)}`,
    `${copy.labels.notes}: ${normalizeValue(values.notes, empty)}`,
    `${copy.labels.budget}: ${normalizeValue(values.budget, empty)}`,
  ].join('\n')
}

export function buildCateringWhatsappLink(
  values: CateringInquiryValues,
  copy: CateringWhatsappCopy,
): string {
  const branch = BRANCHES[resolveBranchId(values.preferredBranch)]
  const message = formatCateringWhatsappMessage(values, copy)
  return `${branch.waLink}?text=${encodeURIComponent(message)}`
}
