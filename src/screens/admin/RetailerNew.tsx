import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { Retailer, RetailerInput } from '../../api/types'
import { COUNTRIES } from '../../lib/countries'
import { urlProblem, withScheme } from '../../lib/validate'
import { countryName } from '../../lib/format'
import { useRetailerMutations } from '../../queries/admin'
import { Button, PageHeader, Saved, Section, SelectField, TextArea, TextField } from '../../ui/controls'
import { ApiError } from '../../api/client'
import { ErrorNote } from '../../ui/feedback'
import { IconChevronLeft } from '../../ui/icons'

/** Name, customer number, website, VAT, country, notes. Used for "add" and on the detail page. */
export function RetailerFields({ initial, submitLabel, pending, error, saved, onSubmit }: { initial?: Retailer; submitLabel: string; pending: boolean; error: unknown; saved?: boolean; onSubmit: (v: RetailerInput) => void }) {
  const { t, i18n } = useTranslation()
  const [f, setF] = useState({
    name: initial?.name ?? '',
    reference: initial?.reference ?? '',
    website: initial?.website ?? '',
    vat: initial?.vat_number ?? '',
    country: initial?.country ?? '',
    notes: initial?.notes ?? '',
  })
  const [touched, setTouched] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const server = error instanceof ApiError ? error.fieldErrors() : {}
  const websiteErr = touched && f.website.trim() && urlProblem(withScheme(f.website)) ? t('validate.url') : server['/website']
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (!f.name.trim() || (f.website.trim() && urlProblem(withScheme(f.website)))) return
        onSubmit({ name: f.name.trim(), reference: f.reference.trim() || null, website: withScheme(f.website) || null, vat_number: f.vat.trim() || null, country: f.country || null, notes: f.notes.trim() || null })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('fields.shopName')} value={f.name} onChange={set('name')} error={touched && !f.name.trim() ? t('validate.required') : null} />
        <TextField label={t('fields.customerNumber')} hint={t('retailers.referenceHint')} value={f.reference} onChange={set('reference')} />
        <TextField label={t('fields.website')} type="url" value={f.website} onChange={set('website')} onBlur={() => setF({ ...f, website: withScheme(f.website) })} error={websiteErr} placeholder="https://" />
        <TextField label={t('fields.vatNumber')} value={f.vat} onChange={set('vat')} />
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
      </div>
      <TextArea label={t('retailers.notes')} hint={t('retailers.notesHint')} value={f.notes} onChange={set('notes')} />
      <ErrorNote error={error} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={pending}>
          {submitLabel}
        </Button>
        <Saved show={!!saved} />
      </div>
    </form>
  )
}

export function RetailerNewScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const m = useRetailerMutations()
  return (
    <div className="max-w-3xl">
      <PageHeader
        back={
          <Link to="/admin/retailers" className="inline-flex items-center gap-1 text-sm text-stone-600">
            <IconChevronLeft size={16} />
            {t('retailers.title')}
          </Link>
        }
        title={t('retailers.add')}
        description={t('retailers.addIntro')}
      />
      <Section title={t('retailers.details')}>
        <RetailerFields submitLabel={t('retailers.create')} pending={m.create.isPending} error={m.create.error} onSubmit={(v) => m.create.mutate(v, { onSuccess: (r) => void navigate({ to: '/admin/retailers/$id', params: { id: r.id } }) })} />
      </Section>
    </div>
  )
}
