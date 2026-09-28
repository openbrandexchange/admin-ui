// Licence check of the dependencies. Runtime dependencies end up in dist/ (served to every
// visitor), so they must be permissive and compatible with Apache-2.0. Build and test tools
// never ship; they may also use weak-copyleft or documentation licences, never GPL/AGPL.
//   node scripts/check-licenses.mjs            (fails on anything outside the lists)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RUNTIME_OK = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'MIT-0', 'CC0-1.0', 'Unlicense', 'BlueOak-1.0.0']
const TOOLING_OK = [...RUNTIME_OK, 'MPL-2.0', 'CC-BY-4.0', 'CC-BY-3.0', 'Python-2.0', 'Artistic-2.0', 'BSD', 'WTFPL']

function packages(omitDev) {
  const args = ['ls', '--all', '--parseable', ...(omitDev ? ['--omit=dev'] : [])]
  const out = execFileSync('npm', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const [root, ...paths] = out.trim().split('\n')
  return paths.filter((p) => p && p !== root)
}

/** SPDX ids in a licence field; an expression like "(MIT OR Apache-2.0)" passes when one option does. */
function licenceOf(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  let lic = pkg.license ?? pkg.licenses ?? 'UNKNOWN'
  if (Array.isArray(lic)) lic = lic.map((l) => l.type ?? l).join(' OR ')
  if (typeof lic === 'object') lic = lic.type ?? 'UNKNOWN'
  return { name: `${pkg.name}@${pkg.version}`, licence: String(lic) }
}

const accepted = (licence, ok) => {
  const options = licence.replace(/[()]/g, '').split(/\s+OR\s+/i)
  return options.some((o) => o.split(/\s+AND\s+/i).every((part) => ok.includes(part.trim())))
}

let failed = false
const runtime = new Set(packages(true))
for (const [label, dirs, ok] of [
  ['runtime', [...runtime], RUNTIME_OK],
  ['tooling', packages(false).filter((d) => !runtime.has(d)), TOOLING_OK],
]) {
  const seen = new Map()
  for (const d of dirs) {
    const { name, licence } = licenceOf(d)
    seen.set(name, licence)
  }
  const bad = [...seen].filter(([, l]) => !accepted(l, ok))
  const counts = {}
  for (const l of seen.values()) counts[l] = (counts[l] ?? 0) + 1
  console.log(`${label}: ${seen.size} packages — ` + Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${n}`).join(', '))
  if (bad.length) {
    failed = true
    console.error(`✗ ${label} licences not allowed:\n  ` + bad.map(([n, l]) => `${n}: ${l}`).join('\n  '))
  }
}
if (failed) process.exit(1)
console.log('✓ all dependency licences allowed')
