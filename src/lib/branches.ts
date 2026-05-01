import { BranchId } from '@/constants/contact'

export interface BranchMetadata {
  id: BranchId
  descriptionAr: string
  descriptionEn: string
  imageUrl?: string
  features: {
    ar: string
    en: string
  }[]
  services: {
    directOrder: boolean
    pickup: boolean
    delivery: string // Arabic status text
    deliveryEn: string // English status text
  }
}

export const BRANCH_EXTENDED_DATA: Record<BranchId, BranchMetadata> = {
  riffa: {
    id: 'riffa',
    descriptionAr: 'فرع كهرمانة بغداد في الرفاع يقدّم تجربة عراقية أصيلة للطلبات المباشرة والاستلام والتوصيل حسب التوفر التشغيلي.',
    descriptionEn: 'Kahramana Baghdad Riffa Branch serves an authentic Iraqi dining and ordering experience, with pickup and delivery availability based on operations.',
    imageUrl: '/images/branches/riffa.webp',
    features: [
      { ar: 'جلسات عائلية', en: 'Family Seating' },
      { ar: 'خدمة التوصيل', en: 'Delivery Service' },
      { ar: 'استلام خارجي', en: 'Curbside Pickup' },
    ],
    services: {
      directOrder: true,
      pickup: true,
      delivery: 'حسب التشغيل',
      deliveryEn: 'Based on operations',
    },
  },
  qallali: {
    id: 'qallali',
    descriptionAr: 'فرع قلالي يخدم عملاء المنطقة بتجربة طلب مباشرة ومنظمة، مع نفس جودة كهرمانة المعروفة في التحضير والتغليف.',
    descriptionEn: 'The Qallali Branch serves customers with a direct and organized ordering experience, maintaining Kahramana’s standard of preparation and packaging.',
    imageUrl: '/images/branches/qallali.webp',
    features: [
      { ar: 'تحضير سريع', en: 'Quick Prep' },
      { ar: 'توصيل محلي', en: 'Local Delivery' },
      { ar: 'مواقف مريحة', en: 'Ample Parking' },
    ],
    services: {
      directOrder: true,
      pickup: true,
      delivery: 'حسب التشغيل',
      deliveryEn: 'Based on operations',
    },
  },
  badi: {
    id: 'badi',
    descriptionAr: 'فرع البديع قيد التخطيط، وسيتم تفعيله في المنصة عند اكتمال الجاهزية التشغيلية وافتتاح الفرع رسميًا.',
    descriptionEn: 'The Al-Badi\' Branch is currently planned and will be activated on the platform once operational readiness and official opening are confirmed.',
    imageUrl: '/images/branches/badi_coming_soon.webp',
    features: [
      { ar: 'مساحة عصرية', en: 'Modern Space' },
      { ar: 'قسم مشاوي', en: 'Grills Section' },
      { ar: 'موقع استراتيجي', en: 'Prime Location' },
    ],
    services: {
      directOrder: false,
      pickup: false,
      delivery: 'غير متاح',
      deliveryEn: 'Not available',
    },
  },
}

export function getBranchMetadata(id: BranchId): BranchMetadata {
  return BRANCH_EXTENDED_DATA[id]
}
