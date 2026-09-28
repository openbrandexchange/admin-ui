import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { protocolApi, req, ApiError } from '../../api/client'
import { countryName } from '../../lib/format'
import { emailProblem, urlProblem } from '../../lib/validate'
import { useBranding } from '../../queries/session'
import { COUNTRIES } from '../../lib/countries'
import { Button, Checkbox, Loading, SelectField, TextArea, TextField } from '../../ui/controls'
import { ErrorNote, Notice } from '../../ui/feedback'
import { PublicCard } from './PublicCard'

/** Public form: a retailer asks the brand for access to the portal and/or an API key. */
export function RequestAccessScreen() {
  const { t, i18n } = useTranslation()
  const branding = useBranding()
  const [f, setF] = useState({ name: '', website: '', country: '', vat: '', reference: '', contact: '', email: '', phone: '', message: '' })
  const [portal, setPortal] = useState(true)
  const [apiKey, setApiKey] = useState(false)
  const [brands, setBrands] = useState<string[]>([])
  const [touched, setTouched] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const send = useMutation({
    mutationFn: () =>
      req(() =>
        protocolApi.POST('/obx/v1/access-requests', {
          body: {
            retailer: {
              name: f.name.trim(),
              website: f.website.trim() || null,
              country: f.country || null,
              vat_number: f.vat.trim() || null,
              reference: f.reference.trim() || null,
            },
            contact: { name: f.contact.trim(), email: f.email.trim(), phone: f.phone.trim() || null, language: i18n.language },
            access: [...(portal ? ['portal' as const] : []), ...(apiKey ? ['api' as const] : [])],
            requested_brand_ids: brands.length ? brands : null,
            message: f.message.trim() || null,
          },
        }),
      ),
  })

  if (branding.isPending) return <Loading />
  const b = branding.data
  if (b && !b.access_requests_enabled)
    return (
      <PublicCard title={t('request.title', { brand: b.name })}>
        <Notice>{t('request.closed')}</Notice>
      </PublicCard>
    )
  if (send.isSuccess)
    return (
      <PublicCard title={t('request.sentTitle')}>
        <Notice tone="ok">{t('request.sent', { brand: b?.name ?? '', email: f.email.trim() })}</Notice>
        <Link to="/login" className="text-sm underline underline-offset-2">
          {t('password.backToLogin')}
        </Link>
      </PublicCard>
    )

  const server = send.error instanceof ApiError ? send.error.fieldErrors() : {}
  const err = {
    name: touched && !f.name.trim() ? t('validate.required') : server['/retailer/name'],
    website: touched && f.website.trim() && urlProblem(f.website) ? t('validate.url') : server['/retailer/website'],
    contact: touched && !f.contact.trim() ? t('validate.required') : server['/contact/name'],
    email: touched && emailProblem(f.email) ? t('validate.email') : server['/contact/email'],
    access: touched && !portal && !apiKey ? t('request.chooseOne') : null,
  }
  const valid = !err.name && !err.website && !err.contact && !err.email && (portal || apiKey)
  const publishedBrands = b?.brands ?? []

  return (
    <PublicCard title={t('request.title', { brand: b?.name ?? '' })} intro={t('request.intro')}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          const ok = f.name.trim() && f.contact.trim() && !emailProblem(f.email) && !(f.website.trim() && urlProblem(f.website)) && (portal || apiKey)
          if (ok) send.mutate()
        }}
      >
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-stone-900">{t('request.shop')}</legend>
          <TextField label={t('fields.shopName')} value={f.name} onChange={set('name')} error={err.name} autoComplete="organization" />
          <TextField label={t('fields.website')} type="url" placeholder="https://" value={f.website} onChange={set('website')} error={err.website} autoComplete="url" />
          <SelectField label={t('fields.country')} value={f.country} onChange={set('country')}>
            <option value="">—</option>
            {COUNTRIES.map((c) => ({ c, n: countryName(c, i18n.language) }))
              .sort((a, b) => a.n.localeCompare(b.n, i18n.language))
              .map(({ c, n }) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
          </SelectField>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t('fields.vatNumber')} value={f.vat} onChange={set('vat')} />
            <TextField label={t('fields.customerNumber')} hint={t('request.customerNumberHint')} value={f.reference} onChange={set('reference')} />
          </div>
        </fieldset>
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-stone-900">{t('request.contact')}</legend>
          <TextField label={t('fields.yourName')} value={f.contact} onChange={set('contact')} error={err.contact} autoComplete="name" />
          <TextField label={t('fields.email')} type="email" value={f.email} onChange={set('email')} error={err.email} autoComplete="email" />
          <TextField label={t('fields.phone')} type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" />
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-stone-900">{t('request.what')}</legend>
          <Checkbox label={t('request.portal')} hint={t('request.portalHint')} checked={portal} onChange={(e) => setPortal(e.target.checked)} />
          <Checkbox label={t('glossary.apiKey')} hint={t('request.apiHint')} checked={apiKey} onChange={(e) => setApiKey(e.target.checked)} />
          {err.access && <p className="text-xs font-medium text-red-700">{err.access}</p>}
        </fieldset>
        {publishedBrands.length > 1 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-stone-900">{t('request.brands')}</legend>
            <p className="text-xs text-stone-500">{t('request.brandsHint')}</p>
            {publishedBrands.map((br) => (
              <Checkbox key={br.id} label={br.name} checked={brands.includes(br.id)} onChange={(e) => setBrands(e.target.checked ? [...brands, br.id] : brands.filter((x) => x !== br.id))} />
            ))}
          </fieldset>
        )}
        <TextArea label={t('request.message')} value={f.message} onChange={set('message')} maxLength={2000} />
        <ErrorNote error={send.error} />
        <Button type="submit" variant="primary" className="w-full" loading={send.isPending} aria-disabled={touched && !valid}>
          {t('request.submit')}
        </Button>
      </form>
    </PublicCard>
  )
}
