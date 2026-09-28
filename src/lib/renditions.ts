// Client-side renditions for nodes without an image library (Settings.node.renditions_server_generated
// = false, e.g. Cloudflare Workers). Rules (spec docs/protocol.md §5.5):
//   web    JPEG, sRGB, longest side <= 2000 px, never upscaled, transparency flattened on white
//   square the web image centred on a white square whose side is the longest side of web
//   thumb  JPEG, longest side <= 600 px, never upscaled
// The original bytes are never touched (embedded C2PA survives).

export const WEB_MAX = 2000
export const THUMB_MAX = 600
export const JPEG_QUALITY = 0.86

export interface Size {
  width: number
  height: number
}

/** Fit inside a box of `max` on the longest side without upscaling. */
export function fit(src: Size, max: number): Size {
  const longest = Math.max(src.width, src.height)
  if (longest <= max) return { width: src.width, height: src.height }
  const s = max / longest
  return { width: Math.max(1, Math.round(src.width * s)), height: Math.max(1, Math.round(src.height * s)) }
}

export interface RenditionPlan {
  web: Size
  square: Size & { offsetX: number; offsetY: number; inner: Size }
  thumb: Size
}

export function planRenditions(original: Size): RenditionPlan {
  const web = fit(original, WEB_MAX)
  const side = Math.max(web.width, web.height)
  return {
    web,
    square: {
      width: side,
      height: side,
      inner: web,
      offsetX: Math.floor((side - web.width) / 2),
      offsetY: Math.floor((side - web.height) / 2),
    },
    thumb: fit(original, THUMB_MAX),
  }
}

export interface GeneratedRendition {
  blob: Blob
  width: number
  height: number
}

export interface GeneratedRenditions {
  original: Size
  web: GeneratedRendition
  square: GeneratedRendition
  thumb: GeneratedRendition
}

type Drawable = ImageBitmap | HTMLImageElement

async function decode(file: Blob): Promise<{ img: Drawable; size: Size; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file)
      return { img: bmp, size: { width: bmp.width, height: bmp.height }, close: () => bmp.close() }
    } catch {
      /* fall back to <img> (e.g. older Safari with some types) */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { img, size: { width: img.naturalWidth, height: img.naturalHeight }, close: () => URL.revokeObjectURL(url) }
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('decode_failed')
  }
}

async function render(img: Drawable, canvasSize: Size, draw: Size & { x: number; y: number }): Promise<Blob> {
  const useOffscreen = typeof OffscreenCanvas !== 'undefined'
  const canvas = useOffscreen
    ? new OffscreenCanvas(canvasSize.width, canvasSize.height)
    : Object.assign(document.createElement('canvas'), canvasSize)
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('canvas_unavailable')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, draw.x, draw.y, draw.width, draw.height)
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode_failed'))), 'image/jpeg', JPEG_QUALITY),
    )
  }
  return (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY })
}

/** Decode an image and produce web, square and thumb JPEGs in the browser. */
export async function generateRenditions(file: Blob): Promise<GeneratedRenditions> {
  const { img, size, close } = await decode(file)
  try {
    const plan = planRenditions(size)
    const web = await render(img, plan.web, { x: 0, y: 0, ...plan.web })
    const square = await render(img, plan.square, { x: plan.square.offsetX, y: plan.square.offsetY, ...plan.square.inner })
    const thumb = await render(img, plan.thumb, { x: 0, y: 0, ...plan.thumb })
    return {
      original: size,
      web: { blob: web, ...plan.web },
      square: { blob: square, width: plan.square.width, height: plan.square.height },
      thumb: { blob: thumb, ...plan.thumb },
    }
  } finally {
    close()
  }
}

/** Only read the pixel size (for originals when the node renders renditions itself). */
export async function imageSize(file: Blob): Promise<Size | null> {
  try {
    const { size, close } = await decode(file)
    close()
    return size
  } catch {
    return null
  }
}
