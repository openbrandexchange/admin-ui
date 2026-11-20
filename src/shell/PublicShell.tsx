import { createContext, useContext, type ReactNode } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import type { PublicBranding } from '../api/types'
import { useBranding } from '../queries/session'
import { ThemeContext, brandingImageUrl, useApplyBranding, usePortalTitle, usePreview, useResolvedTheme } from '../lib/branding'
import { cx } from '../ui/controls'
import { BrandMark, LanguageSwitcher, WorksWithBadge, SkipLink } from './common'
import { InMainContext } from './Fallbacks'
import { DemoBanner } from './DemoBanner'

/** How the public pages are laid out (branding.login.layout): cards sit on the page or on the form side. */
export const PublicLayoutContext = createContext<'centered' | 'split'>('centered')
export const usePublicLayout = () => useContext(PublicLayoutContext)

/** Login, invite, reset, request access and setup in the brand's look. */
export function PublicShell() {
  const branding = useBranding()
  const setup = useRouterState({ select: (s) => s.location.pathname.endsWith('/setup') })
  // The first-run wizard has no brand yet.
  return (
    <PublicFrame branding={setup ? undefined : branding.data}>
      <Outlet />
    </PublicFrame>
  )
}

/**
 * The frame of the public pages. `centered`: a card in the middle, on the background image
 * when there is one. `split`: the image fills the start half (left in left-to-right
 * languages), the page the other; on narrow screens the image is a band above the page.
 */
export function PublicFrame({ branding, children }: { branding: PublicBranding | undefined; children: ReactNode }) {
  const preview = usePreview()
  const title = usePortalTitle(branding)
  const theme = useResolvedTheme(branding?.theme, branding?.accent_color)
  useApplyBranding(theme, title.full, branding?.favicon_url)
  const login = branding?.login
  const image = brandingImageUrl(login?.background_image, login?.background_image_url)
  const split = login?.layout === 'split' && !!image
  const showBrand = !!branding && !branding.setup_required
  const Main = preview ? 'div' : 'main'

  const header = (
    <header className="flex items-center justify-between gap-4 px-4 py-4 @[40rem]:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {showBrand && <BrandMark name={branding.name} logo={branding.logo_url} />}
        {showBrand && (
          <p className="min-w-0 leading-tight">
            <span className="display block truncate text-lg text-stone-900">{title.brand}</span>
            <span className="block truncate text-xs text-stone-500">{title.word}</span>
          </p>
        )}
      </div>
      <LanguageSwitcher />
    </header>
  )
  const content = (
    <Main id={preview ? undefined : 'main'} tabIndex={preview ? undefined : -1} className={cx('flex flex-1 justify-center px-4 pb-12', split ? 'items-center pt-6' : 'items-start pt-4 @[40rem]:pt-12')}>
      <div className={cx('w-full space-y-6', split ? 'max-w-sm' : 'max-w-md')}>
        <InMainContext.Provider value={true}>{children}</InMainContext.Provider>
      </div>
    </Main>
  )
  const footer = (
    <footer className="flex justify-center pb-6">
      <WorksWithBadge />
    </footer>
  )

  return (
    <ThemeContext.Provider value={theme}>
      <PublicLayoutContext.Provider value={split ? 'split' : 'centered'}>
        <div className="@container flex min-h-dvh flex-col">
          {!preview && <SkipLink />}
          {!preview && <DemoBanner />}
          {split ? (
            <div className="grid flex-1 @5xl:grid-cols-2">
              <div className="relative h-44 overflow-hidden @[40rem]:h-64 @5xl:h-auto">
                <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
              </div>
              <div className="flex min-w-0 flex-col bg-white">
                {header}
                {content}
                {footer}
              </div>
            </div>
          ) : (
            <div className="relative isolate flex flex-1 flex-col">
              {image && (
                <>
                  <img src={image} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
                  <div aria-hidden="true" className="absolute inset-0 -z-10 bg-stone-50/30" />
                </>
              )}
              <div className={cx(image && 'bg-white/85 backdrop-blur')}>{header}</div>
              {content}
              {footer}
            </div>
          )}
        </div>
      </PublicLayoutContext.Provider>
    </ThemeContext.Provider>
  )
}
