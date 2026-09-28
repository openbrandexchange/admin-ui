// Recommended vocabularies from the spec (docs/protocol.md, docs/import-format.md). The UI
// shows translated labels (locale keys enum.*); stored values are always these keys.

export const ITEM_TYPES = [
  't_shirt', 'top', 'shirt', 'blouse', 'polo', 'sweater', 'cardigan', 'hoodie', 'sweatshirt', 'vest', 'jacket', 'coat', 'blazer', 'suit',
  'dress', 'skirt', 'trousers', 'jeans', 'shorts', 'jumpsuit', 'leggings', 'underwear', 'lingerie', 'nightwear', 'swimwear', 'socks',
  'shoes', 'sneakers', 'boots', 'sandals', 'bag', 'backpack', 'wallet', 'belt', 'hat', 'cap', 'scarf', 'gloves', 'tie', 'jewelry', 'watch',
  'eyewear', 'accessory', 'home', 'generic_product',
] as const

export const TARGET_GROUPS = ['women', 'men', 'unisex', 'girls', 'boys', 'kids', 'baby'] as const

export const ROLES = ['packshot', 'model', 'detail', 'ghost', 'flatlay', 'scene', 'swatch', 'size_chart', 'other'] as const

export const VIEWS = ['front', 'back', 'side', 'left', 'right', 'top', 'bottom', 'tilted_left', 'tilted_right', 'inside', 'detail', 'other'] as const

export const CHANNELS = ['webshop', 'marketplace', 'social', 'print'] as const

export const PARTS = ['main', 'outer', 'lining', 'filling', 'trim', 'sole', 'upper', 'insole'] as const

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
