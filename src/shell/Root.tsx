import { Outlet } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { installCsrfRefresh } from '../queries/session'

export function Root() {
  const qc = useQueryClient()
  useEffect(() => installCsrfRefresh(qc), [qc])
  return <Outlet />
}
