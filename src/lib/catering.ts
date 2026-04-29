import { getMenuItemsByIds } from '@/lib/menu'

export type LocaleCode = 'ar' | 'en'

export const CATERING_EVENT_TYPES = [
  'familyFeasts',
  'businessMeetings',
  'majlis',
  'privateOccasions',
] as const

export const CATERING_PROTOCOL_STEPS = [
  'request',
  'review',
  'confirmation',
  'preparation',
] as const

export const CATERING_REQUEST_STYLES = [
  'familyOrder',
  'corporateHospitality',
  'iraqiFeast',
] as const

export const CATERING_FALLBACK_DISHES = [
  'iraqiRice',
  'grills',
  'appetizers',
  'sharingDishes',
  'dessertsDrinks',
] as const

const SIGNATURE_CATERING_ITEM_IDS = [
  'grills-kahramana-mix',
  'mains-quzi-iraqi-lamb',
  'mains-dolma',
  'mains-quzi-iraqi-chicken',
  'mains-biryani-meat',
  'mains-machbous-chicken',
] as const

export interface CateringSignatureDish {
  id: string
  title: string
  description?: string
  imageUrl?: string
}

export function getCateringSignatureDishes(locale: LocaleCode): CateringSignatureDish[] {
  return getMenuItemsByIds(SIGNATURE_CATERING_ITEM_IDS)
    .filter((item) => item.available)
    .map((item) => ({
      id: item.id,
      title: locale === 'ar' ? item.name.ar : item.name.en,
      description: locale === 'ar' ? item.description?.ar : item.description?.en,
      imageUrl: item.image_url,
    }))
}
