import type { ReactNode } from 'react'
import { usePublicLayout } from '../../shell/PublicShell'
import { cx } from '../../ui/controls'

/** A public page's form: a card, or the bare form beside the split layout's image. */
export function PublicCard({ title, intro, children }: { title: ReactNode; intro?: ReactNode; children: ReactNode }) {
  const split = usePublicLayout() === 'split'
  return (
    <div className={cx('space-y-6', !split && 'card p-6 @[40rem]:p-8')}>
      <div className="space-y-2">
        <h1 className={cx('text-stone-900', split ? 'display text-4xl' : 'display text-2xl')}>{title}</h1>
        {intro && <p className="text-sm leading-relaxed text-stone-600">{intro}</p>}
      </div>
      {children}
    </div>
  )
}
