import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { automationSnippets, type Snippet } from '../../../lib/snippets'
import { CopyButton, cx } from '../../../ui/controls'
import { Notice, tabListKeys } from '../../../ui/feedback'

/** Copy-paste recipes, filled in with this portal's address (and a fresh token when there is one). */
export function RecipesTab({ nodeUrl, token }: { nodeUrl: string; token?: string }) {
  const { t } = useTranslation()
  const snippets = automationSnippets(nodeUrl, token)
  const [active, setActive] = useState<Snippet['id']>('cli')
  const current = snippets.find((s) => s.id === active)!
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-stone-600">{t('recipes.intro')}</p>
      {token ? (
        <Notice tone="ok">{t('recipes.tokenFilled')}</Notice>
      ) : (
        <Notice>
          {t('recipes.needToken')}{' '}
          <Link to="/admin/automation" search={{ tab: 'tokens' }} className="font-medium underline">
            {t('recipes.makeToken')}
          </Link>
        </Notice>
      )}
      <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
        <ul role="tablist" aria-label={t('recipes.title')} aria-orientation="vertical" onKeyDown={tabListKeys} className="space-y-1">
          {snippets.map((s) => (
            <li key={s.id} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={active === s.id}
                onClick={() => setActive(s.id)}
                className={cx('w-full rounded-control px-3 py-2 text-left text-sm', active === s.id ? 'bg-accent-soft font-medium text-accent-strong' : 'hover:bg-stone-100')}
              >
                <span className="block">{t(`recipes.${s.id}.title`)}</span>
                <span className="block text-xs font-normal text-stone-500">{t(`recipes.${s.id}.who`)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div role="tabpanel" className="min-w-0 space-y-3">
          <p className="text-sm text-stone-700">{t(`recipes.${current.id}.body`)}</p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-lg bg-stone-900 p-4 text-xs leading-relaxed text-stone-100" data-testid="recipe-code">
              <code>{current.code}</code>
            </pre>
            <div className="absolute right-2 top-2">
              <CopyButton value={current.code} />
            </div>
          </div>
          <p className="text-xs text-stone-500">{t('recipes.docs')}</p>
        </div>
      </div>
    </div>
  )
}
