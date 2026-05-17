import { BRANCHES, DEFAULT_BRANCH_ID, type BranchId } from '@/constants/contact'

// Enum keys persisted to DB. Display strings live in i18n (`catering.form.*`
// for the public form, `dashboard.catering.*Types` for the staff dashboard).
export const CATERING_OCCASION_TYPES = [
  'familyFeast',
  'majlis',
  'corporateMeeting',
  'privateOccasion',
  'other',
] as const
export const CATERING_SERVICE_TYPES = ['pickup', 'delivery', 'coordination'] as const

export type CateringOccasionType = (typeof CATERING_OCCASION_TYPES)[number]
export type CateringServiceType  = (typeof CATERING_SERVICE_TYPES)[number]

export interface CateringInquiryValues {
  name: string
  phone: string
  occasionType: CateringOccasionType | ''
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
  // Localized display strings for the enum-keyed fields. The form passes
  // these in so the wa.me message body stays in the customer's locale
  // even though the persisted column is the enum key.
  occasionTypes: Record<CateringOccasionType, string>
  serviceTypes:  Record<CateringServiceType,  string>
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

  // Resolve enum keys back to localized labels for the customer-facing
  // wa.me message. Unknown keys fall through to the raw value so legacy
  // data still renders something readable.
  const occasionDisplay = values.occasionType
    ? copy.occasionTypes[values.occasionType] ?? values.occasionType
    : ''
  const serviceDisplay = values.serviceType
    ? copy.serviceTypes[values.serviceType] ?? values.serviceType
    : ''

  return [
    copy.title,
    `${copy.labels.name}: ${normalizeValue(values.name, empty)}`,
    `${copy.labels.phone}: ${normalizeValue(values.phone, empty)}`,
    `${copy.labels.occasionType}: ${normalizeValue(occasionDisplay, empty)}`,
    `${copy.labels.eventDate}: ${normalizeValue(values.eventDate, empty)}`,
    `${copy.labels.eventTime}: ${normalizeValue(values.eventTime, empty)}`,
    `${copy.labels.guestCount}: ${normalizeValue(values.guestCount, empty)}`,
    `${copy.labels.area}: ${normalizeValue(values.area, empty)}`,
    `${copy.labels.preferredBranch}: ${normalizeValue(values.preferredBranch, empty)}`,
    `${copy.labels.serviceType}: ${normalizeValue(serviceDisplay, empty)}`,
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
