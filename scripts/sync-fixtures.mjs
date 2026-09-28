// Copies the Kestrel Outfitters fixtures from the spec repo into this repo for mock mode.
// Usage: node scripts/sync-fixtures.mjs [path-to-spec]   (default: ../spec)
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const spec = resolve(process.argv[2] ?? '../spec')
const src = join(spec, 'fixtures', 'kestrel')
const dataOut = resolve('src/mock/fixtures')
const imgOut = resolve('mock-public/mock-fixtures/kestrel')

mkdirSync(dataOut, { recursive: true })
for (const f of ['products.csv', 'assets.csv', 'images.json']) cpSync(join(src, f), join(dataOut, f))
rmSync(imgOut, { recursive: true, force: true })
mkdirSync(imgOut, { recursive: true })
const images = readdirSync(join(src, 'images')).filter((f) => f.endsWith('.png'))
for (const f of images) cpSync(join(src, 'images', f), join(imgOut, f))
console.log(`copied 3 data files and ${images.length} images from ${src}`)
