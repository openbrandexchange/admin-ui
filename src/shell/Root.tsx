import { Outlet, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { installCsrfRefresh } from '../queries/session'

export function Root() {
  const qc = useQueryClient()
  const router = useRouter()
  useEffect(() => installCsrfRefresh(qc), [qc])
  // After moving to another page the clicked element is often gone, which leaves keyboard and
  // screen-reader users at the top of nothing. Put them at the start of the new content.
  // Filter and search changes (same path) never move focus.
  useEffect(
    () =>
      router.subscribe('onResolved', ({ fromLocation, toLocation }) => {
        if (!fromLocation || fromLocation.pathname === toLocation.pathname) return
        requestAnimationFrame(() => {
          const active = document.activeElement
          if (active && active !== document.body && active.isConnected) return
          document.getElementById('main')?.focus({ preventScroll: true })
        })
      }),
    [router],
  )
  return <Outlet />
}
