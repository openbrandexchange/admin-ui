// Vite plugin: writes dist/THIRD-PARTY-LICENSES.txt with the name, version, licence and
// licence text of every npm package that actually ends up in the bundle. MIT, ISC and BSD
// ask that their notice travels with every copy; minified bundles drop the comments. Also
// copies this repository's LICENSE and NOTICE into dist/.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

function packageRoot(id: string): string | null {
  const i = id.lastIndexOf('/node_modules/')
  if (i < 0) return null
  const rest = id.slice(i + '/node_modules/'.length).split('/')
  const name = rest[0].startsWith('@') ? rest.slice(0, 2).join('/') : rest[0]
  return id.slice(0, i) + '/node_modules/' + name
}

export function thirdPartyNotices(): Plugin {
  return {
    name: 'obx-third-party-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      const roots = new Set<string>()
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue
        for (const id of Object.keys(chunk.modules)) {
          const root = packageRoot(id.replace(/^\0/, '').split('?')[0])
          if (root) roots.add(root)
        }
      }
      const entries = [...roots]
        .map((root) => {
          const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { name: string; version: string; license?: string; homepage?: string }
          const file = existsSync(root) ? readdirSync(root).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f)) : undefined
          const text = file ? readFileSync(join(root, file), 'utf8').trim() : `Licensed under ${pkg.license ?? 'see package'}.`
          return { name: pkg.name, version: pkg.version, license: pkg.license ?? 'UNKNOWN', homepage: pkg.homepage, text }
        })
        .sort((a, b) => a.name.localeCompare(b.name))
      const unique = entries.filter((e, i) => entries.findIndex((x) => x.name === e.name && x.version === e.version) === i)
      const body = [
        'Third-party software included in this build of the Open Brand Exchange admin UI.',
        'The admin UI itself is licensed under the Apache License 2.0 (see LICENSE and NOTICE).',
        '',
        ...unique.map((e) => ['='.repeat(78), `${e.name} ${e.version} (${e.license})${e.homepage ? '\n' + e.homepage : ''}`, '-'.repeat(78), e.text, ''].join('\n')),
      ].join('\n')
      this.emitFile({ type: 'asset', fileName: 'THIRD-PARTY-LICENSES.txt', source: body })
      // The UI's own licence and notice travel with every vendored copy of dist/ as well.
      for (const f of ['LICENSE', 'NOTICE']) if (existsSync(f)) this.emitFile({ type: 'asset', fileName: f, source: readFileSync(f, 'utf8') })
    },
  }
}
