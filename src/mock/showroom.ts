// The themed demo showroom of the mock: MAISON NOOR, a fictional fashion house (womenswear,
// bags, shoes, accessories). Theme, login page, start page and branding images as a brand
// would set them in Appearance (spec node-admin.yaml 0.3.1). Images are drawn by
// scripts/mock-showroom-images.mjs; nothing here is a photograph or a real company.
import type { HomeBlock } from '../api/appearance'
import type { Settings } from '../api/types'

export interface MockImage {
  id: string
  /** Where the bytes live: a mock fixture URL, a data: URL or a blob: URL (uploads). */
  src: string
  width: number
  height: number
  bytes: number
  content_type: 'image/png' | 'image/jpeg' | 'image/webp'
  created_at: string
}

const base = () => (typeof document !== 'undefined' ? new URL('mock-fixtures/showroom/', document.baseURI).toString() : 'http://localhost/mock-fixtures/showroom/')

/** The showroom's packshot for a spec fixture image (same name, drawn as SVG). */
export const showroomPackshot = (file: string) => base() + file.replace(/\.png$/, '.svg')

export function showroomImages(at: string): MockImage[] {
  const img = (id: string, file: string, width: number, height: number, bytes: number): MockImage => ({ id, src: base() + file, width, height, bytes, content_type: 'image/png', created_at: at })
  return [
    img('img_hero_aw26', 'hero.svg', 2400, 1200, 412_000),
    img('img_login', 'login.svg', 1600, 2000, 386_000),
    img('img_tile_rtw', 'tile-ready-to-wear.svg', 1200, 1500, 244_000),
    img('img_tile_bags', 'tile-bags.svg', 1200, 1500, 198_000),
    img('img_tile_shoes', 'tile-shoes.svg', 1200, 1500, 203_000),
    img('img_tile_accessories', 'tile-accessories.svg', 1200, 1500, 187_000),
    img('img_story_atelier', 'story-atelier.svg', 1200, 1500, 231_000),
  ]
}

const blocks: HomeBlock[] = [
  {
    id: 'hero-aw26',
    type: 'hero',
    image: 'img_hero_aw26',
    title: { en: 'Autumn/Winter 2026', nl: 'Herfst/winter 2026', fr: 'Automne/hiver 2026' },
    text: {
      en: 'Quiet tailoring, sculpted leather and knitwear in ink, stone and ivory.',
      nl: 'Stille tailoring, gebeeldhouwd leer en breiwerk in inkt, steen en ivoor.',
      fr: 'Tailleur discret, cuir sculpté et maille en encre, pierre et ivoire.',
    },
    button_label: { en: 'View the collection', nl: 'Bekijk de collectie', fr: 'Voir la collection' },
    link: '/catalog?season=AW26',
    align: 'left',
    height: 'large',
    overlay: 'none',
  },
  {
    id: 'order-window',
    type: 'announcement',
    text: {
      en: 'The AW26 order window closes on 15 December. Final images for SS27 follow in January.',
      nl: 'Het orderwindow voor AW26 sluit op 15 december. De definitieve beelden voor SS27 volgen in januari.',
      fr: 'La fenêtre de commande AW26 ferme le 15 décembre. Les visuels définitifs SS27 suivent en janvier.',
    },
    tone: 'info',
  },
  {
    id: 'categories',
    type: 'tiles',
    title: { en: 'Shop by category', nl: 'Per categorie', fr: 'Par catégorie' },
    columns: 4,
    items: [
      { image: 'img_tile_rtw', title: { en: 'Ready-to-wear', nl: 'Ready-to-wear', fr: 'Prêt-à-porter' }, link: '/catalog?item_type=sweater&item_type=jacket&item_type=t_shirt&item_type=jeans' },
      { image: 'img_tile_bags', title: { en: 'Bags', nl: 'Tassen', fr: 'Sacs' }, link: '/catalog?item_type=bag' },
      { image: 'img_tile_shoes', title: { en: 'Shoes', nl: 'Schoenen', fr: 'Chaussures' }, link: '/catalog?item_type=shoes' },
      { image: 'img_tile_accessories', title: { en: 'Accessories', nl: 'Accessoires', fr: 'Accessoires' }, link: '/catalog?item_type=hat' },
    ],
  },
  {
    id: 'new-season',
    type: 'products',
    title: { en: 'New this season', nl: 'Nieuw dit seizoen', fr: 'Nouveautés de la saison' },
    query: 'season=AW26',
    max: 8,
  },
  {
    id: 'atelier',
    type: 'image_text',
    image: 'img_story_atelier',
    image_side: 'left',
    title: { en: 'Made to be kept', nl: 'Gemaakt om te bewaren', fr: 'Fait pour durer' },
    text: {
      en: 'Organic cotton, responsibly sourced wool and leather from certified tanneries. Every article page lists the fibres and certificates, ready for your labels and product pages.',
      nl: 'Biologisch katoen, verantwoord ingekochte wol en leer van gecertificeerde looierijen. Elke artikelpagina noemt de vezels en certificaten, klaar voor je labels en productpagina’s.',
      fr: 'Coton biologique, laine d’origine responsable et cuir de tanneries certifiées. Chaque fiche article indique les fibres et les certificats, prêts pour vos étiquettes et pages produit.',
    },
    button_label: { en: 'Organic materials', nl: 'Biologische materialen', fr: 'Matières biologiques' },
    link: '/catalog?qualifier=organic',
  },
  {
    id: 'account-manager',
    type: 'contact',
    title: { en: 'Your account manager', nl: 'Je accountmanager', fr: 'Votre responsable de compte' },
    name: 'Amira Haddad',
    email: 'wholesale@maisonnoor.example',
    phone: '+33 1 84 88 00 00',
  },
]

/** Settings.branding of the showroom (merged over the plain mock settings). */
export function showroomBranding(): NonNullable<Settings['branding']> {
  return {
    display_name: 'MAISON NOOR',
    logo_url: null,
    favicon_url: null,
    accent_color: '#1c1b1a',
    welcome_text: { en: 'Images, article data and order windows for MAISON NOOR stockists.', nl: 'Beelden, artikeldata en orderwindows voor verkooppunten van MAISON NOOR.' },
    portal_name: null,
    theme: {
      color_scheme: 'light',
      colors: { primary: '#1c1b1a', secondary: '#8a7a66', background: '#f6f5f2', surface: '#ffffff', text: '#1a1918' },
      heading_font: 'cormorant-garamond',
      body_font: 'jost',
      radius: 'none',
      grid_density: 'editorial',
      card_style: 'plain',
      image_fit: 'cover',
      image_background: '#eeece8',
    },
    login: {
      layout: 'split',
      background_image: 'img_login',
      title: { en: 'MAISON NOOR wholesale', nl: 'MAISON NOOR wholesale', fr: 'Espace professionnel MAISON NOOR' },
      text: {
        en: 'Final images, article data and order windows for our stockists.',
        nl: 'Definitieve beelden, artikeldata en orderwindows voor onze verkooppunten.',
        fr: 'Visuels définitifs, données articles et fenêtres de commande pour nos revendeurs.',
      },
    },
    // The generated HomeBlock union cannot hold "any other type"; the shapes are the spec's.
    home: { blocks: JSON.parse(JSON.stringify(blocks)) as never },
  }
}
