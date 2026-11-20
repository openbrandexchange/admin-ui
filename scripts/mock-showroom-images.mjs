// Generates the MAISON NOOR showroom images of the mock (no photographs, nothing downloaded):
// product packshots per fixture image (same names as the spec's fixtures, .svg), and the
// hero, tile, story and login images of the themed demo. Output: mock-public/mock-fixtures/showroom/.
//   bun scripts/mock-showroom-images.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const out = join(root, 'mock-public/mock-fixtures/showroom')
mkdirSync(out, { recursive: true })

// Deterministic randomness, so the files only change when this script does.
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const r = (a, b) => a + rnd() * (b - a)
const f = (n) => Math.round(n * 10) / 10

const COLOURS = {
  NVY: '#22304d', OAT: '#d8cab0', BLK: '#26272b', OLV: '#5d5b3b', RST: '#a4552f', WHT: '#efece5',
  IND: '#2b3a5e', COG: '#8d5a32', CHR: '#45484d', BRN: '#5b3f2c', YLW: '#dfb43c',
}
const shade = (hex, t) => {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

const grain = (id, opacity = 0.18, freq = 0.9) =>
  `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${opacity} 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>`

// ---------------------------------------------------------------- packshots (1200 × 1500)

const W = 1200
const H = 1500
const studio = () => `
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#f4f3f1"/><stop offset="1" stop-color="#e4e2de"/></radialGradient>
    <radialGradient id="floor" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="fold" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
    ${grain('tex', 0.22, 1.1)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>`
const shadow = (cx, cy, rx, ry = 34) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#floor)"/>`
/** Fill a shape with the colour, the fold and light gradients and a fine fabric grain. */
const cloth = (d, c, extra = '') => `<g><path d="${d}" fill="${c}"/><path d="${d}" fill="url(#fold)"/><path d="${d}" fill="url(#top)"/><path d="${d}" fill="${c}" filter="url(#tex)"/>${extra}</g>`
const stitch = (d, c, w = 3) => `<path d="${d}" fill="none" stroke="${shade(c, c === COLOURS.WHT || c === COLOURS.OAT || c === COLOURS.YLW ? -0.25 : 0.35)}" stroke-width="${w}" stroke-dasharray="10 9" stroke-linecap="round" opacity=".75"/>`
const line = (d, c, t = -0.3, w = 4, o = 0.6) => `<path d="${d}" fill="none" stroke="${shade(c, t)}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`

const KNIT = (c) => {
  let s = ''
  for (let x = 330; x < 880; x += 26) s += line(`M${x} 980 v120`, c, -0.25, 7, 0.35)
  return s
}

const garments = {
  sweater(c, view) {
    const body = 'M600 330 C540 330 505 345 470 352 L330 400 C290 415 268 450 258 500 L190 900 C186 925 200 940 225 942 L300 948 C320 948 332 935 336 915 L372 640 L372 1100 C372 1120 385 1130 405 1130 L795 1130 C815 1130 828 1120 828 1100 L828 640 L864 915 C868 935 880 948 900 948 L975 942 C1000 940 1014 925 1010 900 L942 500 C932 450 910 415 870 400 L730 352 C695 345 660 330 600 330 Z'
    const collar = view === 'back' ? '' : `<path d="M510 352 C540 420 660 420 690 352" fill="none" stroke="${shade(c, -0.3)}" stroke-width="22" stroke-linecap="round"/>`
    return shadow(600, 1160, 330) + cloth(body, c, collar + KNIT(c) + line('M195 900 L300 908 M900 908 L1005 900', c, -0.3, 18, 0.5) + line('M372 640 C380 560 372 470 372 420 M828 640 C820 560 828 470 828 420', c, -0.25, 3, 0.45))
  },
  jacket(c, view) {
    const body = 'M600 300 L455 330 L320 390 C285 405 262 440 255 485 L200 950 C197 975 212 990 236 990 L305 992 C325 992 338 980 342 960 L380 640 L372 1180 C372 1200 386 1212 406 1212 L794 1212 C814 1212 828 1200 828 1180 L820 640 L858 960 C862 980 875 992 895 992 L964 990 C988 990 1003 975 1000 950 L945 485 C938 440 915 405 880 390 L745 330 Z'
    const front =
      view === 'back'
        ? line('M380 520 C500 560 700 560 820 520', c, -0.3, 5, 0.5)
        : `${line('M600 360 L600 1208', c, -0.4, 6, 0.8)}<path d="M455 330 L600 470 L745 330 L700 300 L600 360 L500 300 Z" fill="${shade(c, -0.25)}"/>` +
          [560, 700, 840, 980].map((y) => `<circle cx="630" cy="${y}" r="13" fill="${shade(c, -0.5)}"/>`).join('') +
          `<path d="M410 900 h130 v70 h-130 Z M660 900 h130 v70 h-130 Z" fill="${shade(c, -0.12)}"/>` + stitch('M410 900 h130 M660 900 h130', c)
    return shadow(600, 1240, 340) + cloth(body, c, front + stitch('M382 1170 H818', c))
  },
  t_shirt(c, view) {
    const body = 'M600 360 C560 360 530 368 505 375 L380 410 L210 520 C195 530 192 548 202 562 L272 662 C282 676 300 678 314 668 L385 620 L385 1110 C385 1128 398 1140 416 1140 L784 1140 C802 1140 815 1128 815 1110 L815 620 L886 668 C900 678 918 676 928 662 L998 562 C1008 548 1005 530 990 520 L820 410 L695 375 C670 368 640 360 600 360 Z'
    const neck = view === 'back' ? line('M520 378 C560 392 640 392 680 378', c, -0.25, 10, 0.6) : `<path d="M515 376 C545 440 655 440 685 376" fill="none" stroke="${shade(c, -0.22)}" stroke-width="16" stroke-linecap="round"/>`
    return shadow(600, 1170, 300) + cloth(body, c, neck + stitch('M390 1110 H810 M215 548 L285 645 M985 548 L915 645', c, 2.5))
  },
  jeans(c, view) {
    const body = 'M410 260 L790 260 L812 420 L880 1260 C882 1282 868 1296 846 1296 L700 1296 C680 1296 668 1284 666 1264 L602 640 L534 1264 C532 1284 520 1296 500 1296 L354 1296 C332 1296 318 1282 320 1260 L388 420 Z'
    const details =
      view === 'detail'
        ? ''
        : stitch('M410 330 H790', c) +
          (view === 'back'
            ? `<path d="M430 420 h140 l-10 150 l-60 25 l-60 -25 Z M630 420 h140 l-10 150 l-60 25 l-60 -25 Z" fill="none" stroke="${shade(c, 0.4)}" stroke-width="3" stroke-dasharray="9 8"/>`
            : stitch('M408 360 C470 380 520 420 540 470 M792 360 C730 380 680 420 660 470 M602 330 L602 600', c)) +
          `<rect x="440" y="250" width="14" height="44" rx="3" fill="${shade(c, -0.35)}"/><rect x="746" y="250" width="14" height="44" rx="3" fill="${shade(c, -0.35)}"/><circle cx="602" cy="296" r="12" fill="#b08d57"/>`
    let twill = ''
    for (let i = -20; i < 40; i++) twill += `<path d="M${i * 34} 1500 L${i * 34 + 900} 200" stroke="${shade(c, 0.18)}" stroke-width="5" opacity=".14"/>`
    return shadow(600, 1300, 320, 28) + `<clipPath id="leg"><path d="${body}"/></clipPath>` + cloth(body, c, `<g clip-path="url(#leg)">${twill}</g>` + details + line('M602 640 L602 600', c, -0.4, 4))
  },
  bag(c, view) {
    if (view === 'inside')
      return shadow(600, 1150, 380) + cloth('M230 560 C230 520 260 500 300 500 L900 500 C940 500 970 520 970 560 L940 1080 C938 1110 915 1130 885 1130 L315 1130 C285 1130 262 1110 260 1080 Z', c, `<path d="M290 520 L910 520 L880 820 L320 820 Z" fill="${shade(c, -0.55)}"/><path d="M340 560 h520 v200 h-520Z" fill="#2e2a26" opacity=".85"/>` + stitch('M300 860 H900', c))
    const w = view === 'side' ? 0.55 : 1
    const x = (v) => f(600 + (v - 600) * w)
    const body = `M${x(240)} 600 C${x(240)} 560 ${x(270)} 540 ${x(310)} 540 L${x(890)} 540 C${x(930)} 540 ${x(960)} 560 ${x(960)} 600 L${x(985)} 1060 C${x(988)} 1100 ${x(960)} 1130 ${x(920)} 1130 L${x(280)} 1130 C${x(240)} 1130 ${x(212)} 1100 ${x(215)} 1060 Z`
    const handles = `<path d="M${x(430)} 548 C${x(430)} 330 ${x(770)} 330 ${x(770)} 548" fill="none" stroke="${shade(c, -0.25)}" stroke-width="30" stroke-linecap="round"/>`
    return shadow(600, 1150, 400 * w + 40) + handles + cloth(body, c, stitch(`M${x(260)} 610 H${x(940)} M${x(250)} 1080 H${x(950)}`, c) + (view === 'side' ? '' : `<rect x="560" y="600" width="80" height="60" rx="8" fill="#b08d57"/>` + line('M300 640 H900', c, -0.3, 6, 0.6)))
  },
  hat(c) {
    const body = 'M340 900 C330 640 440 450 600 450 C760 450 870 640 860 900 Z'
    let rib = ''
    for (let xx = 330; xx <= 870; xx += 30) rib += line(`M${xx} 905 v170`, c, -0.25, 9, 0.4)
    return shadow(600, 1110, 290) + cloth(body, c, `<circle cx="600" cy="440" r="70" fill="${shade(c, 0.08)}"/>`) + cloth('M320 900 H880 C890 900 896 908 896 918 V1072 C896 1082 888 1090 878 1090 H322 C312 1090 304 1082 304 1072 V918 C304 908 310 900 320 900 Z', c, rib)
  },
  luggage(c, view) {
    if (view === 'inside') return shadow(600, 1240, 380) + cloth('M240 360 h720 v860 h-720 Z', c, `<rect x="280" y="400" width="640" height="780" rx="20" fill="#2b2c30"/>` + stitch('M300 790 H900', c) + line('M330 450 L870 1130 M870 450 L330 1130', c, 0.4, 8, 0.4))
    const w = view === 'side' ? 0.42 : 1
    const x = (v) => f(600 + (v - 600) * w)
    const body = `M${x(330)} 380 C${x(330)} 340 ${x(360)} 320 ${x(400)} 320 L${x(800)} 320 C${x(840)} 320 ${x(870)} 340 ${x(870)} 380 L${x(870)} 1160 C${x(870)} 1200 ${x(840)} 1220 ${x(800)} 1220 L${x(400)} 1220 C${x(360)} 1220 ${x(330)} 1200 ${x(330)} 1160 Z`
    const ribs = view === 'side' ? '' : [450, 530, 670, 750].map((xx) => line(`M${xx} 360 V1180`, c, 0.25, 10, 0.35)).join('')
    return shadow(600, 1270, 300 * w + 60) + `<path d="M520 320 V200 H680 V320" fill="none" stroke="#3a3b3f" stroke-width="22"/>` + cloth(body, c, ribs) + [x(380), x(820)].map((xx) => `<circle cx="${xx}" cy="1240" r="26" fill="#2b2c30"/>`).join('')
  },
  messenger(c, view) {
    if (view === 'inside') return garments.bag(c, 'inside')
    const w = view === 'side' ? 0.45 : 1
    const x = (v) => f(600 + (v - 600) * w)
    const body = `M${x(230)} 560 L${x(970)} 560 L${x(970)} 1110 C${x(970)} 1130 ${x(955)} 1140 ${x(935)} 1140 L${x(265)} 1140 C${x(245)} 1140 ${x(230)} 1130 ${x(230)} 1110 Z`
    const flap = view === 'side' ? '' : `<path d="M230 560 L970 560 L970 860 C970 900 940 920 900 920 L300 920 C260 920 230 900 230 860 Z" fill="${shade(c, 0.06)}"/>` + stitch('M250 900 H950', c) + `<rect x="560" y="880" width="80" height="80" rx="10" fill="#1c1d20"/>`
    return shadow(600, 1170, 420 * w + 30) + `<path d="M${x(250)} 570 C${x(150)} 200 ${x(1050)} 200 ${x(950)} 570" fill="none" stroke="#1c1d20" stroke-width="26"/>` + cloth(body, c, flap)
  },
  shoes(c, view) {
    const sole = '#201f1d'
    if (view === 'front')
      return shadow(600, 1180, 230) + cloth('M470 420 C470 380 520 360 600 360 C680 360 730 380 730 420 L742 1060 C746 1130 700 1160 600 1160 C500 1160 454 1130 458 1060 Z', c, `<path d="M478 430 L522 430 L530 780 L486 760 Z M722 430 L678 430 L670 780 L714 760 Z" fill="${shade(c, -0.45)}"/>` + `<path d="M452 1100 C452 1150 500 1180 600 1180 C700 1180 748 1150 748 1100 L748 1130 C748 1170 700 1200 600 1200 C500 1200 452 1170 452 1130 Z" fill="${sole}"/>`)
    // Chelsea boot in profile: shaft, elastic gusset, rounded toe, stacked heel.
    const body = 'M330 300 L560 300 C566 520 572 700 600 790 C650 860 760 880 880 900 C960 914 1000 960 1000 1010 L1000 1050 L250 1050 L252 900 C262 820 300 760 318 640 C326 560 326 420 330 300 Z'
    return shadow(620, 1110, 430) + cloth(body, c, `<path d="M372 330 C392 470 402 600 430 700 L520 700 C500 600 490 470 480 330 Z" fill="${shade(c, -0.4)}"/>` + line('M380 340 C398 470 410 600 436 690 M420 340 C438 470 450 600 476 690 M460 340 C476 470 486 600 510 690', c, -0.55, 4, 0.5) + `<path d="M330 300 L560 300 L560 330 L330 330 Z" fill="${shade(c, -0.2)}"/><path d="M590 300 h60 v-80 a20 20 0 0 0 -20 -20 h-20 Z" fill="${shade(c, -0.25)}"/>` + `<path d="M240 1040 H1004 C1010 1040 1012 1060 1004 1068 C990 1080 960 1084 900 1084 L420 1084 L420 1120 L250 1120 L240 1084 Z" fill="${sole}"/>` + stitch('M262 1030 H990', c))
  },
  shorts(c, view) {
    const body = 'M380 420 L820 420 L860 900 C862 920 850 932 830 932 L660 932 C640 932 630 922 628 902 L602 700 L572 902 C570 922 560 932 540 932 L370 932 C350 932 338 920 340 900 Z'
    return shadow(600, 960, 300, 26) + cloth(body, c, line('M380 470 H820', c, -0.3, 22, 0.55) + (view === 'back' ? '' : stitch('M602 480 V690 M420 520 C470 540 500 580 510 620', c)) + stitch('M352 900 H562 M640 900 H850', c))
  },
  rain_jacket(c, view) {
    const g = garments.jacket(c, view === 'back' ? 'back' : 'plain')
    const hood = `<path d="M470 340 C470 180 730 180 730 340 Z" fill="${shade(c, -0.12)}"/>`
    return hood + g + (view === 'back' ? '' : line('M600 360 L600 1208', c, -0.45, 8, 0.9))
  },
}

// Item type per style (products.csv) and how a view changes the drawing.
const STYLES = {
  'KO-1001': 'sweater', 'KO-1002': 'jacket', 'KO-1003': 't_shirt', 'KO-1004': 'jeans', 'KO-1005': 'bag', 'KO-1006': 'hat',
  'KO-1008': 'luggage', 'KO-1009': 'messenger', 'KO-1010': 'shoes', 'KT-2001': 'shorts', 'KT-2002': 'rain_jacket',
}

function model(c, kind) {
  // A faceless figure wearing the piece: head, neck and arms in a soft skin tone.
  const skin = '#c9a58a'
  return `<path d="M410 1120 L380 1500 L585 1500 L600 1200 L615 1500 L820 1500 L790 1120 Z" fill="#2c2f36"/><path d="M548 250 h104 v150 h-104Z" fill="${skin}"/><ellipse cx="600" cy="210" rx="92" ry="112" fill="${skin}"/><path d="M508 170 C520 90 680 90 692 170 C660 130 540 130 508 170 Z" fill="#3a2a22"/>` + garments[kind](c, 'front')
}

function detail(c) {
  let s = `<rect width="${W}" height="${H}" fill="${c}"/>`
  for (let i = -30; i < 60; i++) s += `<path d="M${i * 30} ${H} L${i * 30 + 1300} 0" stroke="${shade(c, 0.22)}" stroke-width="7" opacity=".2"/>`
  s += `<path d="M0 820 C300 780 900 860 1200 800" stroke="#c99b4f" stroke-width="7" fill="none" stroke-dasharray="22 14"/><path d="M0 880 C300 840 900 920 1200 860" stroke="#c99b4f" stroke-width="7" fill="none" stroke-dasharray="22 14"/>`
  s += `<circle cx="760" cy="520" r="70" fill="#b08d57"/><circle cx="760" cy="520" r="44" fill="none" stroke="#7a5d32" stroke-width="10"/>`
  return s + `<rect width="${W}" height="${H}" fill="${c}" filter="url(#tex)"/>`
}

const fixtures = JSON.parse(readFileSync(join(root, 'src/mock/fixtures/images.json'), 'utf8'))
let n = 0
for (const [file, meta] of Object.entries(fixtures)) {
  const kind = STYLES[meta.style]
  const c = COLOURS[meta.color] ?? '#777'
  const view = meta.qualifier
  const art = view === 'model' ? model(c, kind) : view === 'detail' ? detail(c) : garments[kind](c, view)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${studio()}${art}</svg>`
  writeFileSync(join(out, file.replace(/\.png$/, '.svg')), svg)
  n++
}

// ---------------------------------------------------------------- editorial scenes
// Monochrome studio compositions: draped silk, an arch, objects on a plinth in hard light.

/** Satin folds: bands between wavy curves, each shaded across its width. */
function silk(w, h, { base, light, dark, bands = 9, tilt = 0.35, seedValue = 3 }) {
  seed = seedValue
  let defs = ''
  let s = ''
  const curves = []
  for (let i = 0; i <= bands; i++) {
    const y0 = (h / bands) * i
    const pts = []
    for (let k = 0; k <= 6; k++) pts.push([(w / 6) * k, y0 + Math.sin(k * 1.1 + i * 0.7) * h * 0.06 + (k / 6) * h * tilt - h * tilt * 0.5 + r(-h * 0.02, h * 0.02)])
    curves.push(pts)
  }
  const path = (pts) => pts.map(([x, y], k) => (k === 0 ? `M${f(x)} ${f(y)}` : `S${f(x - w / 12)} ${f(y)} ${f(x)} ${f(y)}`)).join(' ')
  const back = (pts) => [...pts].reverse().map(([x, y], k) => (k === 0 ? `L${f(x)} ${f(y)}` : `S${f(x + w / 12)} ${f(y)} ${f(x)} ${f(y)}`)).join(' ')
  for (let i = 0; i < bands; i++) {
    const id = `b${i}`
    const hl = i % 3 === 1 ? light : base
    defs += `<linearGradient id="${id}" x1="0" y1="0" x2="0.15" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset=".45" stop-color="${hl}"/><stop offset=".62" stop-color="${hl}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`
    s += `<path d="${path(curves[i])} ${back(curves[i + 1])} Z" fill="url(#${id})"/>`
  }
  return { defs, body: s }
}

function svgDoc(w, h, defs, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs>${grain('g', 0.1, 0.85)}${defs}</defs>${body}<rect width="${w}" height="${h}" fill="#000" filter="url(#g)"/></svg>`
}

// Hero: an arch of pale stone with a black satin drape falling through it.
{
  const w = 2400
  const h = 1200
  const drape = silk(900, 1400, { base: '#3a3936', light: '#8c8a85', dark: '#121211', bands: 11, tilt: 0.1, seedValue: 4 })
  const body =
    `<rect width="${w}" height="${h}" fill="url(#wall)"/>` +
    `<path d="M1180 1200 V520 A430 430 0 0 1 2040 520 V1200 Z" fill="#cfcbc4"/>` +
    `<path d="M1250 1200 V540 A360 360 0 0 1 1970 540 V1200 Z" fill="url(#arch)"/>` +
    `<clipPath id="curtain"><path d="M1500 -20 C1560 300 1480 700 1380 1010 L2010 1010 C1930 760 1880 380 1960 -20 Z"/></clipPath><g clip-path="url(#curtain)"><g transform="translate(1260 -160) rotate(4)">${drape.body}</g></g><path d="M1380 1010 C1500 1030 1900 1030 2010 1010" stroke="#000" stroke-opacity=".25" stroke-width="18" fill="none"/>` +
    `<path d="M0 1010 H2400 V1200 H0Z" fill="#bdb8b0"/><path d="M0 1010 H2400" stroke="#a9a49b" stroke-width="3"/>` +
    `<path d="M1180 1010 L2400 1010 L2400 1200 L900 1200 Z" fill="#000" opacity=".08"/>`
  const defs =
    drape.defs +
    `<linearGradient id="wall" x1="0" x2="1"><stop offset="0" stop-color="#e9e7e3"/><stop offset=".6" stop-color="#dcd9d3"/><stop offset="1" stop-color="#cbc7c0"/></linearGradient>` +
    `<linearGradient id="arch" x1="0" x2="1"><stop offset="0" stop-color="#b9b4ab"/><stop offset="1" stop-color="#9f9a91"/></linearGradient>`
  writeFileSync(join(out, 'hero.svg'), svgDoc(w, h, defs, body))
}

// Login: ivory satin, full frame.
{
  const d = silk(1600, 2000, { base: '#d9d5cd', light: '#f6f4f0', dark: '#a8a399', bands: 10, tilt: 0.55, seedValue: 8 })
  writeFileSync(join(out, 'login.svg'), svgDoc(1600, 2000, d.defs, `<rect width="1600" height="2000" fill="#cfcac1"/>${d.body}`))
}

// Story: charcoal satin, close.
{
  const d = silk(1200, 1500, { base: '#4a4844', light: '#8f8b84', dark: '#1d1c1a', bands: 7, tilt: -0.4, seedValue: 12 })
  writeFileSync(join(out, 'story-atelier.svg'), svgDoc(1200, 1500, d.defs, `<rect width="1200" height="1500" fill="#2a2927"/>${d.body}`))
}

/** An object on a plinth against a wall, lit from the left: a long shadow to the right. */
function plinth(name, wall, object, floor = 1150) {
  const body =
    `<rect width="1200" height="1500" fill="url(#w)"/>` +
    `<path d="M300 1500 V560 A300 300 0 0 1 900 560 V1500 Z" fill="${shade(wall, -0.06)}"/>` +
    `<path d="M0 1240 H1200 V1500 H0Z" fill="${shade(wall, -0.12)}"/>` +
    `<path d="M600 1120 L1200 900 L1200 1240 L780 1240 Z" fill="#000" opacity=".1"/>` +
    `<path d="M330 1060 H870 V1300 H330Z" fill="${shade(wall, 0.35)}"/><path d="M330 1060 H870 V1090 H330Z" fill="#fff" opacity=".35"/><path d="M780 1060 H870 V1300 H780Z" fill="#000" opacity=".08"/>` +
    `<g transform="translate(${f(600 - 600 * 0.56)} ${f(1064 - floor * 0.56)}) scale(0.56)">${object}</g>`
  const defs = `<linearGradient id="w" x1="0" x2="1"><stop offset="0" stop-color="${shade(wall, 0.1)}"/><stop offset="1" stop-color="${shade(wall, -0.08)}"/></linearGradient><linearGradient id="fold" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient><linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient><radialGradient id="floor" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>${grain('tex', 0.18, 1.1)}`
  writeFileSync(join(out, name), svgDoc(1200, 1500, defs, body))
}
plinth('tile-bags.svg', '#d6d2cb', garments.bag('#1e1d1c', 'front'), 1150)
plinth('tile-shoes.svg', '#cdc8c0', garments.shoes('#262422', 'side'), 1118)
plinth('tile-accessories.svg', '#dcd8d1', garments.hat('#3b3936', 'front'), 1100)
{
  const d = silk(1200, 1500, { base: '#bfb9af', light: '#ece8e1', dark: '#8a847a', bands: 8, tilt: 0.7, seedValue: 21 })
  writeFileSync(join(out, 'tile-ready-to-wear.svg'), svgDoc(1200, 1500, d.defs, `<rect width="1200" height="1500" fill="#b8b2a8"/>${d.body}`))
}
console.log(`wrote ${n} packshots and 7 editorial images to ${out}`)
