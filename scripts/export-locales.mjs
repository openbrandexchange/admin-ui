// Copies every UI language to <outDir>/locales/<lang>.json so a node can render its
// e-mails (the `email.*` keys) in the recipient's language without bundling this app.
// Also writes <outDir>/locales/index.json listing the languages and the fallback order.
//
//   node scripts/export-locales.mjs dist
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, process.argv[2] ?? 'dist', 'locales')
const srcDir = join(root, 'src', 'locales')

await mkdir(outDir, { recursive: true })
const files = (await readdir(srcDir)).filter((f) => f.endsWith('.json')).sort()
const languages = []
for (const file of files) {
  const lang = file.replace(/\.json$/, '')
  const data = JSON.parse(await readFile(join(srcDir, file), 'utf8'))
  if (!data.email) throw new Error(`${file} has no email.* strings`)
  await writeFile(join(outDir, file), JSON.stringify(data, null, 2) + '\n')
  languages.push(lang)
}
const index = {
  $comment:
    'UI and e-mail strings for Open Brand Exchange portals. Use the recipient language, then "en". Placeholders are {{name}}; plural keys end in _one/_other/… (CLDR categories).',
  source: 'en',
  fallback: ['en'],
  languages,
}
await writeFile(join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
console.log(`exported ${languages.length} languages to ${outDir}`)
