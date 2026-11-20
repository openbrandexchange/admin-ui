import { useTranslation } from 'react-i18next'
import type { BrandingLogin } from '../../../api/appearance'
import { Section } from '../../../ui/controls'
import { Choice, ImagePicker, LangTabs, TextInput } from './fields'

export function LoginEditor({ login, onChange, langs, lang, setLang }: { login: BrandingLogin; onChange: (fn: (l: BrandingLogin) => BrandingLogin) => void; langs: string[]; lang: string; setLang: (l: string) => void }) {
  const { t } = useTranslation()
  const set = <K extends keyof BrandingLogin>(k: K, v: BrandingLogin[K]) => onChange((x) => ({ ...x, [k]: v }))
  return (
    <div className="space-y-6">
      <Section title={t('appearance.login.layoutTitle')} description={t('appearance.login.layoutHint')}>
        <Choice
          label={t('appearance.login.layout')}
          columns={2}
          value={login.layout ?? 'centered'}
          onChange={(v) => set('layout', v)}
          options={[
            {
              value: 'centered',
              label: t('appearance.login.centered'),
              sample: (
                <span className="grid h-10 w-16 place-items-center rounded bg-stone-300" aria-hidden="true">
                  <span className="h-6 w-6 rounded-sm bg-white" />
                </span>
              ),
            },
            {
              value: 'split',
              label: t('appearance.login.split'),
              sample: (
                <span className="grid h-10 w-16 grid-cols-2 overflow-hidden rounded" aria-hidden="true">
                  <span className="bg-stone-400" />
                  <span className="grid place-items-center bg-white">
                    <span className="h-5 w-4 rounded-sm bg-stone-300" />
                  </span>
                </span>
              ),
            },
          ]}
        />
        <ImagePicker label={t('appearance.login.image')} hint={t('appearance.login.imageHint')} value={login.background_image} onChange={(v) => set('background_image', v)} />
      </Section>
      <Section title={t('appearance.login.textsTitle')} description={t('appearance.login.textsHint')}>
        <LangTabs langs={langs} value={lang} onChange={setLang} filled={(l) => !!login.title?.[l] || !login.title} />
        <TextInput label={t('appearance.login.titleField')} value={login.title} lang={lang} onChange={(v) => set('title', v)} />
        <TextInput label={t('appearance.login.textField')} value={login.text} lang={lang} multiline onChange={(v) => set('text', v)} />
      </Section>
    </div>
  )
}
