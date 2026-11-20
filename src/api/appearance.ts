// Portal appearance (Node Admin API 0.3.1, additive): branding.theme, branding.login,
// branding.home, branding.favicon_url and the branding image library.
// Theme, login page and images are the generated types. The start page blocks are written out
// here as a union the UI can narrow on `type` (openapi-typescript turns the spec's
// "any other type" block into an unusable literal); they have the same members as the spec's.
// Every member is optional or nullable: null = the node default (the look before 0.3.1).
// Unknown members and unknown block types are kept as they are (index signatures) and ignored.
import type { components } from './admin'

type S = components['schemas']
export type PortalText = S['PortalText']
export type HexColor = S['HexColor']
export type ImageId = S['ImageId']
export type BrandingTheme = S['BrandingTheme']
export type BrandingLogin = S['BrandingLogin']
export type BrandingImage = S['BrandingImage']

export const FONTS = ['system', 'inter', 'dm-sans', 'manrope', 'work-sans', 'jost', 'space-grotesk', 'fraunces', 'playfair-display', 'libre-baskerville', 'cormorant-garamond'] as const
export type PortalFont = NonNullable<S['PortalFont']>

export const COLOR_KEYS = ['primary', 'secondary', 'background', 'surface', 'text'] as const
export type ColorKey = (typeof COLOR_KEYS)[number]



/** `link`: a portal path starting with a single "/" or an https:// URL. */
export type PortalLink = string | null

interface BlockBase {
  id: string
  [key: string]: unknown
}

export interface HeroBlock extends BlockBase {
  type: 'hero'
  image?: ImageId | null
  image_url?: string | null
  title?: PortalText
  text?: PortalText
  button_label?: PortalText
  link?: PortalLink
  align?: 'left' | 'center' | null
  height?: 'medium' | 'large' | null
  overlay?: 'none' | 'dark' | 'light' | null
}

export interface TileItem {
  image?: ImageId | null
  image_url?: string | null
  title?: PortalText
  link?: PortalLink
  [key: string]: unknown
}

export interface TilesBlock extends BlockBase {
  type: 'tiles'
  title?: PortalText
  columns?: 2 | 3 | 4 | null
  items?: TileItem[]
}

export interface TextBlock extends BlockBase {
  type: 'text'
  title?: PortalText
  body?: PortalText
}

export interface ImageTextBlock extends BlockBase {
  type: 'image_text'
  image?: ImageId | null
  image_url?: string | null
  title?: PortalText
  text?: PortalText
  button_label?: PortalText
  link?: PortalLink
  image_side?: 'left' | 'right' | null
}

export interface ProductsBlock extends BlockBase {
  type: 'products'
  title?: PortalText
  style_numbers?: string[] | null
  query?: string | null
  max?: number | null
}

export interface AnnouncementBlock extends BlockBase {
  type: 'announcement'
  text?: PortalText
  tone?: 'neutral' | 'info' | 'success' | null
}

export interface ContactBlock extends BlockBase {
  type: 'contact'
  title?: PortalText
  name?: string | null
  email?: string | null
  phone?: string | null
}

export type KnownBlock = HeroBlock | TilesBlock | TextBlock | ImageTextBlock | ProductsBlock | AnnouncementBlock | ContactBlock
/** A block of a later version: stored and returned unchanged, skipped by the UI. */
export interface UnknownBlock extends BlockBase {
  type: string
}
export type HomeBlock = KnownBlock | UnknownBlock
export type BlockType = KnownBlock['type']
export const BLOCK_TYPES: readonly BlockType[] = ['hero', 'tiles', 'text', 'image_text', 'products', 'announcement', 'contact']
export const isKnownBlock = (b: HomeBlock): b is KnownBlock => (BLOCK_TYPES as readonly string[]).includes(b.type)

export interface BrandingHome {
  blocks?: HomeBlock[] | null
  [key: string]: unknown
}



export const MAX_BLOCKS = 30
export const MAX_TILES = 12
export const MAX_PRODUCTS = 24
export const MAX_TEXT = 2000
export const MAX_LONG_TEXT = 10_000
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_IMAGE_SIDE = 8000
export const MAX_FAVICON_BYTES = 1024 * 1024
