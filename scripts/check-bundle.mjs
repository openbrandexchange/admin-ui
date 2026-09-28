// Bundle size budget for the production build (run after `npm run build`; CI fails above it).
// Sizes are gzip, as a browser downloads them. Raise a budget only on purpose, in the same
// commit as the change that needs it, and say why in the commit message.
//   node scripts/check-bundle.mjs [dist]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const LANGS = 'bg cs da de el en es et fi fr ga hr hu it lt lv mt nb nl pl pt ro sk sl sv'.split(' ')
const KB = 1024
const BUDGET = {
  entry: 170 * KB, // index-*.js: React, router, query, i18n, shell
  chunk: 20 * KB, // any lazily loaded screen or helper chunk
  locale: 25 * KB, // one language (loaded on demand)
  css: 14 * KB,
  firstLoad: 200 * KB, // entry + css + one language: what a visitor downloads before the first screen
}

const dist = resolve(process.argv[2] ?? 'dist')
const dir = join(dist, 'assets')
const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile())
const gz = (f) => gzipSync(readFileSync(join(dir, f)), { level: 9 }).length
const kind = (f) => (f.endsWith('.css') ? 'css' : /^index-.*\.js$/.test(f) ? 'entry' : LANGS.includes(f.split('-')[0]) && f.endsWith('.js') ? 'locale' : f.endsWith('.js') ? 'chunk' : 'other')

const rows = files.map((f) => ({ f, kind: kind(f), size: gz(f) })).filter((r) => r.kind !== 'other')
const over = rows.filter((r) => r.size > BUDGET[r.kind])
const entry = rows.filter((r) => r.kind === 'entry').reduce((n, r) => n + r.size, 0)
const css = rows.filter((r) => r.kind === 'css').reduce((n, r) => n + r.size, 0)
const biggestLocale = Math.max(0, ...rows.filter((r) => r.kind === 'locale').map((r) => r.size))
const firstLoad = entry + css + biggestLocale
const fmt = (n) => (n / KB).toFixed(1) + ' kB'

for (const k of ['entry', 'css', 'chunk', 'locale']) {
  const of = rows.filter((r) => r.kind === k)
  if (!of.length) continue
  const max = of.reduce((a, b) => (b.size > a.size ? b : a))
  console.log(`${k.padEnd(7)} ${String(of.length).padStart(3)} file(s), largest ${fmt(max.size).padStart(9)} (${max.f}), budget ${fmt(BUDGET[k])}`)
}
console.log(`first load (entry + css + largest language): ${fmt(firstLoad)}, budget ${fmt(BUDGET.firstLoad)}`)

if (!rows.some((r) => r.kind === 'entry')) {
  console.error('✗ no entry chunk found in ' + dir)
  process.exit(1)
}
const problems = over.map((r) => `${r.f}: ${fmt(r.size)} > ${fmt(BUDGET[r.kind])} (${r.kind})`)
if (firstLoad > BUDGET.firstLoad) problems.push(`first load ${fmt(firstLoad)} > ${fmt(BUDGET.firstLoad)}`)
if (problems.length) {
  console.error('✗ over the bundle budget:\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log('✓ bundle within budget')
