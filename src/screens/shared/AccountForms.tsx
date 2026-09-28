import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setLanguage } from '../../i18n'
import { LANGUAGES, isLang } from '../../i18n/languages'
import { passwordProblem } from '../../lib/validate'
import { useSession, useUpdateMe } from '../../queries/session'
import { Button, Saved, Section, SelectField, TextField } from '../../ui/controls'
import { ErrorNote } from '../../ui/feedback'

export function ProfileSection() {
  const { t } = useTranslation()
  const session = useSession()
  const update = useUpdateMe()
  const user = session.data?.user
  const [name, setName] = useState(user?.name ?? '')
  const [lang, setLang] = useState(user?.language ?? 'en')
  return (
    <Section title={t('account.profile')} description={t('account.profileHint')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          update.mutate(
            { name: name.trim(), language: lang },
            { onSuccess: () => (isLang(lang) ? setLanguage(lang) : undefined) },
          )
        }}
      >
        <TextField label={t('fields.email')} value={user?.email ?? ''} disabled readOnly />
        <TextField label={t('fields.yourName')} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        <SelectField label={t('common.language')} hint={t('account.languageHint')} value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </SelectField>
        <ErrorNote error={update.error} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={update.isPending}>
            {t('common.save')}
          </Button>
          <Saved show={update.isSuccess} />
        </div>
      </form>
    </Section>
  )
}

export function PasswordSection() {
  const { t } = useTranslation()
  const update = useUpdateMe()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const problem = passwordProblem(next)
  return (
    <Section title={t('account.password')} description={t('account.passwordHint')}>
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (problem || next !== confirm || !current) return
          update.mutate(
            { current_password: current, new_password: next },
            {
              onSuccess: () => {
                setCurrent('')
                setNext('')
                setConfirm('')
                setTouched(false)
              },
            },
          )
        }}
      >
        <TextField label={t('fields.currentPassword')} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={touched && !current ? t('validate.required') : null} />
        <TextField label={t('fields.newPassword')} hint={t('validate.passwordRule')} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={touched && problem ? t(problem) : null} />
        <TextField label={t('fields.passwordConfirm')} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={touched && confirm !== next ? t('validate.passwordMismatch') : null} />
        <ErrorNote error={update.error} />
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" loading={update.isPending}>
            {t('account.changePassword')}
          </Button>
          <Saved show={update.isSuccess} />
        </div>
      </form>
    </Section>
  )
}
