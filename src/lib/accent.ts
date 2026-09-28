// Brand accent colour → CSS custom properties with readable text on top.

const HEX = /^#([0-9a-fA-F]{6})$/

export function parseHex(hex: string | null | undefined): [number, number, number] | null {
  const m = HEX.exec((hex ?? '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function channel(c: number) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function luminance(rgb: [number, number, number]): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
}

/** WCAG contrast ratio between two colours. */
export function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const toHex = (rgb: number[]) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

export const DEFAULT_ACCENT = '#2f5d62'

/**
 * CSS variables for an accent colour. Very light accents are darkened until white-on-accent
 * or black-on-accent reaches 4.5:1, so buttons stay readable whatever the brand picks.
 */
export function accentVars(hex: string | null | undefined): Record<string, string> {
  let rgb = parseHex(hex) ?? parseHex(DEFAULT_ACCENT)!
  const white: [number, number, number] = [255, 255, 255]
  const black: [number, number, number] = [0, 0, 0]
  let fg = contrast(rgb, white) >= contrast(rgb, black) ? white : black
  // Mid-tone colours reach neither; darken towards black until white text passes.
  for (let i = 0; i < 20 && contrast(rgb, fg) < 4.5; i++) {
    rgb = mix(rgb, black, 0.08)
    fg = white
  }
  return {
    '--accent': toHex(rgb),
    '--accent-contrast': toHex(fg),
    '--accent-soft': toHex(mix(rgb, white, 0.88)),
    '--accent-strong': toHex(mix(rgb, black, 0.2)),
  }
}

export function applyAccent(hex: string | null | undefined, el: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(accentVars(hex))) el.style.setProperty(k, v)
}
