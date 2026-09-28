import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { AdminAsset, AssetData, Channel, Role, View } from '../../../api/types'
import { cleanLocalized } from '../../../lib/localized'
import { humanize } from '../../../lib/prefs'
import { uploadAssetFiles } from '../../../lib/upload'
import { CHANNELS, ROLES, VIEWS } from '../../../lib/vocab'
import type { useProductMutations } from '../../../queries/admin'
import { Button, Checkbox, SelectField, TextArea, TextField } from '../../../ui/controls'
import { Dialog, ErrorNote } from '../../../ui/feedback'
import { IconUpload } from '../../../ui/icons'
import { LocalizedInput } from './LocalizedInput'

type M = ReturnType<typeof useProductMutations>

const toLocalInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 16) : '')
const fromLocalInput = (v: string) => (v ? new Date(v + (v.length === 16 ? ':00Z' : '')).toISOString().replace('.000Z', 'Z') : null)

/** Everything about one image: kind, alt text, rights, AI provenance, publication, replace file. */
export function AssetDialog({ asset, serverRenders, mutations, onClose }: { asset: AdminAsset; serverRenders: boolean; mutations: M; onClose: () => void }) {
  const { t } = useTranslation()
  const d = asset.record.data as unknown as AssetData
  const r = d.rights ?? {}
  const p = d.provenance ?? {}
  const [role, setRole] = useState<Role>(d.role ?? 'packshot')
  const [view, setView] = useState<string>(d.view ?? '')
  const [alt, setAlt] = useState<Record<string, string>>({ ...(d.alt_text ?? {}) })
  const [published, setPublished] = useState(asset.record.status === 'published')
  const [channels, setChannels] = useState<Channel[]>(r.channels ?? ['webshop', 'marketplace', 'social'])
  const [territories, setTerritories] = useState((r.territories ?? []).join(', '))
  const [embargo, setEmbargo] = useState(toLocalInput(r.embargo_until))
  const [expires, setExpires] = useState(toLocalInput(r.expires_at))
  const [credit, setCredit] = useState(r.credit ?? '')
  const [customLicence, setCustomLicence] = useState(r.license === 'custom')
  const [licenceText, setLicenceText] = useState(r.license_text ?? '')
  const [aiGenerated, setAiGenerated] = useState(!!p.ai_generated)
  const [aiEdited, setAiEdited] = useState(!!p.ai_edited)
  const [generator, setGenerator] = useState(p.generator ?? '')
  const [c2pa, setC2pa] = useState(p.c2pa ?? 'none')

  const territoryList = territories.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean)
  const badTerritory = territoryList.find((x) => !/^[A-Z]{2}$/.test(x))

  const replace = useMutation({
    mutationFn: async (file: File) => {
      const files = await uploadAssetFiles(file, serverRenders)
      return mutations.patchAsset.mutateAsync({ id: asset.record.external_id, patch: { files, filename: file.name } as never })
    },
  })

  const save = () => {
    if (badTerritory) return
    mutations.patchAsset.mutate(
      {
        id: asset.record.external_id,
        patch: {
          role,
          view: (view || null) as View | null,
          alt_text: cleanLocalized(alt),
          status: published ? 'published' : 'unpublished',
          rights: {
            license: customLicence ? 'custom' : 'retailer-use',
            license_text: customLicence ? licenceText.trim() || null : null,
            channels,
            territories: territoryList.length ? territoryList : null,
            embargo_until: fromLocalInput(embargo),
            expires_at: fromLocalInput(expires),
            credit: credit.trim() || null,
          },
          provenance: {
            ai_generated: aiGenerated,
            ai_edited: aiEdited,
            source: aiGenerated ? 'generated' : aiEdited ? 'composite' : 'photo',
            c2pa,
            generator: generator.trim() || null,
          },
        },
      },
      { onSuccess: onClose },
    )
  }

  const preview = asset.renditions?.web?.url ?? asset.renditions?.thumb?.url
  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={t('product.imageTitle', { n: d.position })}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={mutations.patchAsset.isPending} onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
        <div className="space-y-2">
          <div className="aspect-[4/5] overflow-hidden rounded-lg border border-stone-200 bg-stone-100">{preview && <img src={preview} alt="" className="size-full object-contain" />}</div>
          <p className="break-all font-mono text-[11px] text-stone-500">{d.filename ?? asset.record.external_id}</p>
          <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-control border border-stone-300 bg-white px-2.5 text-sm font-medium focus-within:outline-2 focus-within:outline-accent">
            <IconUpload size={16} />
            {replace.isPending ? t('product.upload.working') : t('product.replaceFile')}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && replace.mutate(e.target.files[0])} />
          </label>
          {replace.isSuccess && <p className="text-xs text-emerald-700">{t('product.replaced')}</p>}
          <ErrorNote error={replace.error} />
        </div>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={t('product.role')} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map((x) => (
                <option key={x} value={x}>
                  {t(`enum.role.${x}`, { defaultValue: humanize(x) })}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('product.view')} value={view} onChange={(e) => setView(e.target.value)}>
              <option value="">—</option>
              {VIEWS.map((x) => (
                <option key={x} value={x}>
                  {t(`enum.view.${x}`, { defaultValue: humanize(x) })}
                </option>
              ))}
            </SelectField>
          </div>
          <Checkbox label={t('product.imagePublished')} hint={t('product.imagePublishedHint')} checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <LocalizedInput label={t('product.altText')} value={alt} onChange={setAlt} />

          <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3">
            <legend className="px-1 text-sm font-semibold">{t('product.rights')}</legend>
            <div className="flex flex-wrap gap-4">
              {CHANNELS.map((c) => (
                <Checkbox key={c} label={t(`enum.channel.${c}`)} checked={channels.includes(c)} onChange={(e) => setChannels(e.target.checked ? [...channels, c] : channels.filter((x) => x !== c))} />
              ))}
            </div>
            <TextField label={t('product.territories')} hint={t('product.territoriesHint')} value={territories} onChange={(e) => setTerritories(e.target.value)} error={badTerritory ? t('product.territoryInvalid', { code: badTerritory }) : null} placeholder="NL, BE, DE" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t('product.embargo')} hint={t('product.embargoHint')} type="datetime-local" value={embargo} onChange={(e) => setEmbargo(e.target.value)} />
              <TextField label={t('product.expires')} hint={t('product.expiresHint')} type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
            <TextField label={t('portal.product.credit')} value={credit} onChange={(e) => setCredit(e.target.value)} />
            <Checkbox label={t('product.customLicence')} checked={customLicence} onChange={(e) => setCustomLicence(e.target.checked)} />
            {customLicence && <TextArea label={t('portal.product.licence')} value={licenceText} onChange={(e) => setLicenceText(e.target.value)} />}
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-stone-200 p-3">
            <legend className="px-1 text-sm font-semibold">{t('product.provenance')}</legend>
            <p className="text-xs text-stone-500">{t('product.provenanceHint')}</p>
            <Checkbox label={t('portal.product.aiGenerated')} checked={aiGenerated} onChange={(e) => setAiGenerated(e.target.checked)} />
            <Checkbox label={t('portal.product.aiEdited')} checked={aiEdited} onChange={(e) => setAiEdited(e.target.checked)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t('product.generator')} value={generator} onChange={(e) => setGenerator(e.target.value)} />
              <SelectField label={t('product.c2pa')} value={c2pa} onChange={(e) => setC2pa(e.target.value as typeof c2pa)}>
                <option value="none">{t('product.c2paNone')}</option>
                <option value="embedded">{t('product.c2paEmbedded')}</option>
                <option value="sidecar">{t('product.c2paSidecar')}</option>
              </SelectField>
            </div>
          </fieldset>
          <ErrorNote error={mutations.patchAsset.error} />
        </div>
      </div>
    </Dialog>
  )
}
