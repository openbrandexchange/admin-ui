import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ApiError } from '../api/client'
import { Button, Spinner, cx } from './controls'

export { EmptyState } from './controls'
import { IconX } from './icons'

/** Human message for any error: our translation of the obx_error, else the node's detail. */
export function errorMessage(t: TFunction, e: unknown): string {
  if (e instanceof ApiError) {
    const key = `errors.${e.code}`
    const translated = t(key, { defaultValue: '' })
    if (translated) return translated
    if (e.problem?.detail) return e.problem.detail
    return t('errors.generic')
  }
  return t('errors.generic')
}

export function ErrorNote({ error, className }: { error: unknown; className?: string }) {
  const { t } = useTranslation()
  if (!error) return null
  const fields = error instanceof ApiError ? error.problem?.errors ?? [] : []
  return (
    <div role="alert" className={cx('rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800', className)}>
      <p>{errorMessage(t, error)}</p>
      {fields.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {fields.slice(0, 8).map((f, i) => (
            <li key={i}>
              {f.pointer && <code className="mr-1">{f.pointer}</code>}
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
export function Dialog({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const { t } = useTranslation()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
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
      aria-labelledby="dialog-title"
      className={cx('m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 shadow-xl backdrop:bg-stone-900/40', wide ? 'max-w-3xl' : 'max-w-lg')}
    >
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 px-5 py-4">
        <h2 id="dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-stone-500 hover:bg-stone-100" aria-label={t('common.close')}>
          <IconX />
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto px-5 py-4 space-y-4">{children}</div>
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
