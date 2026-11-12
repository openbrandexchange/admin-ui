import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useDemoLogin, type DemoInfo } from '../../lib/demo'
import { Button } from '../../ui/controls'
import { ErrorNote } from '../../ui/feedback'
import { PublicCard } from './PublicCard'

type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void }
declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

let script: Promise<Turnstile> | null = null
function loadTurnstile(): Promise<Turnstile> {
  script ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')))
    s.onerror = () => reject(new Error('turnstile'))
    document.head.appendChild(s)
  })
  return script
}

/** One-click sign-in as the demo retailer or the demo brand admin, plus the public API key. */
export function DemoSignIn({ demo }: { demo: DemoInfo }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const login = useDemoLogin()
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const siteKey = demo.turnstile_site_key

  useEffect(() => {
    if (!siteKey || !box.current) return
    let cancelled = false
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !box.current || widget.current) return
        widget.current = ts.render(box.current, {
          sitekey: siteKey,
          language: i18n.language,
          appearance: 'interaction-only',
          callback: (tok: string) => setToken(tok),
          'expired-callback': () => setToken(null),
        })
      })
      .catch(() => setToken(null))
    return () => {
      cancelled = true
    }
  }, [siteKey, i18n.language])

  const go = (as: 'retailer' | 'brand') =>
    login.mutate(
      { as, ...(token ? { turnstile_token: token } : {}) },
      {
        onSuccess: (s) => void navigate({ to: s.user?.role === 'admin' ? '/admin' : '/' }),
        onError: () => {
          setToken(null)
          if (widget.current) window.turnstile?.reset(widget.current)
        },
      },
    )
  const waiting = !!siteKey && !token

  return (
    <PublicCard title={t('demo.title')} intro={t('demo.intro')}>
      <div className="space-y-3">
        <div>
          <Button variant="primary" className="w-full" disabled={waiting} loading={login.isPending && login.variables?.as === 'retailer'} onClick={() => go('retailer')}>
            {t('demo.asRetailer')}
          </Button>
          <p className="mt-1 text-center text-xs text-stone-600">{t('demo.asRetailerHint')}</p>
        </div>
        <div>
          <Button className="w-full" disabled={waiting} loading={login.isPending && login.variables?.as === 'brand'} onClick={() => go('brand')}>
            {t('demo.asBrand')}
          </Button>
          <p className="mt-1 text-center text-xs text-stone-600">{t('demo.asBrandHint')}</p>
        </div>
        {siteKey && <div ref={box} className="flex justify-center" />}
        <ErrorNote error={login.error} />
      </div>
      <details className="text-sm text-stone-700">
        <summary className="cursor-pointer font-medium">{t('demo.api')}</summary>
        <dl className="mt-2 space-y-1 break-all font-mono text-xs">
          <div>
            <dt className="inline text-stone-500">client_id </dt>
            <dd className="inline">{demo.api.client_id}</dd>
          </div>
          <div>
            <dt className="inline text-stone-500">client_secret </dt>
            <dd className="inline">{demo.api.client_secret}</dd>
          </div>
          <div>
            <dt className="inline text-stone-500">token </dt>
            <dd className="inline">{demo.api.token_endpoint}</dd>
          </div>
        </dl>
      </details>
    </PublicCard>
  )
}
