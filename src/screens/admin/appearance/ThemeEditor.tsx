import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COLOR_KEYS, FONTS, MAX_FAVICON_BYTES, type BrandingTheme, type ColorKey, type PortalFont } from '../../../api/appearance'
import type { Settings } from '../../../api/types'
import { contrastIssues, DEFAULT_COLORS, FONT_INFO, fontStack, loadFont, ratio, resolveTheme } from '../../../lib/theme'
import { useFaviconMutations, useLogoMutations } from '../../../queries/admin'
import { BrandMark } from '../../../shell/common'
import { Section, SelectField } from '../../../ui/controls'
import { ConfirmButton, ErrorNote } from '../../../ui/feedback'
import { IconWarning } from '../../../ui/icons'
import { Choice, ColorField } from './fields'

type SetTheme = (fn: (t: BrandingTheme) => BrandingTheme) => void

export function ThemeEditor({ theme, onChange, settings }: { theme: BrandingTheme; onChange: SetTheme; settings: Settings }) {
  const { t } = useTranslation()
  const colors = (theme.colors ?? {}) as Partial<Record<ColorKey, string | null>>
  const setColor = (k: ColorKey, v: string | null) => onChange((x) => ({ ...x, colors: { ...(x.colors ?? {}), [k]: v } }))
  const set = <K extends keyof BrandingTheme>(k: K, v: BrandingTheme[K]) => onChange((x) => ({ ...x, [k]: v }))
  const legacyAccent = settings.branding?.accent_color
  const issues = contrastIssues({ ...colors, primary: colors.primary ?? legacyAccent })
  const resolved = resolveTheme(theme, legacyAccent)
  // Show every font in its own face in the pickers.
  useEffect(() => void FONTS.forEach((f) => loadFont(f)), [])

  return (
    <div className="space-y-6">
      <BrandAssets settings={settings} />

      <Section title={t('appearance.colors.title')} description={t('appearance.colors.hint')}>
        <Choice
          label={t('appearance.scheme.label')}
          value={theme.color_scheme ?? 'light'}
          onChange={(v) => set('color_scheme', v)}
          options={(['light', 'dark', 'auto'] as const).map((v) => ({ value: v, label: t(`appearance.scheme.${v}`) }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          {COLOR_KEYS.map((k) => (
            <ColorField key={k} label={t(`appearance.colors.${k}`)} hint={t(`appearance.colors.${k}Hint`)} value={colors[k] ?? (k === 'primary' ? legacyAccent : null)} placeholder={DEFAULT_COLORS[k]} onChange={(v) => setColor(k, v)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 p-3" aria-label={t('appearance.colors.sample')} role="group">
          <span className="rounded-control px-3 py-2 text-sm font-medium" style={{ background: resolved.colors.primary, color: resolved.vars['--accent-contrast'] }}>
            {t('appearance.colors.button')}
          </span>
          <span className="text-xs text-stone-600">{t('appearance.colors.buttonText', { ratio: ratio(resolved.colors.primary, resolved.vars['--accent-contrast']).toFixed(1) })}</span>
        </div>
        {issues.length > 0 && (
          <div role="alert" className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {issues.map((i) => (
              <p key={i.pair} className="flex gap-2">
                <IconWarning size={16} className="mt-0.5" />
                <span>{t(`appearance.contrast.${i.pair}`, { ratio: i.ratio.toFixed(1) })}</span>
              </p>
            ))}
            <p className="pl-6 text-xs">{t('appearance.contrast.autoFix')}</p>
          </div>
        )}
      </Section>

      <Section title={t('appearance.fonts.title')} description={t('appearance.fonts.hint')}>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['heading_font', 'body_font'] as const).map((k) => (
            <div key={k} className="space-y-2">
              <SelectField label={t(`appearance.fonts.${k}`)} value={theme[k] ?? 'system'} onChange={(e) => set(k, e.target.value as PortalFont)}>
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f === 'system' ? t('appearance.fonts.system') : FONT_INFO[f].family}
                  </option>
                ))}
              </SelectField>
              <p className="truncate text-2xl text-stone-800" style={{ fontFamily: fontStack(theme[k] ?? 'system') }} aria-hidden="true">
                {k === 'heading_font' ? t('appearance.fonts.headingSample') : t('appearance.fonts.bodySample')}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('appearance.layout.title')}>
        <Choice
          label={t('appearance.radius.label')}
          columns={4}
          value={theme.radius ?? 'medium'}
          onChange={(v) => set('radius', v)}
          options={(['none', 'small', 'medium', 'large'] as const).map((v) => ({
            value: v,
            label: t(`appearance.radius.${v}`),
            sample: <span className="block h-6 w-10 border-2 border-stone-500" style={{ borderRadius: { none: 0, small: 4, medium: 8, large: 14 }[v] }} aria-hidden="true" />,
          }))}
        />
        <Choice
          label={t('appearance.density.label')}
          value={theme.grid_density ?? 'comfortable'}
          onChange={(v) => set('grid_density', v)}
          options={(['compact', 'comfortable', 'editorial'] as const).map((v) => ({
            value: v,
            label: t(`appearance.density.${v}`),
            sample: (
              <span className="grid w-12 gap-0.5" style={{ gridTemplateColumns: `repeat(${{ compact: 4, comfortable: 3, editorial: 2 }[v]}, 1fr)` }} aria-hidden="true">
                {Array.from({ length: { compact: 8, comfortable: 6, editorial: 4 }[v] }, (_, i) => (
                  <span key={i} className="aspect-[4/5] bg-stone-400" />
                ))}
              </span>
            ),
          }))}
        />
        <Choice
          label={t('appearance.card.label')}
          value={theme.card_style ?? 'plain'}
          onChange={(v) => set('card_style', v)}
          options={(['plain', 'bordered', 'elevated'] as const).map((v) => ({
            value: v,
            label: t(`appearance.card.${v}`),
            sample: <span className={v === 'bordered' ? 'block h-7 w-9 rounded border border-stone-500 bg-white' : v === 'elevated' ? 'block h-7 w-9 rounded bg-white shadow-md' : 'block h-7 w-9 rounded bg-stone-300'} aria-hidden="true" />,
          }))}
        />
        <Choice
          label={t('appearance.imageFit.label')}
          columns={2}
          value={theme.image_fit ?? 'contain'}
          onChange={(v) => set('image_fit', v)}
          options={(['contain', 'cover'] as const).map((v) => ({ value: v, label: t(`appearance.imageFit.${v}`) }))}
        />
        <ColorField label={t('appearance.imageBackground')} hint={t('appearance.imageBackgroundHint')} value={theme.image_background} placeholder={resolved.vars['--img-bg']} onChange={(v) => set('image_background', v)} />
      </Section>
    </div>
  )
}

/** Logo and favicon: uploaded and saved at once (they are files, not settings). */
function BrandAssets({ settings }: { settings: Settings }) {
  const { t } = useTranslation()
  const logo = useLogoMutations()
  const favicon = useFaviconMutations()
  const b = settings.branding ?? {}
  const [problem, setProblem] = useState<string | null>(null)
  const pick = (accept: string, max: number, onFile: (f: File) => void, square?: boolean) => (
    <input
      type="file"
      accept={accept}
      className="sr-only"
      onChange={async (e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        if (f.size > max) return setProblem(t('errors.payload_too_large'))
        if (square) {
          const bmp = await createImageBitmap(f).catch(() => null)
          if (bmp && bmp.width !== bmp.height) return setProblem(t('appearance.favicon.square'))
        }
        setProblem(null)
        onFile(f)
      }}
    />
  )
  const uploadCls = 'inline-flex h-10 cursor-pointer items-center rounded-control border border-stone-300 bg-white px-4 text-sm font-medium shadow-xs hover:bg-stone-50 focus-within:outline-2 focus-within:outline-accent'
  return (
    <Section title={t('appearance.brand.title')} description={t('appearance.brand.hint')}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-800">{t('appearance.brand.logo')}</p>
          <div className="flex h-16 items-center rounded-lg border border-stone-200 bg-stone-50 px-3">
            <BrandMark name={b.display_name ?? ''} logo={b.logo_url} size="lg" />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={uploadCls}>
              {logo.upload.isPending ? t('product.upload.working') : b.logo_url ? t('settings.replaceLogo') : t('settings.uploadLogo')}
              {pick('image/png,image/jpeg,image/webp', 5 * 1024 * 1024, (f) => logo.upload.mutate(f))}
            </label>
            {b.logo_url && <ConfirmButton variant="secondary" label={t('settings.removeLogo')} title={t('settings.removeLogoTitle')} body={t('settings.removeLogoBody')} confirmLabel={t('settings.removeLogo')} onConfirm={() => logo.remove.mutateAsync()} />}
          </div>
          <p className="text-xs text-stone-500">{t('settings.logoHint')}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-800">{t('appearance.favicon.label')}</p>
          <div className="flex h-16 items-center gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3">
            {b.favicon_url ? <img src={b.favicon_url} alt="" className="size-8 rounded" /> : <span className="grid size-8 place-items-center rounded bg-accent text-xs font-semibold text-accent-contrast">{(b.display_name ?? '·').charAt(0)}</span>}
            <span className="truncate text-xs text-stone-600">{b.display_name}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className={uploadCls}>
              {favicon.upload.isPending ? t('product.upload.working') : b.favicon_url ? t('appearance.favicon.replace') : t('appearance.favicon.upload')}
              {pick('image/png,image/webp', MAX_FAVICON_BYTES, (f) => favicon.upload.mutate(f), true)}
            </label>
            {b.favicon_url && (
              <ConfirmButton variant="secondary" label={t('appearance.favicon.remove')} title={t('appearance.favicon.removeTitle')} body={t('appearance.favicon.removeBody')} confirmLabel={t('appearance.favicon.remove')} onConfirm={() => favicon.remove.mutateAsync()} />
            )}
          </div>
          <p className="text-xs text-stone-500">{t('appearance.favicon.hint')}</p>
        </div>
      </div>
      {problem && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {problem}
        </p>
      )}
      <ErrorNote error={logo.upload.error ?? favicon.upload.error} />
    </Section>
  )
}
