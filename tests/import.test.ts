// The mock node's import against the spec's import rules for 0.3 (import-format.md §1.2.1 and
// §1.4): which variant a row is, a fibre without a percentage, the decimal comma and
// material_unknown. The CSVs are the spec's fixtures/imports/id-*.csv.
import { beforeEach, describe, expect, it } from 'vitest'
import { applyImport, db, resetDb } from '../src/mock/db'

const HEAD = 'brand,style_number,name:en,item_type,materials,contains_animal_origin'
const ID_1 = `${HEAD},color_code,size,size_length
Kestrel,KL-8101,Identity Test Jeans,jeans,main: 100% cotton,no,IND,32,32
Kestrel,KL-8101,Identity Test Jeans,jeans,main: 100% cotton,no,IND,32,34
Kestrel,KL-8101,Identity Test Jeans,jeans,main: 100% cotton,no,IND,32/34,
Kestrel,KL-8101,Identity Test Jeans,jeans,main: 100% cotton,no,IND,32/34,
`
const ID_2 = `${HEAD},gtin,color_code,size,size_length
Kestrel,KL-8101,Identity Test Jeans,jeans,main: 100% cotton,no,2000810101018,IND,32,32
Kestrel,KL-8101,Identity Test Jeans,jeans,main: 100% cotton,no,2000810101025,IND,32,34
Kestrel,KL-8101,Identity Test Jeans,jeans,main: 100% cotton,no,2000810101032,IND,32/34,
`
const ID_3 = `brand,style_number,name:en,gtin,color_code,size,size_length
Kestrel,KL-8101,Identity Test Jeans,2000810101018,IND,33,32
`
const ID_4 = `brand,style_number,name:en,gtin,color_code,size,size_length
Kestrel,KL-8101,Identity Test Jeans,2000100101025,IND,36,32
`

const variantsOf = (style: string) => db().variants.filter((v) => v.data.product_external_id === style).sort((a, b) => (a.external_id < b.external_id ? -1 : 1))

describe('variant identity (import-format.md §1.2.1)', () => {
  beforeEach(() => resetDb())

  it('gives the Kestrel sizes their default ids, not their EANs', () => {
    expect(variantsOf('KO-1001').map((v) => v.external_id)).toContain('KO-1001-NVY-M')
    expect(db().variants.some((v) => /^\d+$/.test(v.external_id))).toBe(false)
  })

  it('follows id-1 … id-4: default ids, a late EAN, an EAN that finds its size, an EAN of another article', () => {
    const one = applyImport(db(), { csv: ID_1 })
    expect(variantsOf('KL-8101').map((v) => v.external_id)).toEqual(['KL-8101-IND-32-32', 'KL-8101-IND-32-34', 'KL-8101-IND-32_34'])
    expect(one.errors.filter((e) => e.severity === 'error')).toEqual([expect.objectContaining({ row: 4, column: 'variant_id', obx_error: 'validation_failed', value: 'KL-8101-IND-32_34' })])
    const ids = variantsOf('KL-8101').map((v) => v.id)

    const two = applyImport(db(), { csv: ID_2 })
    expect(two.errors.filter((e) => e.severity === 'error')).toEqual([])
    expect(variantsOf('KL-8101').map((v) => [v.external_id, v.data.gtin])).toEqual([
      ['KL-8101-IND-32-32', '2000810101018'],
      ['KL-8101-IND-32-34', '2000810101025'],
      ['KL-8101-IND-32_34', '2000810101032'],
    ])

    applyImport(db(), { csv: ID_3 })
    const found = variantsOf('KL-8101').find((v) => v.data.gtin === '2000810101018')!
    expect([found.external_id, found.data.size]).toEqual(['KL-8101-IND-32-32', '33'])

    const four = applyImport(db(), { csv: ID_4 })
    expect(four.errors.filter((e) => e.severity === 'error')).toEqual([expect.objectContaining({ row: 1, column: 'gtin', obx_error: 'gtin_conflict', value: '2000100101025' })])
    expect(variantsOf('KL-8101').map((v) => v.id)).toEqual(ids)
  })
})

describe('materials in the import (import-format.md §1.4)', () => {
  beforeEach(() => resetDb())

  it('keeps a material without a percentage, refuses a decimal comma and warns about unknown materials', () => {
    const csv = `${HEAD},color_code,size
Kestrel,KL-8201,Leather Tote,bag,outer: leather; lining: 100% cotton,yes,BLK,ONE SIZE
Kestrel,KL-8202,Comma Tee,t_shirt,"95,5% cotton, 4,5% elastane",no,WHT,M
Kestrel,KL-8203,Dutch Tee,t_shirt,"main: 50% katoen, 50% co",no,WHT,M
`
    const out = applyImport(db(), { csv })
    const tote = db().products.find((p) => p.external_id === 'KL-8201')!
    expect(tote.data.materials[0].fibers[0]).toEqual({ material: { code: 'leather' }, percentage: null, qualifiers: [] })
    expect(variantsOf('KL-8201').map((v) => v.external_id)).toEqual(['KL-8201-BLK-ONE SIZE'])
    const comma = out.errors.find((e) => e.row === 2)!
    expect(comma).toMatchObject({ severity: 'error', column: 'materials', obx_error: 'validation_failed' })
    expect(comma.detail.startsWith('materials: decimal comma')).toBe(true)
    expect(db().products.some((p) => p.external_id === 'KL-8202')).toBe(false)
    expect(out.errors.filter((e) => e.obx_error === 'material_unknown').map((e) => [e.row, e.severity, e.column, e.value])).toEqual([
      [3, 'warning', 'materials', 'katoen'],
      [3, 'warning', 'materials', 'co'],
    ])
    // No percentage warning for the tote: its outer part states none.
    expect(out.errors.filter((e) => e.row === 1 && e.obx_error === 'fibre_percentages_not_100')).toEqual([])
  })
})
