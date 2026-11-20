import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import type { PortalViewer } from '../../../api/types'
import { PreviewContext, useResolvedTheme } from '../../../lib/branding'
import { applyTheme } from '../../../lib/theme'
import { makeRouter } from '../../../router'
import { cx } from '../../../ui/controls'
import { IconMonitor, IconPhone } from '../../../ui/icons'
import { LoginPreview } from '../../public/Login'

export type PreviewScreen = 'home' | 'catalog' | 'login'
const DESKTOP = 1280
const PHONE = 390

/**
 * The real retailer screens with the unsaved settings: a second router (memory history) in a
 * frame that has its own theme scope. Desktop renders 1280 px wide, scaled to fit; the phone
 * frame is 390 px. The layout follows the frame's width (container queries), not the window's.
 */
export function Preview({ branding, screen, onScreen, focusBlock }: { branding: PortalViewer['branding']; screen: PreviewScreen; onScreen: (s: PreviewScreen) => void; focusBlock: string | null }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop')
  const pane = useRef<HTMLDivElement>(null)
  const scope = useRef<HTMLDivElement>(null)
  const [paneWidth, setPaneWidth] = useState(800)
  const theme = useResolvedTheme(branding.theme, branding.accent_color)
  const router = useMemo(() => makeRouter(qc, { history: createMemoryHistory({ initialEntries: ['/'] }), scrollRestoration: false }), [qc])

  useLayoutEffect(() => {
    const el = pane.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setPaneWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (scope.current) applyTheme(scope.current, theme)
  }, [theme, screen])
  useEffect(() => {
    if (screen === 'home') void router.navigate({ to: '/' })
    if (screen === 'catalog') void router.navigate({ to: '/catalog' })
  }, [screen, router])
  // The block being edited scrolls into view in the preview.
  useEffect(() => {
    if (!focusBlock) return
    const id = requestAnimationFrame(() => document.getElementById(`block-${focusBlock}`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }))
    return () => cancelAnimationFrame(id)
  }, [focusBlock])

  const width = device === 'desktop' ? DESKTOP : PHONE
  const scale = Math.min(1, (paneWidth - 2) / width)
  const value = useMemo(() => ({ branding, focusBlock }), [branding, focusBlock])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={t('appearance.preview.screen')} className="flex gap-1 rounded-control border border-stone-300 bg-white p-0.5">
          {(['home', 'catalog', 'login'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={screen === s} onClick={() => onScreen(s)} className={cx('h-8 rounded-md px-3 text-sm font-medium', screen === s ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100')}>
              {t(`appearance.preview.${s}`)}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={t('appearance.preview.device')} className="flex gap-1 rounded-control border border-stone-300 bg-white p-0.5">
          {(['desktop', 'phone'] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={device === d} onClick={() => setDevice(d)} className={cx('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium', device === d ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100')}>
              {d === 'desktop' ? <IconMonitor size={16} /> : <IconPhone size={16} />}
              {t(`appearance.preview.${d}`)}
            </button>
          ))}
        </div>
      </div>
      <div ref={pane} className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-stone-300 bg-stone-200/70">
        <div
          role="region"
          aria-label={t('appearance.preview.label')}
          // transform: the frame contains fixed and sticky elements of the screens it shows.
          className={cx('absolute top-0 left-1/2 origin-top overflow-y-auto overflow-x-hidden bg-white shadow-sm', device === 'phone' && 'top-3 rounded-[1.75rem] ring-8 ring-stone-900')}
          style={{ width, height: `${100 / scale}%`, transform: `translateX(-50%) scale(${scale})`, maxHeight: device === 'phone' ? `calc((100% - 1.5rem) / ${scale})` : undefined }}
          tabIndex={0}
        >
          {/* A picture of the screens, not a second set of controls: inert keeps it out of the tab order and the accessibility tree. */}
          <div ref={scope} className="themed-scope min-h-full" inert>
            <PreviewContext.Provider value={value}>{screen === 'login' ? <LoginPreview branding={branding} /> : <RouterProvider router={router} />}</PreviewContext.Provider>
          </div>
        </div>
      </div>
    </div>
  )
}
