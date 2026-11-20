// Theme engine: branding.theme (+ the older accent_color) → CSS custom properties on a scope
// element (the document for the real portal, a frame for the Appearance preview).
//
// The whole UI is written with Tailwind's stone palette, `white` and the accent tokens. The
// engine redefines those per scope, so every screen follows the brand's background, surface,
// text and primary colours, light or dark, without a theme class on every element:
//   stone-50 … stone-950  a ramp from the background to the text colour (secondary text
//                         levels are pushed until they keep 4.5:1, WCAG AA)
//   white                 the surface colour (cards, panels, inputs)
//   accent*               primary, with a readable text colour picked automatically
//   radius-*, card-*, img-*, font-*  radius, card style, image fit/background, fonts
import type { BrandingTheme, ColorKey, PortalFont } from '../api/appearance'
import { contrast, parseHex } from './accent'

type RGB = [number, number, number]

export const DEFAULT_COLORS: Record<ColorKey, string> = {
  primary: '#2f5d62',
  secondary: '#7a5c99',
  background: '#f4f5f5',
  surface: '#ffffff',
  text: '#16191c',
}
const DARK_DEFAULTS = { background: '#111416', surface: '#1a1e21', text: '#eceeef' }

const WHITE: RGB = [255, 255, 255]
const BLACK: RGB = [0, 0, 0]
const toHex = (c: RGB) => '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgb = (hex: string | null | undefined, fallback: string): RGB => parseHex(hex) ?? parseHex(fallback)!
const isDark = (c: RGB) => contrast(c, BLACK) < contrast(c, WHITE)

/** The text colour (black or white) that reads best on `bg`. */
export function readableOn(bg: RGB): RGB {
  return contrast(bg, WHITE) >= contrast(bg, BLACK) ? WHITE : BLACK
}

/** Move `c` towards `to` in small steps until it has `min` contrast with every colour of `against`. */
function pushUntil(c: RGB, to: RGB, against: RGB[], min: number): RGB {
  let out = c
  for (let i = 0; i < 40 && against.some((a) => contrast(out, a) < min); i++) out = mix(out, to, 0.06)
  return out
}

export type Scheme = 'light' | 'dark'
export type Density = 'compact' | 'comfortable' | 'editorial'
export type CardStyle = 'plain' | 'bordered' | 'elevated'

export interface ResolvedTheme {
  scheme: Scheme
  density: Density
  cardStyle: CardStyle
  imageFit: 'contain' | 'cover'
  headingFont: PortalFont
  bodyFont: PortalFont
  /** Effective colours after the readability corrections. */
  colors: Record<ColorKey, string>
  vars: Record<string, string>
}

const RAMP: [string, number][] = [
  ['50', 0.025],
  ['100', 0.055],
  ['200', 0.11],
  ['300', 0.2],
  ['400', 0.4],
  ['500', 0.56],
  ['600', 0.66],
  ['700', 0.77],
  ['800', 0.87],
  ['900', 0.93],
  ['950', 0.97],
]

const RADIUS = {
  none: { control: '0px', sm: '0px', md: '0px', lg: '0px', xl: '0px', '2xl': '0px', card: '0px', image: '0px' },
  small: { control: '0.25rem', sm: '0.125rem', md: '0.1875rem', lg: '0.25rem', xl: '0.375rem', '2xl': '0.5rem', card: '0.375rem', image: '0.25rem' },
  medium: { control: '0.5rem', sm: '0.25rem', md: '0.375rem', lg: '0.5rem', xl: '0.75rem', '2xl': '1rem', card: '0.75rem', image: '0.5rem' },
  large: { control: '0.75rem', sm: '0.375rem', md: '0.5rem', lg: '0.75rem', xl: '1.125rem', '2xl': '1.5rem', card: '1.25rem', image: '1rem' },
} as const

const SYSTEM_SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Helvetica Neue', Arial, sans-serif"
const SERIF_FALLBACK = "ui-serif, Georgia, Cambria, 'Times New Roman', serif"

export const FONT_INFO: Record<PortalFont, { family: string; serif: boolean }> = {
  system: { family: '', serif: false },
  inter: { family: 'Inter', serif: false },
  'dm-sans': { family: 'DM Sans', serif: false },
  manrope: { family: 'Manrope', serif: false },
  'work-sans': { family: 'Work Sans', serif: false },
  jost: { family: 'Jost', serif: false },
  'space-grotesk': { family: 'Space Grotesk', serif: false },
  fraunces: { family: 'Fraunces', serif: true },
  'playfair-display': { family: 'Playfair Display', serif: true },
  'libre-baskerville': { family: 'Libre Baskerville', serif: true },
  'cormorant-garamond': { family: 'Cormorant Garamond', serif: true },
}

export function fontStack(font: PortalFont): string {
  const info = FONT_INFO[font]
  if (!info.family) return SYSTEM_SANS
  return `'OBX ${info.family}', ${info.serif ? SERIF_FALLBACK : SYSTEM_SANS}`
}

const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback)
const FONT_IDS = Object.keys(FONT_INFO) as PortalFont[]

/** `prefersDark` only matters for color_scheme "auto". */
export function resolveTheme(theme: BrandingTheme | null | undefined, accentColor?: string | null, prefersDark = false): ResolvedTheme {
  const t = theme ?? {}
  const c = (t.colors ?? {}) as Partial<Record<ColorKey, string | null>>
  const wanted = pick(t.color_scheme, ['light', 'dark', 'auto'] as const, 'light')
  const scheme: Scheme = wanted === 'auto' ? (prefersDark ? 'dark' : 'light') : wanted

  let bg = rgb(c.background, DEFAULT_COLORS.background)
  let surface = rgb(c.surface, DEFAULT_COLORS.surface)
  let text = rgb(c.text, DEFAULT_COLORS.text)
  if (scheme === 'dark') {
    // The brand's colours count in dark mode only when they are dark themselves (a brand that
    // chose "dark" set dark colours; with "auto" they are its light colours).
    const tint = rgb(c.primary ?? accentColor, DEFAULT_COLORS.primary)
    if (!(parseHex(c.background) && isDark(bg))) bg = mix(rgb(null, DARK_DEFAULTS.background), tint, 0.06)
    if (!(parseHex(c.surface) && isDark(surface))) surface = mix(bg, WHITE, 0.055)
    if (!(parseHex(c.text) && !isDark(text))) text = rgb(null, DARK_DEFAULTS.text)
  }
  // Body text must stay readable whatever was chosen (the editor warns as well).
  if (contrast(text, surface) < 4.5 || contrast(text, bg) < 4.5) text = pushUntil(text, readableOn(bg), [bg, surface], 7)

  const toward = scheme === 'dark' ? WHITE : BLACK
  let primary = rgb(c.primary ?? accentColor, DEFAULT_COLORS.primary)
  // Buttons: the primary colour with black or white text, whichever reads; a mid-tone that
  // reaches neither is shaded until one does.
  let onPrimary = readableOn(primary)
  if (contrast(primary, onPrimary) < 4.5) {
    primary = pushUntil(primary, scheme === 'dark' ? WHITE : BLACK, [scheme === 'dark' ? BLACK : WHITE], 4.5)
    onPrimary = readableOn(primary)
  }
  const soft = mix(surface, primary, scheme === 'dark' ? 0.22 : 0.1)
  // Links and active states use the primary colour as text: readable on surface, background and soft.
  const strong = pushUntil(primary, toward, [surface, bg, soft], 4.5)
  const secondary = rgb(c.secondary, DEFAULT_COLORS.secondary)
  const onSecondary = readableOn(secondary)

  const vars: Record<string, string> = {
    '--obx-bg': toHex(bg),
    '--obx-surface': toHex(surface),
    '--obx-text': toHex(text),
    '--accent': toHex(primary),
    '--accent-contrast': toHex(onPrimary),
    '--accent-soft': toHex(soft),
    '--accent-strong': toHex(strong),
    '--secondary': toHex(secondary),
    '--secondary-contrast': toHex(onSecondary),
    '--color-white': toHex(surface),
    '--obx-overlay': scheme === 'dark' ? 'rgb(0 0 0 / 0.6)' : 'rgb(20 22 24 / 0.45)',
  }
  for (const [step, f] of RAMP) {
    let shade = mix(bg, text, f)
    // Secondary text (500 and darker) keeps 4.5:1 on the background, the surface and stone-100.
    if (Number(step) >= 500) shade = pushUntil(shade, text, [bg, surface, mix(bg, text, 0.055)], 4.5)
    vars[`--color-stone-${step}`] = toHex(shade)
  }

  const radius = RADIUS[pick(t.radius, ['none', 'small', 'medium', 'large'] as const, 'medium')]
  vars['--radius-control'] = radius.control
  for (const k of ['sm', 'md', 'lg', 'xl', '2xl'] as const) vars[`--radius-${k}`] = radius[k]
  vars['--radius-card'] = radius.card
  vars['--radius-image'] = radius.image

  const cardStyle = pick(t.card_style, ['plain', 'bordered', 'elevated'] as const, 'plain')
  vars['--card-border'] = cardStyle === 'plain' && scheme === 'light' ? toHex(mix(surface, text, 0.1)) : toHex(mix(surface, text, cardStyle === 'elevated' ? 0.06 : 0.14))
  vars['--card-shadow'] = cardStyle === 'elevated' ? (scheme === 'dark' ? '0 1px 2px rgb(0 0 0 / 0.5), 0 8px 24px -8px rgb(0 0 0 / 0.6)' : '0 1px 2px rgb(16 24 40 / 0.06), 0 12px 32px -12px rgb(16 24 40 / 0.18)') : '0 0 #0000'

  const imageFit = pick(t.image_fit, ['contain', 'cover'] as const, 'contain')
  vars['--img-fit'] = imageFit
  const imageBg = parseHex(t.image_background) ? rgb(t.image_background, '') : mix(bg, text, scheme === 'dark' ? 0.04 : 0.03)
  vars['--img-bg'] = toHex(imageBg)

  const headingFont = pick(t.heading_font, FONT_IDS, 'system')
  const bodyFont = pick(t.body_font, FONT_IDS, 'system')
  vars['--font-sans'] = fontStack(bodyFont)
  vars['--font-display'] = fontStack(headingFont)
  // Serif display faces need less weight and no negative tracking.
  vars['--display-weight'] = FONT_INFO[headingFont].serif ? '500' : '650'
  vars['--display-tracking'] = FONT_INFO[headingFont].serif ? '-0.01em' : '-0.025em'

  return {
    scheme,
    density: pick(t.grid_density, ['compact', 'comfortable', 'editorial'] as const, 'comfortable'),
    cardStyle,
    imageFit,
    headingFont,
    bodyFont,
    colors: { primary: toHex(primary), secondary: toHex(secondary), background: toHex(bg), surface: toHex(surface), text: toHex(text) },
    vars,
  }
}

// ---------------------------------------------------------------- fonts (lazy, self-hosted)

// One CSS file per font with @font-face rules for the Latin and Latin Extended subsets
// (src/fonts/<id>/). Only fonts a theme uses are loaded; the browser then downloads only the
// subsets the page's text needs. Other scripts (Greek, Cyrillic) fall back to the system font.
const FONT_CSS: Record<Exclude<PortalFont, 'system'>, () => Promise<unknown>> = {
  inter: () => import('../fonts/inter/inter.css'),
  'dm-sans': () => import('../fonts/dm-sans/dm-sans.css'),
  manrope: () => import('../fonts/manrope/manrope.css'),
  'work-sans': () => import('../fonts/work-sans/work-sans.css'),
  jost: () => import('../fonts/jost/jost.css'),
  'space-grotesk': () => import('../fonts/space-grotesk/space-grotesk.css'),
  fraunces: () => import('../fonts/fraunces/fraunces.css'),
  'playfair-display': () => import('../fonts/playfair-display/playfair-display.css'),
  'libre-baskerville': () => import('../fonts/libre-baskerville/libre-baskerville.css'),
  'cormorant-garamond': () => import('../fonts/cormorant-garamond/cormorant-garamond.css'),
}
const loaded = new Map<PortalFont, Promise<unknown>>()

export function loadFont(font: PortalFont): Promise<unknown> {
  if (font === 'system') return Promise.resolve()
  let p = loaded.get(font)
  if (!p) {
    p = FONT_CSS[font]().catch(() => loaded.delete(font))
    loaded.set(font, p)
  }
  return p
}

// ---------------------------------------------------------------- applying

const applied = new WeakMap<HTMLElement, string[]>()

/** Set the theme's variables on `el` (and remove the ones of a previous theme). */
export function applyTheme(el: HTMLElement, theme: ResolvedTheme) {
  for (const k of applied.get(el) ?? []) if (!(k in theme.vars)) el.style.removeProperty(k)
  for (const [k, v] of Object.entries(theme.vars)) el.style.setProperty(k, v)
  applied.set(el, Object.keys(theme.vars))
  el.dataset.scheme = theme.scheme
  el.style.colorScheme = theme.scheme
  void loadFont(theme.headingFont)
  void loadFont(theme.bodyFont)
}

/** Contrast problems of chosen colours, for the editor's warnings (WCAG AA, 4.5:1 for text). */
export function contrastIssues(colors: Partial<Record<ColorKey, string | null>> | null | undefined): { pair: 'textBackground' | 'textSurface' | 'primaryBackground'; ratio: number }[] {
  const c = colors ?? {}
  const bg = rgb(c.background, DEFAULT_COLORS.background)
  const surface = rgb(c.surface, DEFAULT_COLORS.surface)
  const text = rgb(c.text, DEFAULT_COLORS.text)
  const out: { pair: 'textBackground' | 'textSurface' | 'primaryBackground'; ratio: number }[] = []
  const check = (pair: (typeof out)[number]['pair'], a: RGB, b: RGB, min: number) => {
    const r = contrast(a, b)
    if (r < min) out.push({ pair, ratio: Math.round(r * 100) / 100 })
  }
  if (c.text || c.background) check('textBackground', text, bg, 4.5)
  if (c.text || c.surface) check('textSurface', text, surface, 4.5)
  // Links in the primary colour; a light primary is darkened automatically, but say so.
  if (c.primary) check('primaryBackground', rgb(c.primary, ''), bg, 3)
  return out
}

export const ratio = (a: string, b: string) => {
  const x = parseHex(a)
  const y = parseHex(b)
  return x && y ? contrast(x, y) : 0
}
