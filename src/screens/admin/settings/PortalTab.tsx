import { useState } from 'react'
import { languageName } from '../../../lib/format'
import { canonicalLanguageTag } from '../../../lib/validate'
import { useTranslation } from 'react-i18next'
import type { Settings } from '../../../api/types'
import { LANGUAGES } from '../../../i18n/languages'
import { useUpdateSettings } from '../../../queries/admin'
import { Button, Checkbox, Saved, Section, SelectField, Switch, TextField } from '../../../ui/controls'
import { ErrorNote } from '../../../ui/feedback'

export function PortalTab({ settings }: { settings: Settings }) {
  const { t, i18n } = useTranslation()
  const update = useUpdateSettings()
  // Content languages beyond the UI's 25: any language tag with script and region (de-CH, zh-Hant, es-419).
  const [other, setOther] = useState('')
  const [otherErr, setOtherErr] = useState<string | null>(null)
  const nameOf = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? `${languageName(code, i18n.language)} (${code})`
  const addOther = () => {
    const tag = canonicalLanguageTag(other)
    if (!tag) return setOtherErr(t('settings.languageTagInvalid'))
    setOtherErr(null)
    setOther('')
    if (!langs.includes(tag)) setLangs([...langs, tag])
  }
  const p: Partial<NonNullable<Settings['portal']>> = settings.portal ?? {}
  const [langs, setLangs] = useState<string[]>(p.languages ?? ['en'])
  const [def, setDef] = useState(p.default_language ?? langs[0] ?? 'en')
  const toggle = (key: 'access_requests_enabled' | 'allow_original_download' | 'allow_article_data_export' | 'retailer_api_self_service', v: boolean) => update.mutate({ portal: { [key]: v } })
  return (
    <>
      <Section title={t('settings.portalAccess')} description={t('settings.portalAccessHint')}>
        <div className="divide-y divide-stone-100">
          <Switch checked={p.access_requests_enabled ?? true} onChange={(v) => toggle('access_requests_enabled', v)} label={t('settings.accessRequests')} hint={t('settings.accessRequestsHint')} />
          <Switch checked={p.allow_original_download ?? true} onChange={(v) => toggle('allow_original_download', v)} label={t('settings.originals')} hint={t('settings.originalsHint')} />
          <Switch checked={p.allow_article_data_export ?? true} onChange={(v) => toggle('allow_article_data_export', v)} label={t('settings.dataExport')} hint={t('settings.dataExportHint')} />
          <Switch checked={p.retailer_api_self_service ?? false} onChange={(v) => toggle('retailer_api_self_service', v)} label={t('settings.selfService')} hint={t('settings.selfServiceHint')} />
        </div>
        <Saved show={update.isSuccess} />
        <ErrorNote error={update.error} />
      </Section>
      <Section title={t('settings.languages')} description={t('settings.languagesHint')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {LANGUAGES.map((l) => (
            <Checkbox key={l.code} label={l.name} checked={langs.includes(l.code)} disabled={l.code === def} onChange={(e) => setLangs(e.target.checked ? [...langs, l.code] : langs.filter((x) => x !== l.code))} />
          ))}
          {langs
            .filter((code) => !LANGUAGES.some((l) => l.code === code))
            .map((code) => (
              <Checkbox key={code} label={nameOf(code)} checked disabled={code === def} onChange={() => setLangs(langs.filter((x) => x !== code))} />
            ))}
        </div>
        <form
          className="max-w-md space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            addOther()
          }}
        >
          <TextField label={t('settings.otherLanguage')} hint={t('settings.otherLanguageHint')} value={other} onChange={(e) => setOther(e.target.value)} error={otherErr} placeholder="de-CH, zh-Hant, es-419" />
          <Button type="submit" size="sm">
            {t('settings.addLanguage')}
          </Button>
        </form>
        <SelectField label={t('setup.defaultLanguage')} hint={t('setup.defaultLanguageHint')} value={def} onChange={(e) => setDef(e.target.value)} className="max-w-sm">
          {langs.map((code) => (
            <option key={code} value={code}>
              {nameOf(code)}
            </option>
          ))}
        </SelectField>
        <div className="flex items-center gap-3">
          <Button variant="primary" loading={update.isPending} onClick={() => update.mutate({ portal: { languages: [def, ...langs.filter((l) => l !== def)], default_language: def } })}>
            {t('common.save')}
          </Button>
        </div>
      </Section>
    </>
  )
}
