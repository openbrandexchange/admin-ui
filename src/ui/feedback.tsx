import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ApiError } from '../api/client'
import { isDemoRefusal } from '../lib/demo'
import { Button, Spinner, cx } from './controls'

export { EmptyState } from './controls'
import { IconX } from './icons'

/** Human message for any error: our translation of the obx_error, else the node's detail. */
export function errorMessage(t: TFunction, e: unknown): string {
  if (isDemoRefusal(e)) return t('demo.refused')
  if (e instanceof ApiError) {
    const key = `errors.${e.code}`
    const translated = t(key, { defaultValue: '' })
    if (translated) return translated
    if (e.problem?.detail) return e.problem.detail
    return t('errors.generic')
  }
  return t('errors.generic')
}

/** Inline error (never a success toast). `onRetry` adds a "Try again" button, for failed loads. */
export function ErrorNote({ error, className, onRetry }: { error: unknown; className?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  if (!error) return null
  const fields = error instanceof ApiError ? error.problem?.errors ?? [] : []
  // A refused request (404, 403 …) fails the same way again; only offer a retry when it can help.
  const retryable = !(error instanceof ApiError) || error.status >= 500 || error.status === 408 || error.status === 429 || error.status === 0
  return (
    <div role="alert" className={cx('rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>{errorMessage(t, error)}</p>
        {onRetry && retryable && (
          <Button size="sm" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )}
      </div>
      {fields.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {fields.slice(0, 8).map((f, i) => (
            <li key={i}>
              {f.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode }) {
  const cls = { info: 'border-sky-200 bg-sky-50 text-sky-900', warn: 'border-amber-200 bg-amber-50 text-amber-900', ok: 'border-emerald-200 bg-emerald-50 text-emerald-900' }[tone]
  return <div className={cx('rounded-lg border px-3 py-2 text-sm', cls)}>{children}</div>
}

/** Modal dialog on the native <dialog> element (focus trap, Esc, inert background for free). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  size,
  hideTitle,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** `xl`: a large two-column dialog (quick view); `sheet`: slides up from the bottom on a phone, from the side on a wide screen. */
  size?: 'md' | 'wide' | 'xl' | 'sheet'
  /** Title only for screen readers (the content shows its own heading). */
  hideTitle?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const { t } = useTranslation()
  const kind = size ?? (wide ? 'wide' : 'md')
  useEffect(() => {
    const d = ref.current
    if (!d || !open) return
    // Give focus back to whatever opened the dialog (the dialog unmounts, so the browser can't).
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [open])
  if (!open) return null
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-labelledby={titleId}
      className={cx(
        'bg-white p-0 shadow-xl backdrop:bg-stone-900/40',
        kind === 'sheet'
          ? 'mt-auto mb-0 max-h-[88dvh] w-full max-w-none rounded-t-2xl sm:mr-0 sm:ml-auto sm:h-dvh sm:max-h-none sm:w-96 sm:rounded-none sm:rounded-l-2xl'
          : cx('m-auto w-[calc(100%-2rem)] rounded-2xl', kind === 'xl' ? 'max-w-5xl' : kind === 'wide' ? 'max-w-3xl' : 'max-w-lg'),
      )}
    >
      <div className={cx('flex items-start justify-between gap-4 px-5', hideTitle ? 'absolute end-0 top-0 z-10 py-3' : 'border-b border-stone-100 py-4')}>
        <h2 id={titleId} className={hideTitle ? 'sr-only' : 'text-lg font-semibold'}>
          {title}
        </h2>
        <button type="button" onClick={onClose} className={cx('grid size-10 place-items-center rounded-full text-stone-600 hover:bg-stone-100', hideTitle && 'bg-white/90 shadow-sm')} aria-label={t('common.close')}>
          <IconX />
        </button>
      </div>
      <div className={cx('overflow-y-auto space-y-4', kind === 'xl' ? 'max-h-[86dvh] p-0' : kind === 'sheet' ? 'max-h-[calc(88dvh-8rem)] px-5 py-4 sm:max-h-[calc(100dvh-9rem)]' : 'max-h-[70dvh] px-5 py-4')}>{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 px-5 py-3">{footer}</div>}
    </dialog>
  )
}

/** Button that asks for confirmation in a dialog before running a (destructive) action. */
export function ConfirmButton({
  label,
  title,
  body,
  confirmLabel,
  onConfirm,
  variant = 'danger',
  size = 'md',
  children,
}: {
  label: ReactNode
  title: ReactNode
  body: ReactNode
  confirmLabel: ReactNode
  /** Resolve to close the dialog; throw to keep it open and show the error. */
  onConfirm: () => Promise<unknown> | void
  variant?: 'danger' | 'secondary' | 'primary'
  size?: 'sm' | 'md'
  /** Extra content inside the dialog (e.g. a reason field). */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  return (
    <>
      <Button variant={variant} size={size} onClick={() => (setError(null), setOpen(true))}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              loading={pending}
              onClick={async () => {
                setPending(true)
                setError(null)
                try {
                  await onConfirm()
                  setOpen(false)
                } catch (e) {
                  setError(e)
                } finally {
                  setPending(false)
                }
              }}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="text-sm text-stone-700">{body}</div>
        {children}
        <ErrorNote error={error} />
      </Dialog>
    </>
  )
}

/** "Load more" for infinite queries; also loads when scrolled into view. */
export function LoadMore({ hasNext, fetching, onMore }: { hasNext: boolean; fetching: boolean; onMore: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !hasNext || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && !fetching && onMore(), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasNext, fetching, onMore])
  if (!hasNext) return null
  return (
    <div ref={ref} className="flex justify-center py-6">
      <Button onClick={onMore} disabled={fetching}>
        {fetching ? <Spinner size={14} /> : null}
        {t('common.loadMore')}
      </Button>
    </div>
  )
}

/**
 * Arrow-key movement between the tabs of a role="tablist" (WAI-ARIA tabs pattern), set as
 * onKeyDown on every tab. Each tab stays reachable with Tab too; this adds the arrow keys,
 * Home and End.
 */
export function tabListKeys(e: KeyboardEvent<HTMLElement>) {
  const list = e.currentTarget.closest('[role="tablist"]')
  if (!list) return
  const tabs = [...list.querySelectorAll<HTMLElement>('[role="tab"]')]
  const i = tabs.indexOf(e.currentTarget)
  const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key]
  if (i < 0 || next === undefined) return
  e.preventDefault()
  tabs[(next + tabs.length) % tabs.length].focus()
}
