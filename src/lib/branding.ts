import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import type { BrandingTheme, HomeBlock, PortalText } from '../api/appearance'
import { apiUrl } from '../api/client'
import type { PortalViewer, PublicBranding } from '../api/types'
import { localized } from './localized'
import { applyTheme, resolveTheme, type ResolvedTheme } from './theme'

/**
 * "<Brand name> · <local word>", e.g. "Kestrel · Beeldbank". The local word comes from the
 * glossary per language unless the brand set its own.
 */
export function usePortalTitle(branding: PublicBranding | undefined): { brand: string; word: string; full: string } {
  const { t, i18n } = useTranslation()
  const brand = branding?.name ?? ''
  const override = localized(branding?.portal_name, i18n.language)
  const word = override || t('glossary.portal')
  return { brand, word, full: brand ? `${brand} · ${word}` : word }
}

/**
 * A text shown to retailers (PortalText): the reader's language, else the brand's default
 * language, else any language the brand filled in.
 */
export function portalText(text: PortalText | undefined, lang: string, defaultLang?: string): string {
  if (!text) return ''
  const base = lang.split('-')[0]
  const keys = Object.keys(text).filter((k) => text[k]?.trim())
  const key = keys.find((k) => k === lang) ?? keys.find((k) => k.split('-')[0] === base) ?? (defaultLang && keys.find((k) => k === defaultLang || k.split('-')[0] === defaultLang.split('-')[0])) ?? keys[0]
  return key ? text[key] : ''
}

/** URL of a branding image: the node's resolved URL, else the public image path of its id. */
export function brandingImageUrl(id: string | null | undefined, resolved?: string | null): string | null {
  if (resolved) return resolved
  if (!id) return null
  return apiUrl(`/admin/api/public/images/${encodeURIComponent(id)}`)
}

// ---------------------------------------------------------------- preview

/** What the Appearance editor shows: the retailer screens with unsaved settings. */
export interface PreviewState {
  branding: PortalViewer['branding']
  /** The editor's selected block, highlighted in the preview. */
  focusBlock?: string | null
}
export const PreviewContext = createContext<PreviewState | null>(null)
export const usePreview = () => useContext(PreviewContext)

// ---------------------------------------------------------------- theme

const darkQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null
const subscribeDark = (cb: () => void) => {
  darkQuery?.addEventListener?.('change', cb)
  return () => darkQuery?.removeEventListener?.('change', cb)
}
export const usePrefersDark = () => useSyncExternalStore(subscribeDark, () => !!darkQuery?.matches, () => false)

/** The resolved theme of a branding (memoised on its content). */
export function useResolvedTheme(theme: BrandingTheme | null | undefined, accent: string | null | undefined): ResolvedTheme {
  const dark = usePrefersDark()
  const key = JSON.stringify([theme ?? null, accent ?? null, dark])
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialised content
  return useMemo(() => resolveTheme(theme, accent, dark), [key])
}

/** The theme in effect for this part of the page (the preview frame sets its own). */
export const ThemeContext = createContext<ResolvedTheme>(resolveTheme(null))
export const useTheme = () => useContext(ThemeContext)

const DEFAULT_ICON = typeof document !== 'undefined' ? document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.href ?? null : null

function setFavicon(url: string | null | undefined) {
  if (typeof document === 'undefined') return
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) return
  const href = url || DEFAULT_ICON
  if (href && link.href !== href) {
    link.href = href
    link.type = url ? '' : 'image/svg+xml'
  }
}

/**
 * Apply the theme, favicon and document title of a branding to the whole page. Inside the
 * Appearance preview nothing is applied to the document (the preview frame has its own scope).
 */
export function useApplyBranding(theme: ResolvedTheme, title: string, favicon?: string | null) {
  const preview = usePreview()
  useEffect(() => {
    if (!preview) applyTheme(document.documentElement, theme)
  }, [theme, preview])
  useEffect(() => {
    if (!preview && title) document.title = title
  }, [title, preview])
  useEffect(() => {
    if (!preview) setFavicon(favicon)
  }, [favicon, preview])
}

/** The home page blocks the UI can show (unknown types are skipped). */
export const homeBlocks = (b: { home?: { blocks?: HomeBlock[] | null } | null } | undefined) => (b?.home?.blocks ?? []).filter((x) => x && typeof x.type === 'string')
