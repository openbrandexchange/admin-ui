// The Appearance editor's draft: what the brand changes before saving, and the merge patch
// that saves it (RFC 7396: null removes a member; home.blocks is sent whole, since a merge
// patch replaces arrays).
import type { BlockType, BrandingLogin, BrandingTheme, HomeBlock, PortalText } from '../../../api/appearance'
import type { PortalViewer, Settings, SettingsPatch } from '../../../api/types'
import { brandingImageUrl } from '../../../lib/branding'

export interface Draft {
  theme: BrandingTheme
  login: BrandingLogin
  blocks: HomeBlock[]
}

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T))

/** Drop the node-resolved URLs (read-only, recomputed from the ids). */
function stripUrls<T>(o: T): T {
  if (Array.isArray(o)) return o.map(stripUrls) as T
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'image_url' && k !== 'background_image_url').map(([k, v]) => [k, stripUrls(v)])) as T
  return o
}

export function draftOf(settings: Settings): Draft {
  const b = settings.branding ?? {}
  return {
    theme: clone(b.theme ?? {}) as BrandingTheme,
    login: stripUrls(clone(b.login ?? {})) as BrandingLogin,
    blocks: stripUrls(clone((b.home?.blocks ?? []) as unknown as HomeBlock[])),
  }
}

/** Merge patch for a localized text inside an object that is merged member by member. */
function textPatch(before: PortalText | undefined, after: PortalText | undefined): Record<string, string | null> | null {
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(after ?? {})) if (v?.trim()) clean[k] = v.trim()
  if (!Object.keys(clean).length) return null
  const out: Record<string, string | null> = { ...clean }
  for (const k of Object.keys(before ?? {})) if (!(k in clean)) out[k] = null
  return out
}

/** Texts inside blocks are replaced whole (arrays): only trim and drop empty languages. */
function cleanText(t: PortalText | undefined): PortalText {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(t ?? {})) if (typeof v === 'string' && v.trim()) out[k] = v.trim()
  return Object.keys(out).length ? out : null
}

const TEXT_KEYS = ['title', 'text', 'body', 'button_label']

function cleanBlock(b: HomeBlock): HomeBlock {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(stripUrls(b))) {
    if (TEXT_KEYS.includes(k) && (v === null || typeof v === 'object')) out[k] = cleanText(v as PortalText)
    else if (k === 'items' && Array.isArray(v)) out[k] = v.map((it: Record<string, unknown>) => ({ ...it, title: cleanText(it.title as PortalText) }))
    else if (typeof v === 'string' && ['link', 'query', 'name', 'email', 'phone'].includes(k)) out[k] = v.trim() || null
    else out[k] = v
  }
  return out as HomeBlock
}

export function patchOf(saved: Settings, draft: Draft): SettingsPatch {
  const before = draftOf(saved)
  const colors = draft.theme.colors ?? {}
  const theme: Record<string, unknown> = { ...draft.theme, colors: { ...colors } }
  // Every member the editor knows is sent (null = default); unknown members stay untouched.
  for (const k of ['color_scheme', 'heading_font', 'body_font', 'radius', 'grid_density', 'card_style', 'image_fit', 'image_background'] as const) theme[k] = draft.theme[k] ?? null
  for (const k of ['primary', 'secondary', 'background', 'surface', 'text'] as const) (theme.colors as Record<string, unknown>)[k] = colors[k] || null
  const login: Record<string, unknown> = {
    ...stripUrls(draft.login),
    layout: draft.login.layout ?? null,
    background_image: draft.login.background_image ?? null,
    title: textPatch(before.login.title, draft.login.title),
    text: textPatch(before.login.text, draft.login.text),
  }
  return {
    branding: {
      // Older portals read accent_color: keep it the same as the primary colour.
      ...(colors.primary ? { accent_color: colors.primary } : {}),
      theme,
      login,
      home: { blocks: draft.blocks.map(cleanBlock) },
    } as never,
  }
}

/** The viewer's branding with the draft applied, as the preview renders it. */
export function previewBranding(base: PortalViewer['branding'], settings: Settings, draft: Draft): PortalViewer['branding'] {
  const withUrl = <T extends Record<string, unknown>>(o: T): T => (typeof o.image === 'string' ? { ...o, image_url: brandingImageUrl(o.image) } : o)
  const blocks = draft.blocks.map((b) => ({ ...withUrl(b), ...(Array.isArray(b.items) && { items: (b.items as Record<string, unknown>[]).map(withUrl) }) }))
  return {
    ...base,
    name: settings.branding?.display_name || base.name,
    logo_url: settings.branding?.logo_url ?? null,
    favicon_url: settings.branding?.favicon_url ?? null,
    accent_color: draft.theme.colors?.primary || settings.branding?.accent_color || null,
    theme: draft.theme,
    login: { ...draft.login, background_image_url: brandingImageUrl(draft.login.background_image) },
    home: { blocks: blocks as never },
  }
}

let counter = 0
export const newBlockId = (type: string) => `${type.replace('_', '-')}-${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}`

export function newBlock(type: BlockType, lang: string): HomeBlock {
  const id = newBlockId(type)
  switch (type) {
    case 'hero':
      return { id, type, title: { [lang]: '' }, align: 'left', height: 'large', overlay: 'dark' }
    case 'tiles':
      return { id, type, columns: 3, items: [{ title: null, link: null }, { title: null, link: null }, { title: null, link: null }] }
    case 'text':
      return { id, type, title: null, body: null }
    case 'image_text':
      return { id, type, image_side: 'left' }
    case 'products':
      return { id, type, max: 8 }
    case 'announcement':
      return { id, type, tone: 'info' }
    case 'contact':
      return { id, type, name: null, email: null, phone: null }
  }
}

/** Image ids the draft uses (the library marks them, and refuses to delete them). */
export function usedImages(draft: Draft): Set<string> {
  const out = new Set<string>()
  if (draft.login.background_image) out.add(draft.login.background_image)
  for (const b of draft.blocks) {
    if (typeof b.image === 'string') out.add(b.image)
    for (const it of (Array.isArray(b.items) ? b.items : []) as { image?: string | null }[]) if (it.image) out.add(it.image)
  }
  return out
}
