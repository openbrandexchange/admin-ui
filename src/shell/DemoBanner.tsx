import { useTranslation } from 'react-i18next'
import { useDemo } from '../lib/demo'

/** "Demo, fictional data" on every page of a demo portal (node demo mode). */
export function DemoBanner() {
  const { t } = useTranslation()
  const demo = useDemo()
  if (!demo) return null
  return (
    <div className="bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-950" role="note">
      <strong className="font-semibold">{t('demo.banner')}</strong>
      <span aria-hidden="true"> · </span>
      <span>{t('demo.bannerNote')}</span>
    </div>
  )
}
