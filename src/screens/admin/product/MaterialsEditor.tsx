// The composition editor: parts with their fibres, each picked from the spec's vocabularies
// (part, material and qualifier codes). A fibre can have several qualifiers (recycled +
// post-consumer): a row of check chips with a visible legend per fibre. The form writes codes
// only; the node adds the names. Codes outside the vocabularies that the article already has
// stay selectable.
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Materials } from '../../../api/types'
import { extensionsOf } from '../../../lib/localized'
import { normaliseMaterials, unbalancedParts } from '../../../lib/materials'
import { MATERIALS, PARTS, QUALIFIERS } from '../../../lib/vocab'
import { Button, cx } from '../../../ui/controls'
import { useTermLabel, type TermFamily } from '../../shared/ArticleData'

/** `ext`: the extension members (`x-<vendor>-…`) the node returned, written back unchanged. */
export type FibreRow = { material: string; percentage: string; qualifiers: string[]; ext?: Record<string, unknown> }
export type PartRow = { part: string; fibres: FibreRow[]; ext?: Record<string, unknown> }

const emptyFibre = (): FibreRow => ({ material: '', percentage: '', qualifiers: [] })

/** Rows for the editor; an article without a composition starts with one empty main part. */
export function rowsFrom(m: Materials | null | undefined): PartRow[] {
  const list = normaliseMaterials(m)
  if (!list) return [{ part: 'main', fibres: [emptyFibre()] }]
  return list.map((p) => ({
    part: p.part.code,
    ext: extensionsOf(p),
    fibres: p.fibers.map((f) => ({ material: f.material.code, percentage: f.percentage == null ? '' : String(f.percentage), qualifiers: (f.qualifiers ?? []).map((q) => q.code), ext: extensionsOf(f) })),
  }))
}

const isEmpty = (f: FibreRow) => !f.material && !f.percentage.trim() && !f.qualifiers.length
const pctOf = (s: string) => (/^\s*\d+(?:[.,]\d+)?\s*%?\s*$/.test(s) ? Number(s.replace('%', '').replace(',', '.').trim()) : NaN)
/** A percentage is optional (leather on a bag has none); when given it is in (0, 100]. */
const pctOk = (s: string) => !s.trim() || (pctOf(s) > 0 && pctOf(s) <= 100)
const fibreOk = (f: FibreRow) => !!f.material && pctOk(f.percentage)

/** Materials (codes only) from the rows, or not ok when a filled-in row is incomplete. Empty rows are ignored. */
export function materialsFrom(rows: PartRow[]): { ok: true; value: Materials | null } | { ok: false } {
  const out: Materials = []
  for (const p of rows) {
    const fibres = p.fibres.filter((f) => !isEmpty(f))
    if (fibres.some((f) => !fibreOk(f))) return { ok: false }
    if (!fibres.length) continue
    out.push({
      ...p.ext,
      part: { code: p.part },
      fibers: fibres.map((f) => ({ ...f.ext, material: { code: f.material }, percentage: f.percentage.trim() ? pctOf(f.percentage) : null, qualifiers: [...new Set(f.qualifiers)].map((code) => ({ code })) })),
    })
  }
  return { ok: true, value: out.length ? out : null }
}

const capitalise = (s: string, lang: string) => s.charAt(0).toLocaleUpperCase(lang) + s.slice(1)

type Props = { rows: PartRow[]; onChange: (rows: PartRow[]) => void; showErrors: boolean; error?: string }

export function MaterialsEditor({ rows, onChange, showErrors, error }: Props) {
  const { t, i18n } = useTranslation()
  const term = useTermLabel()
  const id = useId()
  // After adding or removing a row the clicked button is gone or far away: move focus to
  // where the work continues (the new row, or the row before the removed one).
  const focusNext = useRef<string | null>(null)
  useEffect(() => {
    if (!focusNext.current) return
    document.getElementById(focusNext.current)?.focus()
    focusNext.current = null
  }, [rows])
  const setFocusNext = (elementId: string) => {
    focusNext.current = elementId
  }
  const lang = i18n.language
  const parsed = materialsFrom(rows)
  const unbalanced = parsed.ok ? unbalancedParts(parsed.value) : []
  const set = (pi: number, part: PartRow) => onChange(rows.map((p, i) => (i === pi ? part : p)))
  const setFibre = (pi: number, fi: number, f: Partial<FibreRow>) => set(pi, { ...rows[pi], fibres: rows[pi].fibres.map((x, i) => (i === fi ? { ...x, ...f } : x)) })

  /** Vocabulary codes sorted by their label, plus a code outside it that is in use. */
  const options = (family: TermFamily, codes: readonly string[], current: string) => {
    const list = [...codes, ...(current && !codes.includes(current) ? [current] : [])]
    return list.map((code) => ({ code, label: capitalise(term(family, { code }), lang) })).sort((a, b) => a.label.localeCompare(b.label, lang))
  }
  const partLabel = (code: string) => term('part', { code })
  const hintId = `${id}-hint`
  const errId = `${id}-err`
  const label = 'block text-xs text-stone-500'

  return (
    <fieldset className="space-y-3" aria-describedby={[hintId, error && errId].filter(Boolean).join(' ')}>
      <legend className="text-sm font-medium text-stone-800">{t('fields.materials')}</legend>
      <p id={hintId} className="text-xs text-stone-500">
        {unbalanced.length ? t('product.materialsNot100', { parts: unbalanced.map(partLabel).join(', ') }) : t('product.materialsEditorHint')}
      </p>
      {rows.map((p, pi) => (
        <div key={pi} role="group" aria-label={partLabel(p.part)} className="space-y-2 rounded-lg border border-stone-200 bg-white p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1 space-y-1">
              <label htmlFor={`${id}-p${pi}`} className={label}>
                {t('product.materialPart')}
              </label>
              <select id={`${id}-p${pi}`} className="input" value={p.part} onChange={(e) => set(pi, { ...p, part: e.target.value })}>
                {/* `main` first: an article with one composition. */}
                <option value="main">{partLabel('main')}</option>
                {options('part', PARTS.filter((k) => k !== 'main'), p.part === 'main' ? '' : p.part).map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {rows.length > 1 && (
              <Button size="sm" variant="ghost" onClick={() => {
                  onChange(rows.filter((_, i) => i !== pi))
                  setFocusNext(`${id}-p${Math.max(0, pi - 1)}`)
                }}>
                {t('product.removePart')}
              </Button>
            )}
          </div>
          {p.fibres.map((f, fi) => {
            const bad = showErrors && !isEmpty(f) && !fibreOk(f)
            const base = `${id}-p${pi}-f${fi}`
            const qualifiers = [...QUALIFIERS, ...f.qualifiers.filter((c) => !(QUALIFIERS as readonly string[]).includes(c))]
            const toggle = (code: string, on: boolean) => setFibre(pi, fi, { qualifiers: on ? [...f.qualifiers.filter((c) => c !== code), code] : f.qualifiers.filter((c) => c !== code) })
            return (
              <div key={fi} className="space-y-2 border-t border-stone-100 pt-2 first-of-type:border-t-0 first-of-type:pt-0">
                <div className="grid grid-cols-[5.5rem_1fr] items-end gap-2 sm:grid-cols-[5.5rem_1fr_auto]">
                  <div className="space-y-1">
                    <label htmlFor={`${base}-pct`} className={label}>
                      {t('product.materialPercentage')}
                    </label>
                    <input
                      id={`${base}-pct`}
                      className="input tabular"
                      inputMode="decimal"
                      value={f.percentage}
                      onChange={(e) => setFibre(pi, fi, { percentage: e.target.value })}
                      aria-invalid={bad && !pctOk(f.percentage) ? true : undefined}
                      aria-describedby={bad ? errId : undefined}
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <label htmlFor={`${base}-mat`} className={label}>
                      {t('product.materialName')}
                    </label>
                    <select
                      id={`${base}-mat`}
                      className="input"
                      value={f.material}
                      onChange={(e) => setFibre(pi, fi, { material: e.target.value })}
                      aria-invalid={bad && !f.material ? true : undefined}
                      aria-describedby={bad ? errId : undefined}
                    >
                      <option value="">—</option>
                      {options('fibre', MATERIALS, f.material).map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {p.fibres.length > 1 && (
                    <Button size="md" variant="ghost" className="max-sm:hidden" onClick={() => {
                        set(pi, { ...p, fibres: p.fibres.filter((_, i) => i !== fi) })
                        setFocusNext(`${id}-p${pi}-f${Math.max(0, fi - 1)}-pct`)
                      }}>
                      {t('product.removeFibre')}
                    </Button>
                  )}
                </div>
                <fieldset>
                  <legend className={label}>
                    {t('product.materialQualifier')}
                    {f.material && <span className="sr-only">: {f.percentage.trim() ? `${f.percentage.trim().replace(/%$/, '')}% ` : ''}{term('fibre', { code: f.material })}</span>}
                    <span className="text-stone-500"> · {t('product.materialQualifierHint')}</span>
                  </legend>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {qualifiers.map((code) => {
                      const on = f.qualifiers.includes(code)
                      return (
                        <label
                          key={code}
                          className={cx(
                            'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm select-none',
                            on ? 'border-accent bg-accent-soft font-medium text-stone-900' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50',
                          )}
                        >
                          <input type="checkbox" className="size-4 shrink-0 accent-accent" checked={on} onChange={(e) => toggle(code, e.target.checked)} />
                          {capitalise(term('qualifier', { code }), lang)}
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
                {/* On a phone the row ends with the remove button, below the claims. */}
                  {p.fibres.length > 1 && (
                    <Button size="sm" variant="ghost" className="-ml-2.5 sm:hidden" onClick={() => {
                        set(pi, { ...p, fibres: p.fibres.filter((_, i) => i !== fi) })
                        setFocusNext(`${id}-p${pi}-f${Math.max(0, fi - 1)}-pct`)
                      }}>
                      {t('product.removeFibre')}
                    </Button>
                  )}
              </div>
            )
          })}
          <Button
            size="sm"
            onClick={() => {
              set(pi, { ...p, fibres: [...p.fibres, emptyFibre()] })
              setFocusNext(`${id}-p${pi}-f${p.fibres.length}-pct`)
            }}
          >
            {t('product.addFibre')}
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        onClick={() => {
          onChange([...rows, { part: rows.some((r) => r.part === 'main') ? 'lining' : 'main', fibres: [emptyFibre()] }])
          setFocusNext(`${id}-p${rows.length}`)
        }}
      >
        {t('product.addPart')}
      </Button>
      {(error || (showErrors && !parsed.ok)) && (
        <p id={errId} className="text-xs font-medium text-red-700">
          {error || t('product.materialsRowInvalid')}
        </p>
      )}
    </fieldset>
  )
}
