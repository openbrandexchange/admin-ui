import { Outlet } from '@tanstack/react-router'
import { useBranding } from '../queries/session'
import { useApplyBranding, usePortalTitle } from '../lib/branding'
import { BrandMark, LanguageSwitcher, WorksWithBadge } from './common'

/** Login, invite, reset, request access and setup: a calm centred page in the brand's colours. */
export function PublicShell() {
  const branding = useBranding()
  const title = usePortalTitle(branding.data)
  useApplyBranding(branding.data?.accent_color, title.full)
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3 min-w-0">
          {branding.data && !branding.data.setup_required && <BrandMark name={branding.data.name} logo={branding.data.logo_url} />}
          {branding.data && !branding.data.setup_required && (
            <p className="truncate text-sm font-semibold text-stone-800">
              <span>{title.brand}</span>
              <span className="text-stone-400"> · </span>
              <span className="font-normal text-stone-600">{title.word}</span>
            </p>
          )}
        </div>
        <LanguageSwitcher />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:pt-12">
        <div className="w-full max-w-md space-y-6">
          <Outlet />
        </div>
      </main>
      <footer className="flex justify-center pb-6">
        <WorksWithBadge />
      </footer>
    </div>
  )
}
