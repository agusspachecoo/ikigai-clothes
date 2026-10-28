export const IMAGEN_FALLBACK = `${import.meta.env.BASE_URL}placeholder-imagen.svg`

const BUCKET_IMAGENES = 'product-images'
const CARPETAS_IMAGENES = new Set([
  'productos',
  'outfits',
  'reviews',
  'comunidad',
  'showroom',
  'categorias',
  'banners',
])
const STORAGE_OBJECT = '/storage/v1/object/public/'
const STORAGE_RENDER = '/storage/v1/render/image/public/'
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')

/**
 * Normaliza una imagen dinámica de Supabase antes de pasarla a un `<img>`.
 *
 * Las filas viejas pueden guardar un nombre de archivo (`foto.jpg`), una ruta
 * con prefijo (`reviews/foto.jpg`) o una URL completa. Los previews locales
 * (`blob:`/`data:`) se respetan para no romper formularios de carga.
 */
export function obtenerUrlImagen(imagenUrlRaw: string | null): string {
  if (!imagenUrlRaw) return ''
  const limpia =
    typeof imagenUrlRaw === 'string'
      ? imagenUrlRaw.trim().replace(/^["']+|["']+$|\[|\]/g, '')
      : ''
  if (!limpia) return ''
  if (/^(blob:|data:)/i.test(limpia)) return limpia
  if (limpia.startsWith('http')) return limpia

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const pathLimpio = limpia
    .replace(/^(productos|reviews|showroom|comunidad|categorias)\//, '')
    .replace(/^\/+/, '')
  return `${supabaseUrl}/storage/v1/object/public/product-images/${pathLimpio}`
}

export interface OpcionesNormalizacionImagen {
  /** Permite testear o apuntar a otro proyecto de Supabase. */
  supabaseUrl?: string
  /** Bucket público. Por defecto `product-images`. */
  bucket?: string
  /**
   * Carpeta dentro del bucket usada cuando el valor es solo un nombre de
   * archivo (`foto.jpg`). Sin esto, el archivo se resuelve en la raíz del
   * bucket para no romper filas viejas que guardaban el path completo.
   */
  carpeta?: string
}

function limpiarSegmento(valor: string | undefined): string {
  return String(valor ?? '').trim().replace(/^\/+|\/+$/g, '')
}

function pathSinBucket(path: string, bucket = BUCKET_IMAGENES): string {
  let limpio = path.replace(/^\/+/, '')
  while (limpio.startsWith(`${bucket}/`)) {
    limpio = limpio.slice(bucket.length + 1)
  }
  return limpio
}

function urlPublica(path: string, baseUrl: string, bucket: string): string {
  return `${baseUrl}${STORAGE_OBJECT}${bucket}/${path}`
}

function normalizarRelativa(
  valor: string,
  baseUrl: string,
  bucket: string,
  carpeta?: string,
): string {
  const limpio = valor.replace(/^\/+/, '')

  for (const prefijo of [
    'storage/v1/object/public/',
    'storage/v1/render/image/public/',
  ]) {
    if (!limpio.startsWith(prefijo)) continue
    const resto = limpio.slice(prefijo.length)
    if (resto.startsWith(`${bucket}/`)) {
      return `${baseUrl}/${prefijo}${bucket}/${pathSinBucket(resto, bucket)}`
    }
    // El path ya incluye un bucket distinto: se respeta tal cual.
    return `${baseUrl}/${limpio}`
  }

  if (limpio.startsWith(`${bucket}/`)) {
    return urlPublica(pathSinBucket(limpio, bucket), baseUrl, bucket)
  }

  const primeraCarpeta = limpio.split('/')[0]
  if (CARPETAS_IMAGENES.has(primeraCarpeta)) {
    return urlPublica(limpio, baseUrl, bucket)
  }

  if (carpeta) {
    // Si la carpeta coincide con el bucket (por ejemplo bucket `reviews` y
    // carpeta `reviews`) no se duplica en el path.
    const prefijo = carpeta === bucket ? '' : `${carpeta}/`
    return urlPublica(`${prefijo}${limpio}`, baseUrl, bucket)
  }

  return urlPublica(limpio, baseUrl, bucket)
}

function esRutaStorage(valor: string): boolean {
  return (
    valor.startsWith('storage/v1/object/public/') ||
    valor.startsWith('storage/v1/render/image/public/')
  )
}

function normalizarAbsoluta(valor: string): string {
  let url: URL
  try {
    url = new URL(valor)
  } catch {
    return valor
  }

  if (!url.hostname.endsWith('.supabase.co')) return valor

  for (const prefijo of [STORAGE_OBJECT, STORAGE_RENDER]) {
    if (!url.pathname.startsWith(prefijo)) continue
    const resto = url.pathname.slice(prefijo.length)
    if (!resto.startsWith(`${BUCKET_IMAGENES}/`)) return valor
    url.pathname = `${prefijo}${BUCKET_IMAGENES}/${pathSinBucket(resto)}`
    return url.toString()
  }

  return valor
}

/**
 * Normaliza cualquier imagen a una URL usable por el navegador.
 *
 * Las filas viejas pueden guardar paths relativos, paths sin bucket o URLs con
 * `product-images/product-images/...` duplicado. Las imágenes externas,
 * `blob:` y `data:` se dejan intactas.
 */
export function normalizarUrlImagen(
  valor: string | null | undefined,
  opciones: string | OpcionesNormalizacionImagen = SUPABASE_URL,
): string {
  const limpio = valor?.trim()
  if (!limpio) return IMAGEN_FALLBACK
  if (/^(blob:|data:)/i.test(limpio)) return limpio
  if (limpio.startsWith('//')) return normalizarAbsoluta(`https:${limpio}`)
  if (/^https?:\/\//i.test(limpio)) return normalizarAbsoluta(limpio)

  const opcionesResueltas =
    typeof opciones === 'string' ? { supabaseUrl: opciones } : opciones
  const baseUrl = String(opcionesResueltas.supabaseUrl || SUPABASE_URL).replace(/\/+$/, '')
  const bucket = limpiarSegmento(opcionesResueltas.bucket) || BUCKET_IMAGENES
  const carpeta = limpiarSegmento(opcionesResueltas.carpeta) || undefined

  // Un path absoluto local (`/placeholder.svg`, `/assets/logo.png`) no es una
  // imagen de Storage. Solo se normaliza si apunta a Storage o a una carpeta
  // conocida del bucket; el resto se deja intacto.
  if (limpio.startsWith('/')) {
    const sinSlash = limpio.slice(1)
    const primeraCarpeta = sinSlash.split('/')[0]
    if (
      !esRutaStorage(sinSlash) &&
      !CARPETAS_IMAGENES.has(primeraCarpeta) &&
      !sinSlash.startsWith(`${bucket}/`)
    ) {
      return limpio
    }
  }

  return normalizarRelativa(limpio, baseUrl, bucket, carpeta)
}

export function imagenOutfit(url: string | null | undefined, indice = 0): string {
  void indice
  return normalizarUrlImagen(url, { carpeta: 'outfits' })
}

export function imagenProducto(url: string | null | undefined, indice = 0): string {
  void indice
  return normalizarUrlImagen(url, { carpeta: 'productos' })
}

/**
 * Transformación de imágenes de Supabase Storage.
 *
 * Las URLs del bucket vienen como `/storage/v1/object/public/...`. La ruta
 * `/storage/v1/render/image/public/...` redimensiona server-side y devuelve
 * webp/jpeg, así que el navegador baja la imagen del tamaño que realmente
 * necesita en vez del archivo original completo.
 *
 * Solo aplica a URLs de Storage: una imagen de Unsplash o un host externo no
 * pasan por el transformador, y ahí hay que usar `srcset` con las variantes que
 * ese proveedor ya soporta por query string.
 */
const RE_STORAGE =
  /^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/object\/public\/(.+)$/

/** Anchos que sabe generar el transformador de Supabase Storage. */
const anchosDisponibles: number[] = [160, 240, 320, 480, 640, 800, 1200, 1600]

function urlTransformada(url: string, ancho: number): string | null {
  const match = RE_STORAGE.exec(url)
  if (!match) return null
  const [, host, camino] = match
  return `${host}/storage/v1/render/image/public/${camino}?width=${ancho}&quality=75`
}

/**
 * Arma `srcset` + `sizes` para un tamaño de render dado.
 *
 * Devuelve `srcset: undefined` cuando la imagen no se puede transformar, y en
 * ese caso el `<img>` sigue funcionando con el `src` original.
 */
export function srcsetImagen(
  url: string | null | undefined,
  anchoRender: number,
  /** Para imágenes que ocupan todo el ancho (hero, banners): no se puede acotar
   *  el rango porque el mismo `<img>` se renderiza a 400px en mobile y a
   *  1900px en desktop. */
  rangoCompleto = false,
  opciones?: OpcionesNormalizacionImagen,
): { srcset?: string; sizes: string } {
  const sizes = rangoCompleto
    ? '100vw'
    : anchoRender <= 128
      ? '128px'
      : anchoRender <= 160
        ? '160px'
        : anchoRender <= 320
          ? '320px'
          : anchoRender <= 640
            ? '(max-width: 768px) 50vw, 320px'
            : '(max-width: 1024px) 33vw, 420px'

  const normalizada = normalizarUrlImagen(url, opciones)

  // Se ofrecen anchos desde el primero que cubre el render hasta el doble (por
  // pantallas retina). Sin el piso mínimo, un thumbnail de 64px descargaba una
  // variante de 1200px; sin el techo, una card de 320px ofrecía cinco archivos
  // que el navegador nunca iba a elegir.
  const metaAncho = Math.round(anchoRender)
  const cubre = anchosDisponibles.find((a) => a >= metaAncho)
  const minimo = rangoCompleto
    ? anchosDisponibles[0]
    : metaAncho < 160
      ? 160
      : (cubre ?? anchosDisponibles[anchosDisponibles.length - 1])
  const maximo = rangoCompleto
    ? anchosDisponibles[anchosDisponibles.length - 1]
    : Math.max(minimo, metaAncho * 2)

  const candidatas = anchosDisponibles
    .filter((a) => a >= minimo && a <= maximo)
    .map((a) => ({ a, url: urlTransformada(normalizada, a) }))
    .filter((c) => c.url !== null)

  if (candidatas.length === 0) return { sizes }

  return {
    srcset: candidatas.map((c) => `${c.url} ${c.a}w`).join(', '),
    sizes,
  }
}
