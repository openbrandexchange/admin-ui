import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '../../api/types'
import { Badge, cx } from '../../ui/controls'
import { Dialog } from '../../ui/feedback'
import { IconChevronLeft, IconImage, IconSearch, IconSparkle } from '../../ui/icons'

/** Colour groups in feed order (colour code, then position). */
export function byColour(assets: Asset[]) {
  const groups = new Map<string, Asset[]>()
  for (const a of assets) {
    const k = a.color_code ?? ''
    groups.set(k, [...(groups.get(k) ?? []), a])
  }
  for (const list of groups.values()) list.sort((a, b) => a.position - b.position)
  return groups
}

/**
 * The article's images, large: thumbnails beside (wide) or below (narrow) the main image. A
 * mouse click on the main image zooms in where it points; the zoom button opens the image
 * full screen, where arrow keys move between images.
 */
export function Gallery({ images, active, onActive, altOf }: { images: Asset[]; active: number; onActive: (i: number) => void; altOf: (a: Asset) => string }) {
  const { t } = useTranslation()
  const current = images[Math.min(active, images.length - 1)]
  const [zoomAt, setZoomAt] = useState<{ i: number; x: number; y: number } | null>(null)
  // A zoom belongs to one image: moving to another shows it whole.
  const zoom = zoomAt && zoomAt.i === active ? zoomAt : null
  const setZoom = (p: { x: number; y: number } | null) => setZoomAt(p && { i: active, ...p })
  const [full, setFull] = useState(false)
  const frame = useRef<HTMLDivElement>(null)

  const point = (e: PointerEvent<HTMLElement>) => {
    const r = frame.current?.getBoundingClientRect()
    if (!r) return { x: 50, y: 50 }
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }
  }
  const step = (d: number) => images.length > 1 && onActive((active + d + images.length) % images.length)
  // Full screen: the arrow keys move between images.
  const stepRef = useRef(step)
  useEffect(() => {
    stepRef.current = step
  })
  useEffect(() => {
    if (!full) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight') stepRef.current(1)
      if (e.key === 'ArrowLeft') stepRef.current(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  return (
    <div className="flex flex-col gap-3 @5xl:flex-row-reverse">
      <div ref={frame} className="img-frame relative aspect-[4/5] min-w-0 flex-1 overflow-hidden">
        {current ? (
          <img
            src={current.renditions.web.url}
            alt={altOf(current)}
            onPointerDown={(e) => e.pointerType === 'mouse' && setZoom(zoom ? null : point(e))}
            onPointerMove={(e) => zoom && e.pointerType === 'mouse' && setZoom(point(e))}
            onPointerLeave={() => setZoom(null)}
            className={cx('product-img size-full transition-transform duration-200 ease-out motion-reduce:transition-none', zoom ? 'cursor-zoom-out' : 'cursor-zoom-in')}
            style={zoom ? { transform: 'scale(2.4)', transformOrigin: `${zoom.x}% ${zoom.y}%`, objectFit: 'contain' } : undefined}
            draggable={false}
          />
        ) : (
          <div className="grid size-full place-items-center text-stone-400">
            <IconImage size={40} />
          </div>
        )}
        {current && (current.provenance.ai_generated || current.provenance.ai_edited) && (
          <span className="absolute left-3 top-3">
            <Badge tone="blue">
              <IconSparkle size={14} />
              {current.provenance.ai_generated ? t('portal.product.aiGenerated') : t('portal.product.aiEdited')}
            </Badge>
          </span>
        )}
        {current && (
          <button type="button" onClick={() => setFull(true)} className="absolute bottom-3 right-3 grid size-10 place-items-center rounded-full bg-white/90 text-stone-800 shadow-sm backdrop-blur hover:bg-white" aria-label={t('portal.product.zoom')}>
            <IconSearch size={18} />
          </button>
        )}
      </div>
      {images.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1 scrollbar-none @5xl:max-h-[44rem] @5xl:w-20 @5xl:flex-col @5xl:overflow-y-auto" aria-label={t('portal.product.images')}>
          {images.map((a, i) => (
            <li key={a.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onActive(i)}
                aria-label={t('portal.product.showImage', { n: a.position })}
                aria-current={i === active}
                className={cx('img-frame block aspect-[4/5] w-16 overflow-hidden border-2 transition-opacity @5xl:w-20', i === active ? 'border-stone-900' : 'border-transparent opacity-75 hover:opacity-100')}
              >
                <img src={a.renditions.thumb.url} alt="" loading="lazy" className="product-img size-full" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={full} onClose={() => setFull(false)} title={current ? altOf(current) : ''} size="xl" hideTitle>
        {current && (
          <div
            className="relative bg-[var(--img-bg)]"
            role="group"
            aria-label={t('portal.product.images')}
          >
            <img src={(current.renditions.original ?? current.renditions.web).url} alt={altOf(current)} className="mx-auto max-h-[86dvh] w-auto object-contain" />
            {images.length > 1 && (
              <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                <button type="button" onClick={() => step(-1)} className="grid size-11 place-items-center rounded-full bg-white/90 shadow-sm" aria-label={t('portal.product.previousImage')}>
                  <IconChevronLeft size={20} />
                </button>
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-stone-700 tabular" aria-live="polite">
                  {active + 1} / {images.length}
                </span>
                <button type="button" onClick={() => step(1)} className="grid size-11 place-items-center rounded-full bg-white/90 shadow-sm" aria-label={t('portal.product.nextImage')}>
                  <IconChevronLeft size={20} className="rotate-180" />
                </button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
