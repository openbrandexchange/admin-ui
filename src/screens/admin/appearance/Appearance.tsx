import { useEffect, useMemo, useState } from 'react'
import { Link, useBlocker, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Settings } from '../../../api/types'
import { ensureAppearanceStrings } from '../../../i18n'
import { settingsQuery, useUpdateSettings } from '../../../queries/admin'
import { viewerQuery } from '../../../queries/portal'
import type { AppearanceTab } from '../../../router'
import { Button, Loading, PageHeader, Saved, cx } from '../../../ui/controls'
import { Dialog, ErrorNote, tabListKeys } from '../../../ui/feedback'
import { useContentLanguages } from '../product/LocalizedInput'
import { HomeEditor } from './HomeEditor'
import { ImageLibrary } from './ImageLibrary'
import { LoginEditor } from './LoginEditor'
import { draftOf, patchOf, previewBranding, usedImages, type Draft } from './model'
import { Preview, type PreviewScreen } from './Preview'
import { ThemeEditor } from './ThemeEditor'

const TABS: AppearanceTab[] = ['theme', 'login', 'home', 'images']

/** Serialised with sorted keys, so "changed" means a different value, not a different key order. */
const stable = (v: unknown): string => JSON.stringify(v, (_k, x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))

/** Loads the editor's strings (a separate file per language) before showing it. */
function useAppearanceStrings() {
  const { i18n } = useTranslation()
  const [ready, setReady] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void ensureAppearanceStrings(i18n.language).then(() => live && setReady(i18n.language))
    return () => void (live = false)
  }, [i18n.language])
  return ready !== null
}

export function AppearanceScreen() {
  const ready = useAppearanceStrings()
  const settings = useQuery(settingsQuery)
  const viewer = useQuery(viewerQuery)
  if (!ready || settings.isPending || viewer.isPending) return <Loading />
  if (settings.isError) return <ErrorNote error={settings.error} onRetry={() => void settings.refetch()} />
  if (viewer.isError) return <ErrorNote error={viewer.error} onRetry={() => void viewer.refetch()} />
  return <Editor settings={settings.data} base={viewer.data.branding} />
}

function Editor({ settings, base }: { settings: Settings; base: Parameters<typeof previewBranding>[0] }) {
  const { t } = useTranslation()
  const { tab = 'theme' } = useSearch({ from: '/admin/appearance' })
  const update = useUpdateSettings()
  const langs = useContentLanguages()
  const [lang, setLang] = useState(langs[0] ?? 'en')
  const [saved, setSaved] = useState(() => draftOf(settings))
  const [draft, setDraft] = useState<Draft>(saved)
  const [focus, setFocus] = useState<string | null>(null)
  const [screen, setScreen] = useState<PreviewScreen>(tab === 'login' ? 'login' : 'home')
  const dirty = stable(draft) !== stable(saved)

  const branding = useMemo(() => previewBranding(base, settings, draft), [base, settings, draft])
  // Leaving the page with unsaved changes asks first (switching tabs here does not).
  const blocker = useBlocker({ shouldBlockFn: ({ next }) => dirty && next.pathname !== '/admin/appearance', enableBeforeUnload: () => dirty, withResolver: true })

  const save = () =>
    update.mutate(patchOf(settings, draft), {
      onSuccess: (s) => {
        const next = draftOf(s)
        setSaved(next)
        setDraft(next)
      },
    })

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('appearance.title')}
        description={t('appearance.intro')}
        actions={
          <>
            <Link to="/" className="inline-flex h-10 items-center px-2 text-sm font-medium text-stone-700 underline underline-offset-2 hover:text-stone-900">
              {t('admin.nav.viewPortal')}
            </Link>
            <Button disabled={!dirty || update.isPending} onClick={() => setDraft(saved)}>
              {t('appearance.discard')}
            </Button>
            <Button variant="primary" loading={update.isPending} disabled={!dirty} onClick={save}>
              {t('common.save')}
            </Button>
          </>
        }
      />
      <div className="flex min-h-6 flex-wrap items-center gap-3 text-sm" aria-live="polite">
        {dirty ? <span className="font-medium text-amber-800">{t('appearance.unsaved')}</span> : <Saved show={update.isSuccess} />}
      </div>
      <ErrorNote error={update.error} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <div role="tablist" aria-label={t('appearance.title')} className="flex flex-wrap gap-1 border-b border-stone-200">
            {TABS.map((id) => (
              <Link
                key={id}
                role="tab"
                onKeyDown={tabListKeys}
                aria-selected={tab === id}
                to="/admin/appearance"
                search={{ tab: id === 'theme' ? undefined : id }}
                // The preview follows the part being edited.
                onClick={() => (id === 'login' ? setScreen('login') : id === 'home' && setScreen('home'))}
                className={cx('-mb-px border-b-2 px-3 py-2 text-sm font-medium', tab === id ? 'border-accent text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800')}
              >
                {t(`appearance.tab.${id}`)}
              </Link>
            ))}
          </div>
          <div role="tabpanel" aria-label={t(`appearance.tab.${tab}`)}>
            {tab === 'theme' && <ThemeEditor theme={draft.theme} settings={settings} onChange={(fn) => setDraft((d) => ({ ...d, theme: fn(d.theme) }))} />}
            {tab === 'login' && <LoginEditor login={draft.login} langs={langs} lang={lang} setLang={setLang} onChange={(fn) => setDraft((d) => ({ ...d, login: fn(d.login) }))} />}
            {tab === 'home' && <HomeEditor blocks={draft.blocks} langs={langs} lang={lang} setLang={setLang} focus={focus} setFocus={setFocus} onChange={(fn) => setDraft((d) => ({ ...d, blocks: fn(d.blocks) }))} />}
            {tab === 'images' && <ImageLibrary used={usedImages(saved)} />}
          </div>
        </div>
        <div className="min-w-0 xl:sticky xl:top-6 xl:h-[calc(100dvh-3rem)]">
          <div className="h-[34rem] xl:h-full">
            <Preview branding={branding} screen={screen} onScreen={setScreen} focusBlock={tab === 'home' ? focus : null} />
          </div>
        </div>
      </div>

      <Dialog
        open={blocker.status === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t('appearance.leaveTitle')}
        footer={
          <>
            <Button onClick={() => blocker.reset?.()}>{t('appearance.stay')}</Button>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>
              {t('appearance.leave')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-700">{t('appearance.leaveBody')}</p>
      </Dialog>
    </div>
  )
}
