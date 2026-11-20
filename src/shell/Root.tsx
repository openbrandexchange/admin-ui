import { Outlet, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { installCsrfRefresh } from '../queries/session'
import { usePreview } from '../lib/branding'

export function Root() {
  const qc = useQueryClient()
  const router = useRouter()
  // The Appearance preview runs a second router inside the admin page: the page itself keeps
  // focus management.
  const preview = !!usePreview()
  useEffect(() => installCsrfRefresh(qc), [qc])
  // After moving to another page the clicked element is often gone, which leaves keyboard and
  // screen-reader users at the top of nothing. Put them at the start of the new content.
  // Filter and search changes (same path) never move focus.
  useEffect(
    () =>
      preview ? undefined : router.subscribe('onResolved', ({ fromLocation, toLocation }) => {
        if (!fromLocation || fromLocation.pathname === toLocation.pathname) return
        requestAnimationFrame(() => {
          const active = document.activeElement
          if (active && active !== document.body && active.isConnected) return
          document.getElementById('main')?.focus({ preventScroll: true })
        })
      }),
    [router, preview],
  )
  // The same within a page: when the focused control goes away (a confirm button whose list is
  // now empty, a row that was removed), the browser drops focus on the page itself. Put it at
  // the start of the content instead, unless the screen already moved it somewhere.
  useEffect(() => {
    if (preview) return
    let last: Element | null = null
    const onFocus = (e: FocusEvent) => {
      last = e.target instanceof Element ? e.target : null
    }
    const observer = new MutationObserver(() => {
      if (!last || last.isConnected) return
      last = null
      requestAnimationFrame(() => {
        const active = document.activeElement
        if (active && active !== document.body) return
        document.getElementById('main')?.focus({ preventScroll: true })
      })
    })
    document.addEventListener('focusin', onFocus)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      document.removeEventListener('focusin', onFocus)
      observer.disconnect()
    }
  }, [preview])
  return <Outlet />
}
