import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Channel, Settings } from '../../../api/types'
import { CHANNELS } from '../../../lib/vocab'
import { useUpdateSettings } from '../../../queries/admin'
import { Button, Checkbox, Saved, Section, Segmented, TextArea, TextField } from '../../../ui/controls'
import { ErrorNote } from '../../../ui/feedback'

/** What new images get when the brand's data says nothing: usage rights and publication. */
export function DefaultsTab({ settings }: { settings: Settings }) {
  const { t } = useTranslation()
  const update = useUpdateSettings()
  const r = settings.defaults?.rights
  const [channels, setChannels] = useState<Channel[]>(r?.channels ?? ['webshop', 'marketplace', 'social'])
  const [territories, setTerritories] = useState((r?.territories ?? []).join(', '))
  const [credit, setCredit] = useState(r?.credit ?? '')
  const [custom, setCustom] = useState(r?.license === 'custom')
  const [licence, setLicence] = useState(r?.license_text ?? '')
  const [status, setStatus] = useState<'published' | 'unpublished'>(settings.defaults?.ingest_status ?? 'published')
  const list = territories.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean)
  const bad = list.find((x) => !/^[A-Z]{2}$/.test(x))
  return (
    <>
      <Section title={t('settings.defaultRights')} description={t('settings.defaultRightsHint')}>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('settings.channels')}</legend>
          <div className="flex flex-wrap gap-4">
            {CHANNELS.map((c) => (
              <Checkbox key={c} label={t(`enum.channel.${c}`)} checked={channels.includes(c)} onChange={(e) => setChannels(e.target.checked ? [...channels, c] : channels.filter((x) => x !== c))} />
            ))}
          </div>
        </fieldset>
        <TextField label={t('product.territories')} hint={t('product.territoriesHint')} value={territories} onChange={(e) => setTerritories(e.target.value)} error={bad ? t('product.territoryInvalid', { code: bad }) : null} />
        <TextField label={t('portal.product.credit')} value={credit} onChange={(e) => setCredit(e.target.value)} />
        <Checkbox label={t('product.customLicence')} hint={t('settings.standardLicenceHint')} checked={custom} onChange={(e) => setCustom(e.target.checked)} />
        {custom && <TextArea label={t('portal.product.licence')} value={licence} onChange={(e) => setLicence(e.target.value)} />}
      </Section>
      <Section title={t('settings.newContent')} description={t('settings.newContentHint')}>
        <Segmented
          label={t('settings.newContent')}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'published', label: t('settings.publishAtOnce') },
            { value: 'unpublished', label: t('settings.reviewFirst') },
          ]}
        />
      </Section>
      <ErrorNote error={update.error} />
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          loading={update.isPending}
          onClick={() => {
            if (bad) return
            update.mutate({
              defaults: {
                rights: { license: custom ? 'custom' : 'retailer-use', license_text: custom ? licence.trim() || null : null, channels, territories: list.length ? list : null, credit: credit.trim() || null },
                ingest_status: status,
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
