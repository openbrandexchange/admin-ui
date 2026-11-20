import { useState, type ReactNode } from 'react'
import { useInfiniteQuery, useQueries } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { isKnownBlock, type AnnouncementBlock, type ContactBlock, type HeroBlock, type HomeBlock, type ImageTextBlock, type KnownBlock, type PortalText, type ProductsBlock, type TextBlock, type TilesBlock } from '../../api/appearance'
import type { PortalProductSummary } from '../../api/types'
import { brandingImageUrl, homeBlocks, portalText, usePreview } from '../../lib/branding'
import { parseLink, queryFilter } from '../../lib/links'
import { api, req } from '../../api/client'
import { portalProductsQuery, useViewer } from '../../queries/portal'
import { buttonClass, cx } from '../../ui/controls'
import { CatalogScreen, useSelectionToggle } from './Catalog'
import { GRID, ProductTile } from './ProductTile'
import { QuickView } from './QuickView'

/** "/": the brand's start page when it has blocks and no catalogue filter is asked for, else the catalogue. */
export function StartScreen() {
  const viewer = useViewer()
  const preview = usePreview()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const branding = preview?.branding ?? viewer.data?.branding
  const blocks = homeBlocks(branding)
  const filtered = Object.values(search).some((v) => v !== undefined && v !== '')
  if (!blocks.length || filtered) return <CatalogScreen />
  return <HomeBlocks blocks={blocks} defaultLanguage={branding?.default_language} />
}

const CONTAINER = 'mx-auto w-full max-w-[90rem] px-4 @[40rem]:px-6 @7xl:px-10'

export function HomeBlocks({ blocks, defaultLanguage }: { blocks: HomeBlock[]; defaultLanguage?: string }) {
  const { i18n, t } = useTranslation()
  const preview = usePreview()
  const text = (v: PortalText | undefined) => portalText(v, i18n.language, defaultLanguage)
  const known = blocks.filter(isKnownBlock)
  return (
    <div className="pb-16">
      <h1 className="sr-only">{t('portal.home.title')}</h1>
      {known.map((b, i) => (
        <div key={b.id} id={`block-${b.id}`} className={cx('scroll-mt-24', preview?.focusBlock === b.id && 'outline-2 -outline-offset-2 outline-accent')}>
          <Block block={b} text={text} first={i === 0} />
        </div>
      ))}
    </div>
  )
}

type T = (v: PortalText | undefined) => string

function Block({ block, text, first }: { block: KnownBlock; text: T; first: boolean }) {
  switch (block.type) {
    case 'hero':
      return <Hero block={block} text={text} />
    case 'announcement':
      return <Announcement block={block} text={text} />
    case 'tiles':
      return <Tiles block={block} text={text} first={first} />
    case 'text':
      return <TextSection block={block} text={text} first={first} />
    case 'image_text':
      return <ImageText block={block} text={text} first={first} />
    case 'products':
      return <Products block={block} text={text} first={first} />
    case 'contact':
      return <Contact block={block} text={text} first={first} />
  }
}

/** A start page link: portal paths stay in the portal, https:// opens in a new tab. */
export function BlockLink({ link, className, children, label }: { link: string | null | undefined; className?: string; children: ReactNode; label?: string }) {
  const { t } = useTranslation()
  const parsed = parseLink(link)
  if (!parsed) return <span className={className}>{children}</span>
  if (parsed.external)
    return (
      <a href={parsed.href} target="_blank" rel="noopener noreferrer" className={className} aria-label={label}>
        {children}
        <span className="sr-only"> ({t('common.opensInNewTab')})</span>
      </a>
    )
  return (
    <Link to={parsed.to as '/'} search={parsed.search as never} className={className} aria-label={label}>
      {children}
    </Link>
  )
}

const section = (first: boolean) => cx(CONTAINER, first ? 'pt-8 pb-10 @5xl:pt-12' : 'py-10 @5xl:py-16')

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  if (!children && !action) return null
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 @5xl:mb-8">
      {children ? <h2 className="display text-3xl text-stone-900 @5xl:text-4xl">{children}</h2> : <span />}
      {action}
    </div>
  )
}

function Paragraphs({ value, className }: { value: string; className?: string }) {
  // Plain text: a blank line starts a new paragraph (never HTML or Markdown).
  return (
    <>
      {value
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={cx('whitespace-pre-line', className)}>
            {p}
          </p>
        ))}
    </>
  )
}

function Hero({ block, text }: { block: HeroBlock; text: T }) {
  const src = brandingImageUrl(block.image, block.image_url)
  const title = text(block.title)
  const body = text(block.text)
  const label = text(block.button_label)
  const overlay = src ? (block.overlay ?? 'dark') : 'none'
  const centre = block.align === 'center'
  // Text colour follows the shade: light on a dark shade, dark on a light one, the theme's text without.
  // Without a shade the brand chose an image the text reads on as it is (a light one): dark ink
  // on the image, the theme's text where the image is a band above it (narrow screens).
  const ink = overlay === 'dark' ? 'text-snow' : overlay === 'light' ? 'text-[#161514]' : src ? 'text-stone-900 @5xl:text-[#161514]' : 'text-stone-900'
  // Without a shade the text cannot sit on the photograph on a narrow screen: the image becomes a band above it there.
  const band = !!src && overlay === 'none'
  return (
    <section className={cx('relative isolate flex overflow-hidden', band ? 'flex-col @5xl:flex-row' : '', block.height === 'medium' ? '@5xl:min-h-[30rem]' : '@5xl:min-h-[42rem]', !band && (block.height === 'medium' ? 'min-h-[24rem]' : 'min-h-[30rem]'), !src && 'bg-accent-soft')}>
      {src && <img src={src} alt="" className={cx('-z-10 w-full object-cover', band ? 'h-64 @[40rem]:h-80 @5xl:absolute @5xl:inset-0 @5xl:h-full' : 'absolute inset-0 size-full')} />}
      {overlay === 'dark' && <div aria-hidden="true" className={cx('absolute inset-0 -z-10', centre ? 'bg-black/45' : 'bg-gradient-to-r from-black/65 via-black/35 to-black/5 rtl:bg-gradient-to-l')} />}
      {overlay === 'light' && <div aria-hidden="true" className={cx('absolute inset-0 -z-10', centre ? 'bg-white/60' : 'bg-gradient-to-r from-white/85 via-white/55 to-white/0 rtl:bg-gradient-to-l')} />}
      <div className={cx(CONTAINER, 'flex py-10 @5xl:items-center @5xl:py-20', band ? 'items-start' : 'items-end', centre && 'justify-center text-center')}>
        <div className={cx('max-w-2xl space-y-5', ink, centre && 'mx-auto')}>
          {title && <h2 className="display text-5xl @[40rem]:text-6xl @7xl:text-7xl">{title}</h2>}
          {body && <p className={cx('max-w-xl text-base leading-relaxed @[40rem]:text-lg', centre && 'mx-auto', overlay === 'none' && (src ? 'text-stone-700 @5xl:text-[#3d3b38]' : 'text-stone-700'))}>{body}</p>}
          {label && block.link && (
            <div className="pt-2">
              <BlockLink link={block.link} className={cx(buttonClass(overlay === 'dark' ? 'secondary' : 'primary'), 'h-12 px-6 text-base')}>
                {label}
              </BlockLink>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Announcement({ block, text }: { block: AnnouncementBlock; text: T }) {
  const value = text(block.text)
  if (!value) return null
  const tone = block.tone === 'success' ? 'bg-emerald-50 text-emerald-900' : block.tone === 'info' ? 'bg-accent text-accent-contrast' : 'bg-stone-100 text-stone-800'
  return (
    <div className={tone} role="note">
      <p className={cx(CONTAINER, 'py-3.5 text-center text-sm leading-relaxed')}>{value}</p>
    </div>
  )
}

function Tiles({ block, text, first }: { block: TilesBlock; text: T; first: boolean }) {
  const items = (block.items ?? []).slice(0, 12)
  if (!items.length) return null
  const cols = { 2: '@3xl:grid-cols-2', 3: '@3xl:grid-cols-3', 4: '@3xl:grid-cols-2 @5xl:grid-cols-4' }[block.columns ?? 3] ?? '@3xl:grid-cols-3'
  return (
    <section className={section(first)}>
      <SectionTitle>{text(block.title)}</SectionTitle>
      <ul className={cx('grid grid-cols-2 gap-3 @5xl:gap-5', cols)}>
        {items.map((item, i) => {
          const src = brandingImageUrl(item.image, item.image_url)
          const title = text(item.title)
          return (
            <li key={i}>
              <BlockLink link={item.link} className="group relative block aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-stone-200">
                {src && <img src={src} alt="" loading="lazy" className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] motion-reduce:group-hover:scale-100" />}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                {title && <span className="display absolute inset-x-4 bottom-4 text-2xl text-snow @5xl:text-3xl">{title}</span>}
              </BlockLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function TextSection({ block, text, first }: { block: TextBlock; text: T; first: boolean }) {
  const title = text(block.title)
  const body = text(block.body)
  if (!title && !body) return null
  return (
    <section className={section(first)}>
      <div className="max-w-3xl space-y-4">
        {title && <h2 className="display text-3xl text-stone-900 @5xl:text-4xl">{title}</h2>}
        <div className="max-w-prose space-y-4 text-base leading-relaxed text-stone-700">
          <Paragraphs value={body} />
        </div>
      </div>
    </section>
  )
}

function ImageText({ block, text, first }: { block: ImageTextBlock; text: T; first: boolean }) {
  const src = brandingImageUrl(block.image, block.image_url)
  const label = text(block.button_label)
  return (
    <section className={section(first)}>
      <div className="grid items-center gap-8 @3xl:grid-cols-2 @7xl:gap-16">
        <div className={cx('aspect-[4/5] overflow-hidden rounded-[var(--radius-image)] bg-stone-200 @3xl:aspect-[4/5]', block.image_side === 'right' && '@3xl:order-2')}>
          {src && <img src={src} alt="" loading="lazy" className="size-full object-cover" />}
        </div>
        <div className="max-w-xl space-y-5">
          {text(block.title) && <h2 className="display text-4xl text-stone-900 @5xl:text-5xl">{text(block.title)}</h2>}
          <div className="space-y-4 text-base leading-relaxed text-stone-700">
            <Paragraphs value={text(block.text)} />
          </div>
          {label && block.link && (
            <BlockLink link={block.link} className={cx(buttonClass('secondary'), 'h-11 px-5')}>
              {label}
            </BlockLink>
          )}
        </div>
      </div>
    </section>
  )
}

/** Products of a block: by style number (in that order), else by the filter query, else the newest. Never more than `max` (default 8). */
function useBlockProducts(block: ProductsBlock): { items: PortalProductSummary[]; pending: boolean } {
  const max = Math.min(24, Math.max(1, block.max ?? 8))
  const numbers = (block.style_numbers ?? []).filter(Boolean).slice(0, 24)
  const byNumber = useQueries({
    queries: numbers.map((sn) => ({
      queryKey: ['portal', 'products', 'style', sn],
      queryFn: () => req(() => api.GET('/admin/api/portal/products', { params: { query: { q: sn, limit: 10 } as never } })),
      staleTime: 60_000,
    })),
  })
  const filter = queryFilter(block.query)
  const list = useInfiniteQuery({ ...portalProductsQuery(filter as never), enabled: numbers.length === 0 })
  if (numbers.length) {
    const items = numbers.map((sn, i) => byNumber[i]?.data?.items.find((p) => p.style_number.toLowerCase() === sn.toLowerCase())).filter((p): p is PortalProductSummary => !!p)
    return { items: items.slice(0, max), pending: byNumber.some((q) => q.isPending) }
  }
  const all = list.data?.pages.flatMap((p) => p.items) ?? []
  const items = block.query ? all : [...all].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  return { items: items.slice(0, max), pending: list.isPending }
}

function Products({ block, text, first }: { block: ProductsBlock; text: T; first: boolean }) {
  const { t } = useTranslation()
  const { items, pending } = useBlockProducts(block)
  const { selected, toggle } = useSelectionToggle()
  const [quick, setQuick] = useState<PortalProductSummary | null>(null)
  const viewAll = !block.style_numbers?.length ? `/catalog${block.query ? `?${block.query}` : ''}` : null
  if (!pending && !items.length) return null
  return (
    <section className={section(first)}>
      <SectionTitle
        action={
          viewAll && (
            <BlockLink link={viewAll} className="inline-flex h-10 items-center text-sm font-medium text-stone-900 underline underline-offset-4 hover:text-accent-strong">
              {t('common.viewAll')}
            </BlockLink>
          )
        }
      >
        {text(block.title)}
      </SectionTitle>
      {pending ? (
        <ul className={cx('grid', GRID.comfortable)} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="img-frame aspect-[4/5] animate-pulse" />
          ))}
        </ul>
      ) : (
        <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-none @3xl:grid @3xl:grid-cols-3 @3xl:overflow-visible @7xl:grid-cols-4" aria-label={text(block.title) || t('portal.catalog.results')}>
          {items.map((p) => (
            <li key={p.id} className="w-[68%] shrink-0 snap-start @[30rem]:w-[44%] @3xl:w-auto">
              <ProductTile product={p} density="comfortable" selected={selected.has(p.id)} onToggle={() => toggle(p.id)} onQuickView={() => setQuick(p)} />
            </li>
          ))}
        </ul>
      )}
      <QuickView summary={quick} onClose={() => setQuick(null)} selected={!!quick && selected.has(quick.id)} onToggle={() => quick && toggle(quick.id)} />
    </section>
  )
}

function Contact({ block, text, first }: { block: ContactBlock; text: T; first: boolean }) {
  const { t } = useTranslation()
  if (!block.name && !block.email && !block.phone) return null
  return (
    <section className={section(first)}>
      <div className="grid gap-6 border-t border-stone-300 pt-10 @3xl:grid-cols-[1fr_2fr]">
        <h2 className="display text-3xl text-stone-900">{text(block.title) || t('portal.home.contact')}</h2>
        <div className="space-y-2">
          {block.name && <p className="text-xl text-stone-900">{block.name}</p>}
          <ul className="flex flex-wrap gap-x-8 gap-y-2 text-base">
            {block.email && (
              <li>
                <a href={`mailto:${block.email}`} className="text-accent-strong underline underline-offset-4">
                  {block.email}
                </a>
              </li>
            )}
            {block.phone && (
              <li>
                <a href={`tel:${block.phone.replace(/[^\d+]/g, '')}`} className="text-accent-strong underline underline-offset-4">
                  {block.phone}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
