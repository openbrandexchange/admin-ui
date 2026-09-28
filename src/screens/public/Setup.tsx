import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { api, req, ApiError } from '../../api/client'
import type { SetupInput } from '../../api/types'
import { DEFAULT_ACCENT, applyAccent } from '../../lib/accent'
import { emailProblem, hexProblem, passwordProblem, urlProblem, withScheme } from '../../lib/validate'
import { LANGUAGES, isLang } from '../../i18n/languages'
import { useSessionSetter } from '../../queries/session'
import { Button, Checkbox, Field, SelectField, TextField, cx } from '../../ui/controls'
import { ErrorNote } from '../../ui/feedback'
import { PublicCard } from './PublicCard'

type Step = 0 | 1 | 2 | 3

/** An installer may hand over the setup code in the address fragment (#code=…), which never reaches the server. */
function codeFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('code')?.trim() ?? ''
}

/** First-run wizard: setup code → company → languages & look → admin account. Never a default password. */
export function SetupScreen() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setSession = useSessionSetter()
  const uiLang = isLang(i18n.language) ? i18n.language : 'en'
  const [step, setStep] = useState<Step>(0)
  const [touched, setTouched] = useState(false)
  const hash = useLocation({ select: (l) => l.hash })
  const [code, setCode] = useState(() => codeFromHash(hash))
  const [company, setCompany] = useState({ name: '', first_brand_name: '', website: '', contact_email: '' })
  const [defaultLang, setDefaultLang] = useState<string>(uiLang)
  const [languages, setLanguages] = useState<string[]>(uiLang === 'en' ? ['en'] : [uiLang, 'en'])
  const [accent, setAccent] = useState(DEFAULT_ACCENT)
  const [admin, setAdmin] = useState({ name: '', email: '', password: '', confirm: '' })

  const submit = useMutation({
    mutationFn: () => {
      const langs = [defaultLang, ...languages.filter((l) => l !== defaultLang)]
      const body: SetupInput = {
        setup_code: code.trim(),
        company: {
          name: company.name.trim(),
          default_language: defaultLang,
          languages: langs,
          accent_color: accent,
          ...(company.first_brand_name.trim() && { first_brand_name: company.first_brand_name.trim() }),
          ...(company.website.trim() && { website: withScheme(company.website) }),
          ...(company.contact_email.trim() && { contact_email: company.contact_email.trim() }),
        },
        admin: { name: admin.name.trim(), email: admin.email.trim(), password: admin.password },
      }
      return req(() => api.POST('/admin/api/setup', { body }))
    },
    onSuccess: (s) => {
      setSession(s)
      void navigate({ to: '/admin' })
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.code === 'forbidden' || e.fieldErrors()['/setup_code'])) setStep(0)
    },
  })

  const server = submit.error instanceof ApiError ? submit.error.fieldErrors() : {}
  const codeErr = (touched && code.trim().length < 6 ? t('setup.codeShort') : null) ?? (submit.error instanceof ApiError && submit.error.code === 'forbidden' ? t('setup.codeWrong') : server['/setup_code'])
  const nameErr = touched && !company.name.trim() ? t('validate.required') : server['/company/name']
  const siteErr = touched && company.website.trim() && urlProblem(withScheme(company.website)) ? t('validate.url') : null
  const contactErr = touched && company.contact_email.trim() && emailProblem(company.contact_email) ? t('validate.email') : null
  const hexErr = touched && hexProblem(accent) ? t('validate.hex') : null
  const adminNameErr = touched && !admin.name.trim() ? t('validate.required') : null
  const adminEmailErr = (touched && emailProblem(admin.email) ? t('validate.email') : null) ?? server['/admin/email']
  const pwKey = passwordProblem(admin.password)
  const pwErr = (touched && pwKey ? t(pwKey) : null) ?? server['/admin/password']
  const confirmErr = touched && admin.confirm !== admin.password ? t('validate.passwordMismatch') : null

  const next = (valid: boolean) => {
    setTouched(true)
    if (!valid) return
    setTouched(false)
    setStep((s) => (s + 1) as Step)
  }
  const steps = [t('setup.stepCode'), t('setup.stepCompany'), t('setup.stepLook'), t('setup.stepAdmin')]

  return (
    <PublicCard title={t('setup.title')} intro={t('setup.intro')}>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label={t('setup.progress')}>
        {steps.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className={cx('flex items-center gap-1.5', i === step ? 'font-semibold text-stone-900' : 'text-stone-500')}>
            <span className={cx('grid size-5 place-items-center rounded-full text-[11px]', i <= step ? 'bg-accent text-accent-contrast' : 'bg-stone-200')}>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (step === 0) next(code.trim().length >= 6)
          else if (step === 1) next(!!company.name.trim() && !siteErrNow(company.website) && !(company.contact_email.trim() && emailProblem(company.contact_email)))
          else if (step === 2) next(!hexProblem(accent) && languages.length > 0)
          else {
            setTouched(true)
            if (admin.name.trim() && !emailProblem(admin.email) && !pwKey && admin.confirm === admin.password) submit.mutate()
          }
        }}
      >
        {step === 0 && (
          <TextField
            label={t('setup.code')}
            hint={t('setup.codeHint')}
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              // A new code clears the refusal of the old one, so it does not follow the user to the next steps.
              if (submit.isError) submit.reset()
            }}
            error={codeErr}
            autoComplete="one-time-code"
            autoFocus
            spellCheck={false}
            className="[&_input]:font-mono"
          />
        )}

        {step === 1 && (
          <>
            <TextField label={t('setup.companyName')} hint={t('setup.companyNameHint')} value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} error={nameErr} autoFocus autoComplete="organization" />
            <TextField label={t('setup.firstBrand')} hint={t('setup.firstBrandHint')} value={company.first_brand_name} onChange={(e) => setCompany({ ...company, first_brand_name: e.target.value })} placeholder={company.name} />
            <TextField label={t('setup.website')} type="url" value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} onBlur={() => setCompany({ ...company, website: withScheme(company.website) })} error={siteErr} placeholder="https://" />
            <TextField label={t('setup.contactEmail')} hint={t('setup.contactEmailHint')} type="email" value={company.contact_email} onChange={(e) => setCompany({ ...company, contact_email: e.target.value })} error={contactErr} />
          </>
        )}

        {step === 2 && (
          <>
            <SelectField label={t('setup.defaultLanguage')} hint={t('setup.defaultLanguageHint')} value={defaultLang} onChange={(e) => { setDefaultLang(e.target.value); if (!languages.includes(e.target.value)) setLanguages([...languages, e.target.value]) }}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </SelectField>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-stone-800">{t('setup.contentLanguages')}</legend>
              <p className="text-xs text-stone-500">{t('setup.contentLanguagesHint')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LANGUAGES.map((l) => (
                  <Checkbox
                    key={l.code}
                    label={l.name}
                    checked={languages.includes(l.code)}
                    disabled={l.code === defaultLang}
                    onChange={(e) => setLanguages(e.target.checked ? [...languages, l.code] : languages.filter((x) => x !== l.code))}
                  />
                ))}
              </div>
            </fieldset>
            <Field label={t('setup.accent')} hint={t('setup.accentHint')} error={hexErr}>
              {(p) => (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => {
                      setAccent(e.target.value)
                      applyAccent(e.target.value)
                    }}
                    className="h-10 w-14 cursor-pointer rounded-control border border-stone-300 bg-white p-1"
                    aria-label={t('setup.accent')}
                  />
                  <input {...p} className="input w-32 font-mono" value={accent} onChange={(e) => { setAccent(e.target.value); if (!hexProblem(e.target.value)) applyAccent(e.target.value) }} />
                  <span className="rounded-control bg-accent px-3 py-2 text-sm font-medium text-accent-contrast">{t('setup.accentPreview')}</span>
                </div>
              )}
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <TextField label={t('fields.yourName')} value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} error={adminNameErr} autoComplete="name" autoFocus />
            <TextField label={t('fields.email')} type="email" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} error={adminEmailErr} autoComplete="email" />
            <TextField label={t('fields.password')} hint={t('validate.passwordRule')} type="password" value={admin.password} onChange={(e) => setAdmin({ ...admin, password: e.target.value })} error={pwErr} autoComplete="new-password" />
            <TextField label={t('fields.passwordConfirm')} type="password" value={admin.confirm} onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })} error={confirmErr} autoComplete="new-password" />
          </>
        )}

        {submit.error && !(step === 0 && codeErr) && <ErrorNote error={submit.error} />}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 0 ? (
            <Button onClick={() => setStep((s) => (s - 1) as Step)}>{t('common.back')}</Button>
          ) : (
            <span />
          )}
          <Button type="submit" variant="primary" loading={submit.isPending}>
            {step < 3 ? t('common.next') : t('setup.finish')}
          </Button>
        </div>
      </form>
    </PublicCard>
  )
}

const siteErrNow = (v: string) => !!v.trim() && !!urlProblem(withScheme(v))
