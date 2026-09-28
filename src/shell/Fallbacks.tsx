import { Link } from '@tanstack/react-router'
import { createContext, useContext, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/controls'
import { ErrorNote } from '../ui/feedback'

/** True inside a shell's <main>; a fallback shown outside every shell brings its own landmark. */
export const InMainContext = createContext(false)

function Landmark({ children }: { children: ReactNode }) {
  const inMain = useContext(InMainContext)
  const cls = 'mx-auto max-w-md space-y-4 p-8 text-center'
  return inMain ? (
    <div className={cls}>{children}</div>
  ) : (
    <main id="main" tabIndex={-1} className={cls}>
      {children}
    </main>
  )
}

/** Shown when a page cannot load at all (the node is down, a broken deploy …). */
export function RouteError({ error }: { error: unknown }) {
  const { t } = useTranslation()
  return (
    <Landmark>
      <h1 className="text-xl font-semibold">{t('fallback.errorTitle')}</h1>
      <ErrorNote error={error} />
      <Button variant="primary" onClick={() => location.reload()}>
        {t('fallback.reload')}
      </Button>
    </Landmark>
  )
}

export function NotFound() {
  const { t } = useTranslation()
  return (
    <Landmark>
      <h1 className="text-xl font-semibold">{t('fallback.notFoundTitle')}</h1>
      <p className="text-sm text-stone-600">{t('fallback.notFound')}</p>
      <Link to="/" className="text-sm font-medium underline underline-offset-2">
        {t('fallback.home')}
      </Link>
    </Landmark>
  )
}
