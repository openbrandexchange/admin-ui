import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BLOCK_TYPES,
  isKnownBlock,
  MAX_BLOCKS,
  MAX_LONG_TEXT,
  MAX_PRODUCTS,
  MAX_TILES,
  type AnnouncementBlock,
  type BlockType,
  type ContactBlock,
  type HeroBlock,
  type HomeBlock,
  type ImageTextBlock,
  type PortalText,
  type ProductsBlock,
  type TextBlock,
  type TileItem,
  type TilesBlock,
} from '../../../api/appearance'
import { portalText } from '../../../lib/branding'
import { emailProblem } from '../../../lib/validate'
import { Button, cx, Field, TextField } from '../../../ui/controls'
import { Dialog } from '../../../ui/feedback'
import { IconArrowDown, IconArrowUp, IconChevronDown, IconDuplicate, IconGrip, IconPlus, IconTrash } from '../../../ui/icons'
import { newBlock, newBlockId } from './model'
import { Choice, FilterChooser, ImagePicker, LangTabs, LinkPicker, TextInput } from './fields'

type Blocks = HomeBlock[]

/**
 * The start page as a list of blocks: add, reorder (drag the handle, or focus it and use the
 * arrow keys), duplicate, delete, and edit each block's texts per language.
 */
export function HomeEditor({
  blocks,
  onChange,
  langs,
  lang,
  setLang,
  focus,
  setFocus,
}: {
  blocks: Blocks
  onChange: (fn: (b: Blocks) => Blocks) => void
  langs: string[]
  lang: string
  setLang: (l: string) => void
  focus: string | null
  setFocus: (id: string | null) => void
}) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const label = (b: HomeBlock) => (isKnownBlock(b) ? t(`appearance.blocks.${b.type}`) : t('appearance.blocks.unknown', { type: b.type }))

  const move = (from: number, to: number, viaKeyboard = false) => {
    if (to < 0 || to >= blocks.length || from === to) return
    const b = blocks[from]
    onChange((list) => {
      const next = [...list]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    setAnnounce(t('appearance.home.moved', { block: label(b), position: to + 1, count: blocks.length }))
    // Keep the keyboard on the moved block's handle.
    if (viaKeyboard) requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-grip="${b.id}"]`)?.focus())
  }
  const update = (id: string, fn: (b: HomeBlock) => HomeBlock) => onChange((list) => list.map((b) => (b.id === id ? fn(b) : b)))
  const remove = (i: number) => {
    const b = blocks[i]
    onChange((list) => list.filter((_, k) => k !== i))
    setAnnounce(t('appearance.home.removed', { block: label(b) }))
    if (focus === b.id) setFocus(null)
  }
  const duplicate = (i: number) => {
    const copy = { ...(JSON.parse(JSON.stringify(blocks[i])) as HomeBlock), id: newBlockId(blocks[i].type) }
    onChange((list) => [...list.slice(0, i + 1), copy, ...list.slice(i + 1)])
    setFocus(copy.id)
  }
  const add = (type: BlockType) => {
    const b = newBlock(type, lang)
    onChange((list) => [...list, b])
    setFocus(b.id)
    setAdding(false)
    requestAnimationFrame(() => document.getElementById(`edit-${b.id}`)?.scrollIntoView?.({ block: 'nearest' }))
  }
  const onGripKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    move(i, e.key === 'ArrowUp' ? i - 1 : i + 1, true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-stone-600">{blocks.length ? t('appearance.home.hint') : t('appearance.home.empty')}</p>
        <LangTabs langs={langs} value={lang} onChange={setLang} />
      </div>
      <p id="grip-help" className="sr-only">
        {t('appearance.home.gripHelp')}
      </p>
      <p className="sr-only" role="status" aria-live="assertive">
        {announce}
      </p>
      <ol ref={listRef} className="space-y-2" aria-label={t('appearance.home.blocks')}>
        {blocks.map((b, i) => {
          const open = focus === b.id
          const summary = summaryOf(b, lang)
          return (
            <li
              key={b.id}
              id={`edit-${b.id}`}
              onDragOver={(e) => {
                if (dragging === null) return
                e.preventDefault()
                setOver(i)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging !== null) move(dragging, i)
                setDragging(null)
                setOver(null)
              }}
              className={cx('rounded-xl border bg-white transition-shadow', open ? 'border-accent shadow-sm' : 'border-stone-200', over === i && dragging !== null && dragging !== i && 'ring-2 ring-accent', dragging === i && 'opacity-50')}
            >
              <div className="flex items-center gap-1 p-1.5">
                <button
                  type="button"
                  data-grip={b.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', b.id)
                    setDragging(i)
                  }}
                  onDragEnd={() => (setDragging(null), setOver(null))}
                  onKeyDown={(e) => onGripKey(e, i)}
                  aria-describedby="grip-help"
                  aria-label={t('appearance.home.reorder', { block: label(b), position: i + 1, count: blocks.length })}
                  className="grid size-9 cursor-grab place-items-center rounded-lg text-stone-500 hover:bg-stone-100 active:cursor-grabbing"
                >
                  <IconGrip size={18} />
                </button>
                <button type="button" onClick={() => setFocus(open ? null : b.id)} aria-expanded={open} aria-controls={`fields-${b.id}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-stone-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-stone-900">{label(b)}</span>
                    {summary && <span className="line-clamp-2 block text-xs break-words text-stone-500">{summary}</span>}
                  </span>
                  <IconChevronDown size={16} className={cx('text-stone-500 transition-transform', open && 'rotate-180')} />
                </button>
                <div className="flex shrink-0 items-center">
                  <IconButton label={t('appearance.home.moveUp', { block: label(b) })} disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <IconArrowUp size={16} />
                  </IconButton>
                  <IconButton label={t('appearance.home.moveDown', { block: label(b) })} disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)}>
                    <IconArrowDown size={16} />
                  </IconButton>
                  <IconButton label={t('appearance.home.duplicate', { block: label(b) })} disabled={blocks.length >= MAX_BLOCKS || !isKnownBlock(b)} onClick={() => duplicate(i)}>
                    <IconDuplicate size={16} />
                  </IconButton>
                  <IconButton label={t('appearance.home.delete', { block: label(b) })} onClick={() => remove(i)} danger>
                    <IconTrash size={16} />
                  </IconButton>
                </div>
              </div>
              {open && (
                <div id={`fields-${b.id}`} className="space-y-4 border-t border-stone-100 p-4">
                  <BlockFields block={b} lang={lang} onChange={(fn) => update(b.id, fn)} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <Button onClick={() => setAdding(true)} disabled={blocks.length >= MAX_BLOCKS}>
        <IconPlus size={16} />
        {t('appearance.home.add')}
      </Button>
      {blocks.length >= MAX_BLOCKS && <p className="text-xs text-stone-500">{t('appearance.home.max', { max: MAX_BLOCKS })}</p>}
      <Dialog open={adding} onClose={() => setAdding(false)} title={t('appearance.home.addTitle')} wide>
        <ul className="grid gap-2 sm:grid-cols-2">
          {BLOCK_TYPES.map((type) => (
            <li key={type}>
              <button type="button" onClick={() => add(type)} className="flex h-full w-full flex-col items-start gap-1 rounded-xl border border-stone-200 p-4 text-left hover:border-accent hover:bg-accent-soft/40">
                <span className="text-sm font-semibold text-stone-900">{t(`appearance.blocks.${type}`)}</span>
                <span className="text-xs text-stone-600">{t(`appearance.blocks.${type}Hint`)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  )
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={cx('grid size-9 place-items-center rounded-lg disabled:opacity-30', danger ? 'text-red-700 hover:bg-red-50' : 'text-stone-600 hover:bg-stone-100')}>
      {children}
    </button>
  )
}

function summaryOf(b: HomeBlock, lang: string): string {
  const txt = (v: unknown) => portalText(v as PortalText, lang)
  switch (b.type) {
    case 'contact':
      return [b.name, b.email].filter(Boolean).join(' · ')
    case 'announcement':
      return txt(b.text)
    case 'tiles':
      return txt(b.title) || ((b.items as TileItem[] | undefined) ?? []).map((x) => txt(x.title)).filter(Boolean).join(', ')
    default:
      return txt(b.title) || txt(b.text)
  }
}

type Change<T> = (fn: (b: T) => T) => void

function BlockFields({ block, lang, onChange }: { block: HomeBlock; lang: string; onChange: Change<HomeBlock> }) {
  const { t } = useTranslation()
  // Each editor changes its own block type; the list stores them as HomeBlock.
  // oxlint-disable-next-line typescript/no-explicit-any
  const c = onChange as unknown as Change<any>
  switch (block.type) {
    case 'hero':
      return <HeroFields block={block as HeroBlock} lang={lang} onChange={c} />
    case 'tiles':
      return <TilesFields block={block as TilesBlock} lang={lang} onChange={c} />
    case 'text':
      return <TextFields block={block as TextBlock} lang={lang} onChange={c} />
    case 'image_text':
      return <ImageTextFields block={block as ImageTextBlock} lang={lang} onChange={c} />
    case 'products':
      return <ProductsFields block={block as ProductsBlock} lang={lang} onChange={c} />
    case 'announcement':
      return <AnnouncementFields block={block as AnnouncementBlock} lang={lang} onChange={c} />
    case 'contact':
      return <ContactFields block={block as ContactBlock} lang={lang} onChange={c} />
    default:
      return <p className="text-sm text-stone-600">{t('appearance.blocks.unknownHint')}</p>
  }
}

function useSet<T>(onChange: Change<T>) {
  return <K extends keyof T>(k: K, v: T[K]) => onChange((b) => ({ ...b, [k]: v }))
}

function HeroFields({ block, lang, onChange }: { block: HeroBlock; lang: string; onChange: Change<HeroBlock> }) {
  const { t } = useTranslation()
  const set = useSet(onChange)
  return (
    <>
      <ImagePicker label={t('appearance.fields.image')} hint={t('appearance.fields.heroImageHint')} value={block.image} onChange={(v) => set('image', v)} />
      <TextInput label={t('appearance.fields.title')} value={block.title} lang={lang} onChange={(v) => set('title', v)} />
      <TextInput label={t('appearance.fields.text')} value={block.text} lang={lang} multiline onChange={(v) => set('text', v)} />
      <TextInput label={t('appearance.fields.buttonLabel')} value={block.button_label} lang={lang} onChange={(v) => set('button_label', v)} />
      <LinkPicker label={t('appearance.fields.link')} value={block.link} onChange={(v) => set('link', v)} />
      <Choice label={t('appearance.fields.align')} columns={2} value={block.align ?? 'left'} onChange={(v) => set('align', v)} options={(['left', 'center'] as const).map((v) => ({ value: v, label: t(`appearance.fields.align_${v}`) }))} />
      <Choice label={t('appearance.fields.height')} columns={2} value={block.height ?? 'large'} onChange={(v) => set('height', v)} options={(['medium', 'large'] as const).map((v) => ({ value: v, label: t(`appearance.fields.height_${v}`) }))} />
      <Choice label={t('appearance.fields.overlay')} value={block.overlay ?? 'dark'} onChange={(v) => set('overlay', v)} options={(['none', 'dark', 'light'] as const).map((v) => ({ value: v, label: t(`appearance.fields.overlay_${v}`) }))} />
    </>
  )
}

function TilesFields({ block, lang, onChange }: { block: TilesBlock; lang: string; onChange: Change<TilesBlock> }) {
  const { t } = useTranslation()
  const set = useSet(onChange)
  const items = block.items ?? []
  const setItem = (i: number, patch: Partial<TileItem>) => set('items', items.map((it, k) => (k === i ? { ...it, ...patch } : it)))
  const moveItem = (i: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [it] = next.splice(i, 1)
    next.splice(to, 0, it)
    set('items', next)
  }
  return (
    <>
      <TextInput label={t('appearance.fields.title')} value={block.title} lang={lang} onChange={(v) => set('title', v)} />
      <Choice label={t('appearance.fields.columns')} value={block.columns ?? 3} onChange={(v) => set('columns', v)} options={([2, 3, 4] as const).map((v) => ({ value: v, label: String(v) }))} />
      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={i} className="space-y-3 rounded-lg border border-stone-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-stone-800">{t('appearance.fields.tile', { n: i + 1 })}</p>
              <div className="flex">
                <IconButton label={t('appearance.fields.tileUp', { n: i + 1 })} disabled={i === 0} onClick={() => moveItem(i, i - 1)}>
                  <IconArrowUp size={16} />
                </IconButton>
                <IconButton label={t('appearance.fields.tileDown', { n: i + 1 })} disabled={i === items.length - 1} onClick={() => moveItem(i, i + 1)}>
                  <IconArrowDown size={16} />
                </IconButton>
                <IconButton label={t('appearance.fields.tileRemove', { n: i + 1 })} disabled={items.length <= 1} onClick={() => set('items', items.filter((_, k) => k !== i))} danger>
                  <IconTrash size={16} />
                </IconButton>
              </div>
            </div>
            <ImagePicker label={t('appearance.fields.image')} value={it.image} onChange={(v) => setItem(i, { image: v })} />
            <TextInput label={t('appearance.fields.title')} value={it.title} lang={lang} onChange={(v) => setItem(i, { title: v })} />
            <LinkPicker label={t('appearance.fields.link')} value={it.link} onChange={(v) => setItem(i, { link: v })} />
          </li>
        ))}
      </ol>
      <Button size="sm" disabled={items.length >= MAX_TILES} onClick={() => set('items', [...items, { image: null, title: null, link: null }])}>
        <IconPlus size={14} />
        {t('appearance.fields.addTile')}
      </Button>
    </>
  )
}

function TextFields({ block, lang, onChange }: { block: TextBlock; lang: string; onChange: Change<TextBlock> }) {
  const { t } = useTranslation()
  const set = useSet(onChange)
  return (
    <>
      <TextInput label={t('appearance.fields.title')} value={block.title} lang={lang} onChange={(v) => set('title', v)} />
      <TextInput label={t('appearance.fields.body')} hint={t('appearance.fields.bodyHint')} value={block.body} lang={lang} multiline max={MAX_LONG_TEXT} onChange={(v) => set('body', v)} />
    </>
  )
}

function ImageTextFields({ block, lang, onChange }: { block: ImageTextBlock; lang: string; onChange: Change<ImageTextBlock> }) {
  const { t } = useTranslation()
  const set = useSet(onChange)
  return (
    <>
      <ImagePicker label={t('appearance.fields.image')} value={block.image} onChange={(v) => set('image', v)} />
      <Choice label={t('appearance.fields.imageSide')} columns={2} value={block.image_side ?? 'left'} onChange={(v) => set('image_side', v)} options={(['left', 'right'] as const).map((v) => ({ value: v, label: t(`appearance.fields.side_${v}`) }))} />
      <TextInput label={t('appearance.fields.title')} value={block.title} lang={lang} onChange={(v) => set('title', v)} />
      <TextInput label={t('appearance.fields.text')} hint={t('appearance.fields.bodyHint')} value={block.text} lang={lang} multiline onChange={(v) => set('text', v)} />
      <TextInput label={t('appearance.fields.buttonLabel')} value={block.button_label} lang={lang} onChange={(v) => set('button_label', v)} />
      <LinkPicker label={t('appearance.fields.link')} value={block.link} onChange={(v) => set('link', v)} />
    </>
  )
}

function ProductsFields({ block, lang, onChange }: { block: ProductsBlock; lang: string; onChange: Change<ProductsBlock> }) {
  const { t } = useTranslation()
  const set = useSet(onChange)
  const source = block.style_numbers?.length || block.style_numbers ? 'pick' : block.query !== undefined && block.query !== null ? 'filter' : 'newest'
  const [numbers, setNumbers] = useState((block.style_numbers ?? []).join('\n'))
  return (
    <>
      <TextInput label={t('appearance.fields.title')} value={block.title} lang={lang} onChange={(v) => set('title', v)} />
      <Choice
        label={t('appearance.fields.source')}
        value={source}
        onChange={(v) => onChange((b) => ({ ...b, style_numbers: v === 'pick' ? numbers.split(/[\s,;]+/).filter(Boolean).slice(0, MAX_PRODUCTS) : null, query: v === 'filter' ? (b.query ?? '') : null }))}
        options={(['newest', 'filter', 'pick'] as const).map((v) => ({ value: v, label: t(`appearance.fields.source_${v}`) }))}
      />
      {source === 'filter' && <FilterChooser query={block.query ?? ''} onChange={(q) => set('query', q)} />}
      {source === 'pick' && (
        <Field label={t('appearance.fields.styleNumbers')} hint={t('appearance.fields.styleNumbersHint', { max: MAX_PRODUCTS })}>
          {(p) => (
            <textarea
              {...p}
              rows={4}
              className="input font-mono"
              value={numbers}
              onChange={(e) => {
                setNumbers(e.target.value)
                set('style_numbers', e.target.value.split(/[\s,;]+/).filter(Boolean).slice(0, MAX_PRODUCTS))
              }}
            />
          )}
        </Field>
      )}
      <TextField
        label={t('appearance.fields.max')}
        type="number"
        min={1}
        max={MAX_PRODUCTS}
        value={block.max ?? 8}
        onChange={(e) => set('max', Math.min(MAX_PRODUCTS, Math.max(1, Number(e.target.value) || 8)))}
        className="max-w-32"
      />
    </>
  )
}

function AnnouncementFields({ block, lang, onChange }: { block: AnnouncementBlock; lang: string; onChange: Change<AnnouncementBlock> }) {
  const { t } = useTranslation()
  const set = useSet(onChange)
  return (
    <>
      <TextInput label={t('appearance.fields.text')} value={block.text} lang={lang} multiline onChange={(v) => set('text', v)} />
      <Choice label={t('appearance.fields.tone')} value={block.tone ?? 'neutral'} onChange={(v) => set('tone', v)} options={(['neutral', 'info', 'success'] as const).map((v) => ({ value: v, label: t(`appearance.fields.tone_${v}`) }))} />
    </>
  )
}

function ContactFields({ block, lang, onChange }: { block: ContactBlock; lang: string; onChange: Change<ContactBlock> }) {
  const { t } = useTranslation()
  const set = useSet(onChange)
  const emailBad = !!block.email && !!emailProblem(block.email)
  return (
    <>
      <TextInput label={t('appearance.fields.title')} value={block.title} lang={lang} onChange={(v) => set('title', v)} />
      <TextField label={t('appearance.fields.contactName')} value={block.name ?? ''} maxLength={200} onChange={(e) => set('name', e.target.value || null)} />
      <TextField label={t('fields.email')} type="email" value={block.email ?? ''} onChange={(e) => set('email', e.target.value || null)} error={emailBad ? t('validate.email') : null} />
      <TextField label={t('appearance.fields.phone')} type="tel" value={block.phone ?? ''} maxLength={50} onChange={(e) => set('phone', e.target.value || null)} />
    </>
  )
}
