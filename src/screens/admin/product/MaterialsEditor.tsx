// The composition editor: parts with their fibres, each picked from the spec's vocabularies
// (part, material and qualifier codes). The form writes codes only; the node adds the names.
// Codes outside the vocabularies that the article already has stay selectable.
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Materials } from '../../../api/types'
import { normaliseMaterials, unbalancedParts } from '../../../lib/materials'
import { MATERIALS, PARTS, QUALIFIERS } from '../../../lib/vocab'
import { Button, cx } from '../../../ui/controls'
import { useTermLabel, type TermFamily } from '../../shared/ArticleData'

export type FibreRow = { material: string; percentage: string; qualifier: string }
export type PartRow = { part: string; fibres: FibreRow[] }

const emptyFibre = (): FibreRow => ({ material: '', percentage: '', qualifier: '' })

/** Rows for the editor; an article without a composition starts with one empty main part. */
export function rowsFrom(m: Materials | null | undefined): PartRow[] {
  const list = normaliseMaterials(m)
  if (!list) return [{ part: 'main', fibres: [emptyFibre()] }]
  return list.map((p) => ({
    part: p.part.code,
    fibres: p.fibers.map((f) => ({ material: f.material.code, percentage: String(f.percentage), qualifier: f.qualifier?.code ?? '' })),
  }))
}

const isEmpty = (f: FibreRow) => !f.material && !f.percentage.trim() && !f.qualifier
const pctOf = (s: string) => (/^\s*\d+(?:[.,]\d+)?\s*%?\s*$/.test(s) ? Number(s.replace('%', '').replace(',', '.').trim()) : NaN)
const fibreOk = (f: FibreRow) => {
  const n = pctOf(f.percentage)
  return !!f.material && n > 0 && n <= 100
}

/** Materials (codes only) from the rows, or not ok when a filled-in row is incomplete. Empty rows are ignored. */
export function materialsFrom(rows: PartRow[]): { ok: true; value: Materials | null } | { ok: false } {
  const out: Materials = []
  for (const p of rows) {
    const fibres = p.fibres.filter((f) => !isEmpty(f))
    if (fibres.some((f) => !fibreOk(f))) return { ok: false }
    if (!fibres.length) continue
    out.push({ part: { code: p.part }, fibers: fibres.map((f) => ({ material: { code: f.material }, percentage: pctOf(f.percentage), qualifier: f.qualifier ? { code: f.qualifier } : null })) })
  }
  return { ok: true, value: out.length ? out : null }
}

type Props = { rows: PartRow[]; onChange: (rows: PartRow[]) => void; showErrors: boolean; error?: string }

export function MaterialsEditor({ rows, onChange, showErrors, error }: Props) {
  const { t, i18n } = useTranslation()
  const term = useTermLabel()
  const id = useId()
  const lang = i18n.language
  const parsed = materialsFrom(rows)
  const unbalanced = parsed.ok ? unbalancedParts(parsed.value) : []
  const set = (pi: number, part: PartRow) => onChange(rows.map((p, i) => (i === pi ? part : p)))
  const setFibre = (pi: number, fi: number, f: Partial<FibreRow>) => set(pi, { ...rows[pi], fibres: rows[pi].fibres.map((x, i) => (i === fi ? { ...x, ...f } : x)) })

  /** Vocabulary codes sorted by their label, plus a code outside it that is in use. */
  const options = (family: TermFamily, codes: readonly string[], current: string) => {
    const list = [...codes, ...(current && !codes.includes(current) ? [current] : [])]
    return list.map((code) => ({ code, label: term(family, { code }) })).sort((a, b) => a.label.localeCompare(b.label, lang))
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
              <Button size="sm" variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== pi))}>
                {t('product.removePart')}
              </Button>
            )}
          </div>
          {p.fibres.map((f, fi) => {
            const bad = showErrors && !isEmpty(f) && !fibreOk(f)
            const base = `${id}-p${pi}-f${fi}`
            return (
              <div key={fi} className="grid grid-cols-[5.5rem_1fr] items-end gap-2 sm:grid-cols-[5.5rem_1fr_11rem_auto]">
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
                    aria-invalid={bad && !(pctOf(f.percentage) > 0 && pctOf(f.percentage) <= 100) ? true : undefined}
                    aria-describedby={bad ? errId : undefined}
                  />
                </div>
                <div className="space-y-1">
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
                <div className="space-y-1">
                  <label htmlFor={`${base}-q`} className={label}>
                    {t('product.materialQualifier')}
                  </label>
                  <select id={`${base}-q`} className="input" value={f.qualifier} onChange={(e) => setFibre(pi, fi, { qualifier: e.target.value })}>
                    <option value="">—</option>
                    {[...QUALIFIERS, ...(f.qualifier && !(QUALIFIERS as readonly string[]).includes(f.qualifier) ? [f.qualifier] : [])].map((code) => (
                      <option key={code} value={code}>
                        {term('qualifier', { code })}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  size="md"
                  variant="ghost"
                  className={cx(p.fibres.length < 2 && 'invisible max-sm:hidden')}
                  disabled={p.fibres.length < 2}
                  onClick={() => set(pi, { ...p, fibres: p.fibres.filter((_, i) => i !== fi) })}
                >
                  {t('product.removeFibre')}
                </Button>
              </div>
            )
          })}
          <Button size="sm" onClick={() => set(pi, { ...p, fibres: [...p.fibres, emptyFibre()] })}>
            {t('product.addFibre')}
          </Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange([...rows, { part: rows.some((r) => r.part === 'main') ? 'lining' : 'main', fibres: [emptyFibre()] }])}>
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
