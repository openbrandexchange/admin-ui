import type { ReactNode } from 'react'

export function PublicCard({ title, intro, children }: { title: ReactNode; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="card space-y-5 p-6 sm:p-8">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {intro && <p className="text-sm text-stone-600">{intro}</p>}
      </div>
      {children}
    </div>
  )
}
