// Form controls of the Appearance editor.
import { useId, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { MAX_IMAGE_BYTES, MAX_TEXT, type PortalText } from '../../../api/appearance'
import { brandingImageUrl } from '../../../lib/branding'
import { languageName } from '../../../lib/format'
import { catalogLink, isPortalLink, queryFilter } from '../../../lib/links'
import { brandingImagesQuery, useBrandingImageMutations } from '../../../queries/admin'
import { Button, cx, Field } from '../../../ui/controls'
import { Dialog, ErrorNote } from '../../../ui/feedback'
import { IconCheck, IconImage, IconUpload, IconX } from '../../../ui/icons'
import { useFacetLabel } from '../../portal/Filters'
import { facetsQuery } from '../../../queries/portal'

const HEX = /^#[0-9a-fA-F]{6}$/

/** A colour: the native picker and the hex code side by side; empty = the default colour. */
export function ColorField({ label, value, placeholder, onChange, hint }: { label: string; value: string | null | undefined; placeholder: string; onChange: (v: string | null) => void; hint?: ReactNode }) {
  const { t } = useTranslation()
  const [text, setText] = useState(value ?? '')
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setText(value ?? '')
  }
  const bad = text.trim() !== '' && !HEX.test(text.trim())
  return (
    <Field label={label} hint={hint} error={bad ? t('validate.hex') : null}>
      {(p) => (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={HEX.test(value ?? '') ? value! : placeholder}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-stone-300 bg-white p-1"
            aria-label={t('appearance.colors.pick', { name: label })}
          />
          <input
            {...p}
            className="input w-28 font-mono"
            value={text}
            placeholder={placeholder}
            spellCheck={false}
            onChange={(e) => {
              setText(e.target.value)
              const v = e.target.value.trim()
              if (!v) onChange(null)
              else if (HEX.test(v)) onChange(v.toLowerCase())
            }}
          />
          {value && (
            <button type="button" className="grid size-9 place-items-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-stone-800" onClick={() => onChange(null)} aria-label={t('appearance.colors.reset', { name: label })}>
              <IconX size={16} />
            </button>
          )}
        </div>
      )}
    </Field>
  )
}

/** Exclusive options as cards (radio group); each may show a small sample. */
export function Choice<T extends string | number>({ label, value, options, onChange, columns = 3 }: { label: string; value: T; options: { value: T; label: string; sample?: ReactNode }[]; onChange: (v: T) => void; columns?: 2 | 3 | 4 }) {
  const id = useId()
  return (
    <fieldset>
      <legend id={id} className="mb-2 text-sm font-medium text-stone-800">
        {label}
      </legend>
      <div className={cx('grid gap-2', columns === 2 ? 'grid-cols-2' : columns === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
        {options.map((o) => (
          <label
            key={String(o.value)}
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border bg-white px-2 py-2.5 text-center text-xs font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
              value === o.value ? 'border-accent text-stone-900 ring-1 ring-accent' : 'border-stone-300 text-stone-700 hover:border-stone-400',
            )}
          >
            <input type="radio" className="sr-only" name={id} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.sample}
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** The language the brand is writing texts in; texts show one language at a time. */
export function LangTabs({ langs, value, onChange, filled }: { langs: string[]; value: string; onChange: (l: string) => void; filled?: (l: string) => boolean }) {
  const { t, i18n } = useTranslation()
  if (langs.length < 2) return null
  return (
    <div role="radiogroup" aria-label={t('appearance.textLanguage')} className="flex flex-wrap gap-1">
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={l === value}
          onClick={() => onChange(l)}
          className={cx('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium', l === value ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700 hover:border-stone-500')}
        >
          {languageName(l, i18n.language)}
          {filled && !filled(l) && <span className="size-1.5 rounded-full bg-amber-500" aria-label={t('appearance.missingLanguage')} role="img" />}
        </button>
      ))}
    </div>
  )
}

/** One language of a portal text. */
export function TextInput({ label, value, lang, onChange, multiline, max = MAX_TEXT, hint }: { label: string; value: PortalText | undefined; lang: string; onChange: (v: PortalText) => void; multiline?: boolean; max?: number; hint?: ReactNode }) {
  const { i18n } = useTranslation()
  const text = value?.[lang] ?? ''
  const set = (v: string) => {
    const next = { ...(value ?? {}) }
    if (v) next[lang] = v
    else delete next[lang]
    onChange(Object.keys(next).length ? next : null)
  }
  return (
    <Field
      label={
        <>
          {label} <span className="font-normal text-stone-500">· {languageName(lang, i18n.language)}</span>
        </>
      }
      hint={hint}
    >
      {(p) =>
        multiline ? (
          <textarea {...p} lang={lang} maxLength={max} rows={4} className="input" value={text} onChange={(e) => set(e.target.value)} />
        ) : (
          <input {...p} lang={lang} maxLength={max} className="input" value={text} onChange={(e) => set(e.target.value)} />
        )
      }
    </Field>
  )
}

/** Upload one or more images to the library; returns the new images. */
export function UploadButton({ onUploaded, label, multiple }: { onUploaded?: (ids: string[]) => void; label?: string; multiple?: boolean }) {
  const { t } = useTranslation()
  const { upload } = useBrandingImageMutations()
  const [tooBig, setTooBig] = useState<string | null>(null)
  return (
    <div className="space-y-2">
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-control border border-stone-300 bg-white px-4 text-sm font-medium shadow-xs hover:bg-stone-50 focus-within:outline-2 focus-within:outline-accent">
        <IconUpload size={16} />
        {upload.isPending ? t('product.upload.working') : (label ?? t('appearance.images.upload'))}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple={multiple}
          className="sr-only"
          onChange={async (e) => {
            const files = [...(e.target.files ?? [])]
            e.target.value = ''
            const big = files.find((f) => f.size > MAX_IMAGE_BYTES)
            setTooBig(big ? big.name : null)
            const ids: string[] = []
            for (const f of files.filter((x) => x.size <= MAX_IMAGE_BYTES)) {
              try {
                ids.push((await upload.mutateAsync(f)).id)
              } catch {
                /* shown below */
              }
            }
            if (ids.length) onUploaded?.(ids)
          }}
        />
      </label>
      {tooBig && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {t('appearance.images.tooBig', { name: tooBig })}
        </p>
      )}
      <ErrorNote error={upload.error} />
    </div>
  )
}

/** An image of the library (or none), chosen in a dialog that can also upload. */
export function ImagePicker({ label, value, onChange, hint }: { label: string; value: string | null | undefined; onChange: (id: string | null) => void; hint?: ReactNode }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const images = useQuery(brandingImagesQuery)
  const src = brandingImageUrl(value)
  const labelId = useId()
  return (
    <div className="space-y-1.5">
      <p id={labelId} className="text-sm font-medium text-stone-800">
        {label}
      </p>
      <div className="flex items-center gap-3">
        <div className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-100 text-stone-400">
          {src ? <img src={src} alt="" className="size-full object-cover" /> : <IconImage size={20} />}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" aria-describedby={labelId} onClick={() => setOpen(true)}>
            {value ? t('appearance.images.change') : t('appearance.images.choose')}
          </Button>
          {value && (
            <Button size="sm" variant="ghost" aria-describedby={labelId} onClick={() => onChange(null)}>
              {t('appearance.images.none')}
            </Button>
          )}
        </div>
      </div>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
      <Dialog open={open} onClose={() => setOpen(false)} title={label} wide footer={<UploadButton onUploaded={(ids) => (onChange(ids[0]), setOpen(false))} />}>
        {images.isPending ? null : images.isError ? (
          <ErrorNote error={images.error} onRetry={() => void images.refetch()} />
        ) : !images.data.items.length ? (
          <p className="text-sm text-stone-600">{t('appearance.images.empty')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.data.items.map((img) => (
              <li key={img.id}>
                <button
                  type="button"
                  onClick={() => (onChange(img.id), setOpen(false))}
                  aria-pressed={img.id === value}
                  aria-label={t('appearance.images.pick', { width: img.width, height: img.height })}
                  className={cx('relative block aspect-[4/3] w-full overflow-hidden rounded-lg border-2 bg-stone-100', img.id === value ? 'border-accent' : 'border-transparent hover:border-stone-300')}
                >
                  <img src={brandingImageUrl(img.id, img.url) ?? ''} alt="" loading="lazy" className="size-full object-cover" />
                  {img.id === value && (
                    <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-accent text-accent-contrast">
                      <IconCheck size={14} />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  )
}

type LinkKind = 'none' | 'catalog' | 'product' | 'url'

function kindOf(link: string | null | undefined): LinkKind {
  if (!link) return 'none'
  if (link.startsWith('https://')) return 'url'
  if (link.startsWith('/products/')) return 'product'
  return 'catalog'
}

const FILTER_KEYS = ['item_type', 'collection', 'season', 'target_group', 'qualifier', 'color'] as const
const FACET_OF = { item_type: 'item_types', collection: 'collections', season: 'seasons', target_group: 'target_groups', qualifier: 'qualifiers', color: 'colors' } as const
const ENUM_OF: Partial<Record<(typeof FILTER_KEYS)[number], string>> = { item_type: 'enum.itemType', target_group: 'enum.targetGroup' }

/**
 * Where a button or tile goes: catalogue filters (picked from the brand's own values), one
 * article, or a web address (https only). Writes the link as the spec wants it.
 */
export function LinkPicker({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string | null) => void }) {
  const { t } = useTranslation()
  const [kind, setKind] = useState<LinkKind>(kindOf(value))
  const [url, setUrl] = useState(value?.startsWith('https://') ? value : '')
  const [style, setStyle] = useState(value?.startsWith('/products/') ? decodeURIComponent(value.slice(10)) : '')
  const urlBad = kind === 'url' && url.trim() !== '' && !isPortalLink(url.trim())
  return (
    <fieldset className="space-y-2 rounded-lg border border-stone-200 p-3">
      <legend className="px-1 text-sm font-medium text-stone-800">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {(['none', 'catalog', 'product', 'url'] as const).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => {
              setKind(k)
              if (k === 'none') onChange(null)
              if (k === 'catalog') onChange('/catalog')
              if (k === 'product') onChange(style ? `/products/${encodeURIComponent(style)}` : null)
              if (k === 'url') onChange(isPortalLink(url) ? url : null)
            }}
            className={cx('h-8 rounded-full border px-3 text-xs font-medium', kind === k ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-700')}
          >
            {t(`appearance.link.${k}`)}
          </button>
        ))}
      </div>
      {kind === 'catalog' && (
        <div className="space-y-3">
          <p className="text-xs text-stone-500">{t('appearance.link.catalogHint')}</p>
          <FilterChooser query={value?.split('?')[1] ?? ''} onChange={(q) => onChange('/catalog' + (q ? `?${q}` : ''))} />
          <p className="break-all font-mono text-[11px] text-stone-500">{value}</p>
        </div>
      )}
      {kind === 'product' && (
        <Field label={t('appearance.link.styleNumber')}>
          {(p) => (
            <input
              {...p}
              className="input"
              value={style}
              onChange={(e) => {
                setStyle(e.target.value)
                const v = e.target.value.trim()
                onChange(v ? `/products/${encodeURIComponent(v)}` : null)
              }}
            />
          )}
        </Field>
      )}
      {kind === 'url' && (
        <Field label={t('appearance.link.urlField')} hint={t('appearance.link.urlHint')} error={urlBad ? t('appearance.link.urlInvalid') : null}>
          {(p) => (
            <input
              {...p}
              type="url"
              className="input"
              placeholder="https://"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                const v = e.target.value.trim()
                onChange(isPortalLink(v) && v.startsWith('https://') ? v : null)
              }}
            />
          )}
        </Field>
      )}
    </fieldset>
  )
}

/** Catalogue filter values as chips (the brand's own values from the facets) → a query string. */
export function FilterChooser({ query, onChange }: { query: string; onChange: (query: string) => void }) {
  const { t } = useTranslation()
  const facets = useQuery(facetsQuery({}))
  const facetLabel = useFacetLabel()
  const search = queryFilter(query)
  const values = (k: (typeof FILTER_KEYS)[number]) => {
    const v = search[k]
    return Array.isArray(v) ? v : v ? [v] : []
  }
  const setFilter = (k: (typeof FILTER_KEYS)[number], vals: string[]) => {
    const next: Record<string, string[]> = {}
    for (const key of FILTER_KEYS) next[key] = key === k ? vals : values(key)
    onChange(catalogLink(next).replace(/^\/catalog\??/, ''))
  }
  return (
    <div className="space-y-3">
      {FILTER_KEYS.map((k) => {
        const options = facets.data?.[FACET_OF[k]] ?? []
        if (!options.length) return null
        const chosen = values(k)
        return (
          <div key={k} className="space-y-1">
            <p className="text-xs font-medium text-stone-700">{t(`portal.filters.${k}`)}</p>
            <div className="flex flex-wrap gap-1">
              {options.map((o) => {
                const on = chosen.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(k, on ? chosen.filter((x) => x !== o.value) : [...chosen, o.value])}
                    className={cx('h-7 rounded-full border px-2.5 text-xs', on ? 'border-accent bg-accent-soft font-medium text-accent-strong' : 'border-stone-300 bg-white text-stone-700')}
                  >
                    {facetLabel(o, ENUM_OF[k], k === 'qualifier' ? 'qualifier' : undefined)}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
