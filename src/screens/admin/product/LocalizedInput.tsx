import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { languageName } from '../../../lib/format'
import { settingsQuery } from '../../../queries/admin'
import { Field } from '../../../ui/controls'

/** The brand's content languages (Settings → portal languages), default language first. */
export function useContentLanguages(): string[] {
  const settings = useQuery(settingsQuery)
  const langs = settings.data?.portal?.languages ?? ['en']
  const def = settings.data?.portal?.default_language
  return def ? [def, ...langs.filter((l) => l !== def)] : langs
}

/** One input per content language, stacked ("Name · Nederlands"). */
export function LocalizedInput({
  label,
  value,
  onChange,
  multiline,
  error,
  requiredFirst,
}: {
  label: string
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
  multiline?: boolean
  error?: string | null
  requiredFirst?: boolean
}) {
  const { i18n } = useTranslation()
  const langs = useContentLanguages()
  // Show any extra language already present in the data too.
  const all = [...langs, ...Object.keys(value).filter((k) => !langs.includes(k))]
  return (
    <div className="space-y-3">
      {all.map((lang, i) => (
        <Field
          key={lang}
          label={
            <>
              {label} <span className="font-normal text-stone-500">· {languageName(lang, i18n.language)}</span>
              {requiredFirst && i === 0 && <span className="text-red-700"> *</span>}
            </>
          }
          error={i === 0 ? error : null}
        >
          {(p) =>
            multiline ? (
              <textarea {...p} lang={lang} className="input min-h-24" value={value[lang] ?? ''} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} />
            ) : (
              <input {...p} lang={lang} className="input" value={value[lang] ?? ''} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} />
            )
          }
        </Field>
      ))}
    </div>
  )
}
