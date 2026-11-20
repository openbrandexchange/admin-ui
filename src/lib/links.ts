// Links on the start page (spec PortalLink): a portal path starting with a single "/" or an
// https:// URL, nothing else. Portal paths open in the portal; https:// in a new tab.

export const PORTAL_LINK = /^(\/(?![/\\])|https:\/\/[^/\s])\S*$/

export const isPortalLink = (v: string | null | undefined): v is string => !!v && v.length <= 2000 && PORTAL_LINK.test(v)

const ARRAY_KEYS = new Set(['brand_id', 'item_type', 'color', 'season', 'collection', 'target_group', 'qualifier'])

export type ParsedLink = { external: true; href: string } | { external: false; to: string; search: Record<string, string | string[]> }

/** How to follow a link; null for anything that is not a valid PortalLink. */
export function parseLink(link: string | null | undefined): ParsedLink | null {
  if (!isPortalLink(link)) return null
  if (link.startsWith('https://')) return { external: true, href: link }
  const url = new URL(link, 'https://portal.invalid')
  const search: Record<string, string | string[]> = {}
  for (const key of new Set(url.searchParams.keys())) {
    const all = url.searchParams.getAll(key).filter(Boolean)
    if (!all.length) continue
    search[key] = ARRAY_KEYS.has(key) ? all : all[0]
  }
  return { external: false, to: url.pathname.replace(/\/+$/, '') || '/', search }
}

/** A catalogue link for a filter, as the link picker writes it. */
export function catalogLink(filter: Record<string, string[] | string | undefined>): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filter)) for (const x of Array.isArray(v) ? v : v ? [v] : []) params.append(k, x)
  const q = params.toString()
  return '/catalog' + (q ? `?${q}` : '')
}

/** A products block query (`season=AW26&qualifier=organic`) → a portal product filter. */
export function queryFilter(query: string | null | undefined): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  const params = new URLSearchParams(query ?? '')
  for (const key of new Set(params.keys())) {
    if (key === 'cursor' || key === 'limit') continue
    const all = params.getAll(key).filter(Boolean)
    if (all.length) out[key] = ARRAY_KEYS.has(key) ? all : all[0]
  }
  return out
}
