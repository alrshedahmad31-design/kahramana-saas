import { getLocale, getTranslations } from 'next-intl/server'
import { PROTOCOL_COLORS } from '@/lib/design-tokens'
import ProtocolStackClient, { type ProtocolStep } from './ProtocolStackClient'

const STEP_IDS  = ['01', '02', '03'] as const
const STEP_COLORS = [PROTOCOL_COLORS.step1, PROTOCOL_COLORS.step2, PROTOCOL_COLORS.step3]

export default async function ProtocolStack() {
  const locale = await getLocale()
  const isRTL  = locale === 'ar'
  const t      = await getTranslations('home.protocol')

  const steps: ProtocolStep[] = STEP_IDS.map((id, i) => ({
    id,
    title: t(`steps.${id}.title` as 'steps.01.title' | 'steps.02.title' | 'steps.03.title'),
    desc:  t(`steps.${id}.desc`  as 'steps.01.desc'  | 'steps.02.desc'  | 'steps.03.desc'),
    color: STEP_COLORS[i],
  }))

  return <ProtocolStackClient steps={steps} isRTL={isRTL} label={t('title')} />
}
