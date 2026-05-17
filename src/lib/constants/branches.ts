import { BRANCHES as CONTACT_BRANCHES, isHiddenBranch } from '@/constants/contact'

export const BRANCHES = [
  {
    id: 'riffa',
    name_ar: CONTACT_BRANCHES.riffa.nameAr,
    name_en: CONTACT_BRANCHES.riffa.nameEn,
    area_ar: 'منطقة الحجيات الرفاع',
    area_en: 'Al-Hijiyat Area, Riffa',
    city_ar: CONTACT_BRANCHES.riffa.cityAr,
    city_en: CONTACT_BRANCHES.riffa.cityEn,
    phone: CONTACT_BRANCHES.riffa.phone,
    whatsapp: CONTACT_BRANCHES.riffa.whatsapp.replace(/\D/g, ''),
    opens: CONTACT_BRANCHES.riffa.hours.opens,
    closes: CONTACT_BRANCHES.riffa.hours.closes,
    opens_display_ar: '٧:٠٠ ص',
    closes_display_ar: '٢:٠٠ ص',
    opens_display_en: '7:00 AM',
    closes_display_en: '2:00 AM',
    googleMaps: CONTACT_BRANCHES.riffa.mapsUrl,
    status: 'active' as const,
  },
  {
    id: 'qallali',
    name_ar: CONTACT_BRANCHES.qallali.nameAr,
    name_en: CONTACT_BRANCHES.qallali.nameEn,
    area_ar: 'الشارع الرئيسي قلالي',
    area_en: 'Main Road, Qallali',
    city_ar: CONTACT_BRANCHES.qallali.cityAr,
    city_en: CONTACT_BRANCHES.qallali.cityEn,
    phone: CONTACT_BRANCHES.qallali.phone,
    whatsapp: CONTACT_BRANCHES.qallali.whatsapp.replace(/\D/g, ''),
    opens: CONTACT_BRANCHES.qallali.hours.opens,
    closes: CONTACT_BRANCHES.qallali.hours.closes,
    opens_display_ar: '١٢:٠٠ م',
    closes_display_ar: '١:٠٠ ص',
    opens_display_en: '12:00 PM',
    closes_display_en: '1:00 AM',
    googleMaps: CONTACT_BRANCHES.qallali.mapsUrl,
    status: 'active' as const,
  },
].filter((branch) => !isHiddenBranch(branch.id))

export type Branch = typeof BRANCHES[number]

export const ACTIVE_BRANCHES = BRANCHES.filter((branch) => branch.status === 'active')
