// Recommended vocabularies from the spec (docs/protocol.md, docs/import-format.md). The UI
// shows translated labels (locale keys enum.*); stored values are always these keys.

export const ITEM_TYPES = [
  't_shirt', 'top', 'shirt', 'blouse', 'polo', 'sweater', 'cardigan', 'hoodie', 'sweatshirt', 'vest', 'jacket', 'coat', 'blazer', 'suit',
  'dress', 'skirt', 'trousers', 'jeans', 'shorts', 'jumpsuit', 'leggings', 'underwear', 'lingerie', 'nightwear', 'swimwear', 'socks',
  'shoes', 'sneakers', 'boots', 'sandals', 'bag', 'backpack', 'luggage', 'wallet', 'belt', 'hat', 'cap', 'scarf', 'gloves', 'tie', 'jewelry', 'watch',
  'eyewear', 'accessory', 'home', 'generic_product',
] as const

export const TARGET_GROUPS = ['women', 'men', 'unisex', 'girls', 'boys', 'kids', 'baby'] as const

export const ROLES = ['packshot', 'model', 'detail', 'ghost', 'flatlay', 'scene', 'swatch', 'size_chart', 'other'] as const

export const VIEWS = ['front', 'back', 'side', 'left', 'right', 'top', 'bottom', 'tilted_left', 'tilted_right', 'inside', 'detail', 'other'] as const

export const CHANNELS = ['webshop', 'marketplace', 'social', 'print'] as const

export const PARTS = ['main', 'outer', 'lining', 'filling', 'padding', 'trim', 'pocket_lining', 'shell', 'handle', 'strap', 'upper', 'sole', 'insole'] as const

/** Fibre keys (Annex I of Reg. (EU) No 1007/2011 where one exists). The 0.1 keys recycled_* and
 *  organic_* stay here for labels only; new data has the fibre with a flag (lib/materials.ts). */
export const FIBRES = [
  'cotton', 'organic_cotton', 'recycled_cotton', 'linen', 'hemp', 'silk', 'wool', 'merino_wool', 'lambswool', 'cashmere', 'alpaca', 'mohair',
  'viscose', 'lyocell', 'modal', 'cupro', 'acetate', 'polyester', 'recycled_polyester', 'polyamide', 'recycled_polyamide', 'elastane',
  'acrylic', 'polypropylene', 'polyurethane', 'leather', 'suede', 'down', 'feather', 'rubber', 'metal', 'other',
] as const

export const CARE_GROUPS = {
  washing: ['wash_95', 'wash_70', 'wash_60', 'wash_60_mild', 'wash_50', 'wash_50_mild', 'wash_40', 'wash_40_mild', 'wash_40_very_mild', 'wash_30', 'wash_30_mild', 'wash_30_very_mild', 'hand_wash', 'do_not_wash'],
  bleaching: ['bleach_any', 'bleach_oxygen_only', 'do_not_bleach'],
  tumble: ['tumble_dry_normal', 'tumble_dry_low', 'do_not_tumble_dry'],
  drying: ['line_dry', 'drip_line_dry', 'dry_flat', 'drip_dry_flat', 'line_dry_shade', 'drip_line_dry_shade', 'dry_flat_shade', 'drip_dry_flat_shade'],
  ironing: ['iron_high', 'iron_medium', 'iron_low', 'do_not_iron'],
  professional: ['dry_clean_p', 'dry_clean_p_mild', 'dry_clean_p_very_mild', 'dry_clean_f', 'dry_clean_f_mild', 'dry_clean_f_very_mild', 'do_not_dry_clean', 'wet_clean_w', 'wet_clean_w_mild', 'wet_clean_w_very_mild', 'do_not_wet_clean'],
} as const

export const CARE_CODES = Object.values(CARE_GROUPS).flat()

// ---------------------------------------------------------------- article data (spec 0.2, protocol.md §5.9)

/** Recommended item_subtype keys per item_type. */
export const ITEM_SUBTYPES = {
  bag: ['handbag', 'shoulder_bag', 'crossbody', 'tote', 'clutch', 'belt_bag', 'backpack', 'laptop_bag', 'briefcase', 'weekender', 'toiletry_bag', 'wallet', 'card_holder'],
  luggage: ['underseat', 'cabin', 'check_in_medium', 'check_in_large', 'pilot_case', 'garment_bag', 'duffel'],
  shoes: ['sneaker', 'running', 'hiking', 'lace_up', 'loafer', 'pump', 'sandal', 'slipper', 'ankle_boot', 'boot', 'knee_boot'],
} as const satisfies Record<string, readonly string[]>

export const ALL_ITEM_SUBTYPES = [...new Set(Object.values(ITEM_SUBTYPES).flat())]

/** Directive 94/11/EC: the three parts of a shoe and the four material categories. */
export const FOOTWEAR_PARTS = ['upper', 'lining_and_sock', 'outer_sole'] as const
export const FOOTWEAR_MATERIALS = ['leather', 'coated_leather', 'textile', 'other'] as const

export const COLOUR_FAMILIES = ['black', 'white', 'grey', 'beige', 'brown', 'red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'gold', 'silver', 'multicolour', 'transparent'] as const

/** The feature registry (protocol.md §5.9.4), in display order. */
export const FEATURES = {
  shell: { type: 'enum', values: ['hard', 'soft', 'hybrid'] },
  wheels: { type: 'integer', values: [0, 2, 4, 8] },
  lock: { type: 'enum', values: ['none', 'combination', 'tsa_combination', 'tsa_key', 'key'] },
  expandable: { type: 'boolean' },
  closure: { type: 'enum', values: ['zip', 'magnet', 'flap', 'buckle', 'drawstring', 'button', 'hook_and_loop', 'laces', 'slip_on', 'open'] },
  laptop_compartment: { type: 'boolean' },
  water_resistance: { type: 'enum', values: ['none', 'water_repellent', 'waterproof'] },
  detachable_parts: { type: 'list', values: ['shoulder_strap', 'handle', 'lining', 'insole', 'hood', 'belt', 'pouch', 'wheels'] },
  adjustable_parts: { type: 'list', values: ['shoulder_strap', 'waist', 'hem', 'cuff'] },
  fit: { type: 'enum', values: ['slim', 'regular', 'relaxed', 'oversized'] },
  sleeve_length: { type: 'enum', values: ['sleeveless', 'short', 'three_quarter', 'long'] },
  neckline: { type: 'enum', values: ['crew', 'v_neck', 'collar', 'hood', 'turtleneck', 'boat', 'scoop'] },
} as const

export type FeatureKey = keyof typeof FEATURES
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[]

/** Measurement keys in the import format's column order (import-format.md §1.2). */
export const MEASUREMENTS = ['height_cm', 'width_cm', 'depth_cm', 'weight_kg', 'volume_l', 'volume_expanded_l', 'handle_drop_cm', 'strap_length_cm', 'laptop_max_inch', 'heel_height_cm', 'shaft_height_cm', 'inseam_cm'] as const
export type MeasurementKey = (typeof MEASUREMENTS)[number]

/**
 * Certification schemes are shown by their own names in every language (they are brands of
 * their scheme owners, not words to translate). Unknown schemes are shown upper-cased.
 */
export const CERTIFICATION_NAMES: Record<string, string> = {
  gots: 'GOTS',
  ocs: 'OCS',
  grs: 'GRS',
  rcs: 'RCS',
  oeko_tex_standard_100: 'OEKO-TEX® STANDARD 100',
  oeko_tex_made_in_green: 'MADE IN GREEN by OEKO-TEX®',
  bluesign: 'bluesign®',
  fsc: 'FSC®',
  lwg: 'LWG',
  rws: 'RWS',
  rds: 'RDS',
}

export const certificationName = (scheme: string) => CERTIFICATION_NAMES[scheme] ?? scheme.replace(/_/g, ' ').toUpperCase()

/** Item types the label rules treat as textile or footwear (import-format.md rule 10). */
export const TEXTILE_ITEM_TYPES = [
  't_shirt', 'top', 'shirt', 'blouse', 'polo', 'sweater', 'cardigan', 'hoodie', 'sweatshirt', 'vest', 'jacket', 'coat', 'blazer', 'suit',
  'dress', 'skirt', 'trousers', 'jeans', 'shorts', 'jumpsuit', 'leggings', 'underwear', 'lingerie', 'nightwear', 'swimwear', 'socks',
  'hat', 'cap', 'scarf', 'gloves', 'tie', 'bag', 'backpack', 'luggage',
] as const
export const FOOTWEAR_ITEM_TYPES = ['shoes', 'sneakers', 'boots', 'sandals'] as const

/** Label completeness warning codes (Common.json WarningCode). */
export const WARNING_CODES = ['fibre_composition_missing', 'animal_origin_unknown', 'footwear_materials_missing', 'fibre_percentages_not_100'] as const
export type WarningCodeKey = (typeof WARNING_CODES)[number]
