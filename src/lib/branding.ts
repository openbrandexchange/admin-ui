import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { LocalizedText, PublicBranding } from '../api/types'
import { applyAccent } from './accent'
import { localized } from './localized'

/** Optional brand override of the portal's local word (PublicBranding/Settings branding.portal_name). */
type WithPortalName = { portal_name?: LocalizedText | null }

/**
 * "<Brand name> · <local word>", e.g. "Kestrel · Beeldbank". The local word comes from the
 * glossary per language unless the brand set its own.
 */
export function usePortalTitle(branding: PublicBranding | undefined): { brand: string; word: string; full: string } {
  const { t, i18n } = useTranslation()
  const brand = branding?.name ?? ''
  const override = localized((branding as (PublicBranding & WithPortalName) | undefined)?.portal_name, i18n.language)
  const word = override || t('glossary.portal')
  return { brand, word, full: brand ? `${brand} · ${word}` : word }
}

/** Apply the accent colour and the document title. */
export function useApplyBranding(accent: string | null | undefined, title: string) {
  useEffect(() => applyAccent(accent), [accent])
  useEffect(() => {
    if (title) document.title = title
  }, [title])
}
