import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Settings } from '../../../api/types'
import { applyAccent } from '../../../lib/accent'
import { COUNTRIES } from '../../../lib/countries'
import { countryName } from '../../../lib/format'
import { localizedPatch } from '../../../lib/localized'
import { emailProblem, hexProblem, urlProblem } from '../../../lib/validate'
import { useLogoMutations, useUpdateSettings } from '../../../queries/admin'
import { Button, Field, Saved, Section, SelectField, TextField } from '../../../ui/controls'
import { ConfirmButton, ErrorNote } from '../../../ui/feedback'
import { BrandMark } from '../../../shell/common'
import { LocalizedInput } from '../product/LocalizedInput'

export function BrandTab({ settings }: { settings: Settings }) {
  const { t, i18n } = useTranslation()
  const update = useUpdateSettings()
  const logo = useLogoMutations()
  const b = settings.branding ?? {}
  const c = settings.company ?? {}
  const [company, setCompany] = useState({ name: c.name ?? '', website: c.website ?? '', contact_email: c.contact_email ?? '', country: c.country ?? '' })
  const [displayName, setDisplayName] = useState(b.display_name ?? '')
  const [portalName, setPortalName] = useState<Record<string, string>>({ ...(b.portal_name ?? {}) })
  const [accent, setAccent] = useState(b.accent_color ?? '#334155')
  const [welcome, setWelcome] = useState<Record<string, string>>({ ...(b.welcome_text ?? {}) })
  const [touched, setTouched] = useState(false)
  const [logoTooBig, setLogoTooBig] = useState(false)
  const errs = {
    name: touched && !company.name.trim() ? t('validate.required') : null,
    website: touched && company.website.trim() && urlProblem(company.website) ? t('validate.url') : null,
    email: touched && company.contact_email.trim() && emailProblem(company.contact_email) ? t('validate.email') : null,
    accent: hexProblem(accent) ? t('validate.hex') : null,
  }
  const maxLogo = 5 * 1024 * 1024

  return (
    <>
      <Section title={t('settings.look')} description={t('settings.lookHint')}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <BrandMark name={displayName || company.name} logo={b.logo_url} size="lg" />
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-control border border-stone-300 bg-white px-4 text-sm font-medium shadow-xs focus-within:outline-2 focus-within:outline-accent">
              {logo.upload.isPending ? t('product.upload.working') : b.logo_url ? t('settings.replaceLogo') : t('settings.uploadLogo')}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  setLogoTooBig(!!f && f.size > maxLogo)
                  if (f && f.size <= maxLogo) logo.upload.mutate(f)
                }}
              />
            </label>
            {b.logo_url && (
              <ConfirmButton variant="secondary" label={t('settings.removeLogo')} title={t('settings.removeLogoTitle')} body={t('settings.removeLogoBody')} confirmLabel={t('settings.removeLogo')} onConfirm={() => logo.remove.mutateAsync()} />
            )}
          </div>
          <p className="w-full text-xs text-stone-500">{t('settings.logoHint')}</p>
          {logoTooBig && (
            <p role="alert" className="w-full text-xs font-medium text-red-700">
              {t('errors.payload_too_large')}
            </p>
          )}
          <ErrorNote error={logo.upload.error} />
        </div>
        <Field label={t('setup.accent')} hint={t('setup.accentHint')} error={errs.accent}>
          {(p) => (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="color"
                value={hexProblem(accent) ? '#334155' : accent}
                onChange={(e) => {
                  setAccent(e.target.value)
                  applyAccent(e.target.value)
                }}
                className="h-10 w-14 cursor-pointer rounded-control border border-stone-300 bg-white p-1"
                aria-label={t('setup.accent')}
              />
              <input {...p} className="input w-32 font-mono" value={accent} onChange={(e) => setAccent(e.target.value)} />
              <span className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-accent-contrast">{t('setup.accentPreview')}</span>
            </div>
          )}
        </Field>
        <TextField label={t('settings.displayName')} hint={t('settings.displayNameHint')} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <div className="space-y-1">
          <LocalizedInput label={t('settings.portalName')} value={portalName} onChange={setPortalName} />
          <p className="text-xs text-stone-500">{t('settings.portalNameHint', { example: t('glossary.portal') })}</p>
        </div>
        <LocalizedInput label={t('settings.welcome')} value={welcome} onChange={setWelcome} multiline />
      </Section>

      <Section title={t('settings.company')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('setup.companyName')} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} error={errs.name} />
          <TextField label={t('setup.website')} type="url" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} error={errs.website} />
          <TextField label={t('setup.contactEmail')} hint={t('setup.contactEmailHint')} type="email" value={company.contact_email} onChange={(e) => setCompany({ ...company, contact_email: e.target.value })} error={errs.email} />
          <SelectField label={t('fields.country')} value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })}>
            <option value="">—</option>
            {COUNTRIES.map((x) => ({ x, n: countryName(x, i18n.language) }))
              .sort((a, z) => a.n.localeCompare(z.n, i18n.language))
              .map(({ x, n }) => (
                <option key={x} value={x}>
                  {n}
                </option>
              ))}
          </SelectField>
        </div>
      </Section>

      <ErrorNote error={update.error} />
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          loading={update.isPending}
          onClick={() => {
            setTouched(true)
            if (!company.name.trim() || errs.website || errs.email || errs.accent) return
            update.mutate({
              company: { name: company.name.trim(), website: company.website.trim() || null, contact_email: company.contact_email.trim() || null, country: company.country || null },
              branding: {
                display_name: displayName.trim() || company.name.trim(),
                accent_color: accent,
                welcome_text: localizedPatch(b.welcome_text, welcome),
                portal_name: localizedPatch(b.portal_name, portalName),
              },
            })
          }}
        >
          {t('common.save')}
        </Button>
        <Saved show={update.isSuccess} />
      </div>
    </>
  )
}
