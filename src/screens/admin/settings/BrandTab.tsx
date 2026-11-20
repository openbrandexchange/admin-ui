import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { Settings } from '../../../api/types'
import { COUNTRIES } from '../../../lib/countries'
import { countryName } from '../../../lib/format'
import { localizedPatch } from '../../../lib/localized'
import { emailProblem, urlProblem, withScheme } from '../../../lib/validate'
import { useUpdateSettings } from '../../../queries/admin'
import { Button, Saved, Section, SelectField, TextField, buttonClass } from '../../../ui/controls'
import { ErrorNote } from '../../../ui/feedback'
import { IconBrush } from '../../../ui/icons'
import { BrandMark } from '../../../shell/common'
import { LocalizedInput } from '../product/LocalizedInput'

export function BrandTab({ settings }: { settings: Settings }) {
  const { t, i18n } = useTranslation()
  const update = useUpdateSettings()
  const b = settings.branding ?? {}
  const c = settings.company ?? {}
  const [company, setCompany] = useState({ name: c.name ?? '', website: c.website ?? '', contact_email: c.contact_email ?? '', country: c.country ?? '' })
  const [displayName, setDisplayName] = useState(b.display_name ?? '')
  const [portalName, setPortalName] = useState<Record<string, string>>({ ...(b.portal_name ?? {}) })
  const [welcome, setWelcome] = useState<Record<string, string>>({ ...(b.welcome_text ?? {}) })
  const [touched, setTouched] = useState(false)
  const errs = {
    name: touched && !company.name.trim() ? t('validate.required') : null,
    website: touched && company.website.trim() && urlProblem(withScheme(company.website)) ? t('validate.url') : null,
    email: touched && company.contact_email.trim() && emailProblem(company.contact_email) ? t('validate.email') : null,
  }

  return (
    <>
      <Section title={t('settings.look')} description={t('settings.lookHint')}>
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <BrandMark name={displayName || company.name} logo={b.logo_url} size="lg" />
          <Link to="/admin/appearance" className={buttonClass('secondary')}>
            <IconBrush size={16} />
            {t('admin.nav.appearance')}
          </Link>
        </div>
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
          <TextField label={t('setup.website')} type="url" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} onBlur={() => setCompany({ ...company, website: withScheme(company.website) })} error={errs.website} />
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
            if (!company.name.trim() || errs.website || errs.email) return
            update.mutate({
              company: { name: company.name.trim(), website: withScheme(company.website) || null, contact_email: company.contact_email.trim() || null, country: company.country || null },
              branding: {
                display_name: displayName.trim() || company.name.trim(),
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
