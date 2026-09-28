// Small, accessible building blocks. Labels above inputs, errors inline, >=40px hit targets.
import { useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { IconCheck, IconCopy } from './icons'
import { useState } from 'react'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:bg-accent-strong shadow-xs',
  secondary: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 shadow-xs',
  ghost: 'text-stone-700 hover:bg-stone-100',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
}

export function buttonClass(variant: Variant = 'secondary', size: 'sm' | 'md' = 'md') {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors select-none',
    'disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
    size === 'sm' ? 'h-8 px-2.5 text-sm' : 'h-10 px-4 text-sm',
    VARIANTS[variant],
  )
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button type={type} className={cx(buttonClass(variant, size), className)} disabled={rest.disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <Spinner size={14} />}
      {children}
    </button>
  )
}

export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <svg className="animate-spin text-current" width={size} height={size} viewBox="0 0 24 24" role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Loading() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-2 py-10 justify-center text-stone-500">
      <Spinner label={t('common.loading')} />
      <span>{t('common.loading')}</span>
    </div>
  )
}

type FieldRender = (p: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: FieldRender; className?: string }) {
  const id = useId()
  const hintId = hint ? id + '-hint' : undefined
  const errId = error ? id + '-err' : undefined
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-stone-800">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined })}
      {hint && (
        <p id={hintId} className="text-xs text-stone-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextField({ label, hint, error, className, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => <input className="input" {...p} {...input} />}
    </Field>
  )
}

export function TextArea({ label, hint, error, className, ...input }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => <textarea className="input min-h-24" {...p} {...input} />}
    </Field>
  )
}

export function SelectField({ label, hint, error, className, children, ...input }: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; hint?: ReactNode; error?: string | null }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(p) => (
        <select className="input" {...p} {...input}>
          {children}
        </select>
      )}
    </Field>
  )
}

export function Checkbox({ label, hint, className, ...input }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId()
  return (
    <div className={cx('flex items-start gap-3', className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-4.5 rounded border-stone-300 accent-accent" {...input} />
      <label htmlFor={id} className="text-sm leading-tight">
        <span className="font-medium text-stone-800">{label}</span>
        {hint && <span className="block text-xs text-stone-500 mt-0.5">{hint}</span>}
      </label>
    </div>
  )
}

/** On/off setting (role=switch). */
export function Switch({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <span id={id} className="block text-sm font-medium text-stone-800">
          {label}
        </span>
        {hint && <span className="block text-xs text-stone-500 mt-0.5">{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50', checked ? 'bg-accent' : 'bg-stone-300')}
      >
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5.5' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

/** 2–4 exclusive options. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-control border border-stone-300 bg-white p-0.5 shadow-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('h-8 rounded-md px-3 text-sm font-medium', value === o.value ? 'bg-accent text-accent-contrast' : 'text-stone-700 hover:bg-stone-100')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

type Tone = 'neutral' | 'green' | 'amber' | 'red' | 'blue' | 'accent'
const TONES: Record<Tone, string> = {
  neutral: 'bg-stone-100 text-stone-700',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  accent: 'bg-accent-soft text-accent-strong',
}

export function Badge({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent', TONES[tone])}>
      {children}
    </span>
  )
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          /* clipboard blocked: the value stays selectable */
        }
      }}
    >
      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {copied ? t('common.copied') : (label ?? t('common.copy'))}
    </Button>
  )
}

/** A secret shown exactly once, with copy button and a clear warning. */
export function SecretOnce({ label, value, children }: { label: ReactNode; value: string; children?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2" role="region" aria-label={typeof label === 'string' ? label : undefined}>
      <p className="text-sm font-semibold text-amber-900">{label}</p>
      <div className="flex gap-2 items-center">
        <input readOnly value={value} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} aria-label={typeof label === 'string' ? label : t('common.secret')} />
        <CopyButton value={value} />
      </div>
      <p className="text-xs text-amber-900">{t('common.shownOnce')}</p>
      {children}
    </div>
  )
}

export function EmptyState({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center">
      <p className="font-medium text-stone-800">{title}</p>
      {children && <div className="mt-1 text-sm text-stone-500 max-w-prose mx-auto">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 space-y-2">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-stone-600 max-w-prose">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function Section({ title, description, children, actions }: { title: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card min-w-0 p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-stone-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-600 max-w-prose">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

/** Inline success confirmation next to a save button (no toasts for success). */
export function Saved({ show }: { show: boolean }) {
  const { t } = useTranslation()
  return (
    <span role="status" className={cx('inline-flex items-center gap-1 text-sm text-emerald-700 transition-opacity', show ? 'opacity-100' : 'opacity-0')}>
      {show && (
        <>
          <IconCheck size={16} /> {t('common.saved')}
        </>
      )}
    </span>
  )
}
