// Demo mode of a node (node-ts OBX_DEMO): the public branding then carries "x-obx-demo". The UI shows
// a banner on every page and one-click sign-in buttons on the login page. Not part of the spec: a
// node without demo mode simply never sends the member.
import { useMutation } from '@tanstack/react-query'
import { ApiError, rawRequest } from '../api/client'
import type { PublicBranding, Session } from '../api/types'
import { useBranding, useSessionSetter } from '../queries/session'

export interface DemoInfo {
  reset_every_minutes: number
  last_reset_at: string | null
  next_reset_at: string | null
  ready: boolean
  turnstile_site_key: string | null
  accounts: ('retailer' | 'brand')[]
  api: { client_id: string; client_secret: string; scopes: string[]; token_endpoint: string; discovery_url: string }
}

export function demoOf(branding: PublicBranding | undefined): DemoInfo | null {
  const d = (branding as (PublicBranding & { 'x-obx-demo'?: DemoInfo }) | undefined)?.['x-obx-demo']
  return d && typeof d === 'object' ? d : null
}

export function useDemo(): DemoInfo | null {
  return demoOf(useBranding().data)
}

/** A refusal by the demo's rules (the node marks those problems with x-obx-demo). */
export function isDemoRefusal(e: unknown): boolean {
  return e instanceof ApiError && !!(e.problem as Record<string, unknown> | null)?.['x-obx-demo'] && e.code === 'forbidden'
}

export function useDemoLogin() {
  const setSession = useSessionSetter()
  return useMutation({
    mutationFn: async (body: { as: 'retailer' | 'brand'; turnstile_token?: string }): Promise<Session> => {
      const res = await rawRequest('POST', '/admin/api/demo/login', { body: JSON.stringify(body), contentType: 'application/json' })
      return (await res.json()) as Session
    },
    onSuccess: setSession,
  })
}
