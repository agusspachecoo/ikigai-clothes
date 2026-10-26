// ============================================================
// Cotización de envío server-side + token firmado.
//
// El navegador ya no manda un precio de envío "a confiar". `cotizar-envio`
// firma cada opción con HMAC-SHA256 y `crear-orden` valida:
//   - emisor y expiración;
//   - que el CP coincida;
//   - que el hash del carrito coincida;
//   - que el costo/carrier/servicio no hayan sido alterados.
//
// El secreto vive en SHIPPING_QUOTE_SECRET (Edge Functions secrets).
// ============================================================

export const ORIGEN_CP = '3360'
export const QUOTE_TTL_MS = 15 * 60 * 1000

const COSTO_BULTO_ADICIONAL = 1200

interface Zona {
  nombre: string
  prefijos: string[]
  domicilio: number
  sucursal: number
  dias: [number, number]
}

const ZONAS: Zona[] = [
  { nombre: 'Local (Misiones)', prefijos: ['33'], domicilio: 3500, sucursal: 2200, dias: [1, 2] },
  { nombre: 'Litoral', prefijos: ['30', '31', '32', '34', '35', '36', '37', '50', '51'], domicilio: 5800, sucursal: 3800, dias: [2, 4] },
  { nombre: 'Norte', prefijos: ['40', '41', '42', '43', '44', '45', '46', '47', '48', '49'], domicilio: 8900, sucursal: 5400, dias: [3, 5] },
  { nombre: 'Cuyo', prefijos: ['52', '53', '54', '55', '56', '57'], domicilio: 11500, sucursal: 6900, dias: [4, 6] },
  { nombre: 'Interior', prefijos: ['60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79'], domicilio: 13900, sucursal: 8200, dias: [5, 8] },
  { nombre: 'Buenos Aires', prefijos: ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '80', '81', '82'], domicilio: 8900, sucursal: 5400, dias: [2, 4] },
  { nombre: 'Patagonia norte', prefijos: ['83', '84'], domicilio: 13900, sucursal: 8200, dias: [5, 8] },
  { nombre: 'Patagonia', prefijos: ['85', '86', '87', '88', '89', '90', '91', '92', '93', '94'], domicilio: 17500, sucursal: 10500, dias: [7, 12] },
]

const PROVINCIAS: Record<string, string> = {
  '10': 'Ciudad Autónoma de Buenos Aires', '11': 'Ciudad Autónoma de Buenos Aires',
  '12': 'Ciudad Autónoma de Buenos Aires', '13': 'Ciudad Autónoma de Buenos Aires',
  '14': 'Ciudad Autónoma de Buenos Aires', '15': 'Ciudad Autónoma de Buenos Aires',
  '16': 'Ciudad Autónoma de Buenos Aires', '17': 'Ciudad Autónoma de Buenos Aires',
  '18': 'Ciudad Autónoma de Buenos Aires', '19': 'Ciudad Autónoma de Buenos Aires',
  '20': 'Santa Fe', '21': 'Buenos Aires', '22': 'Buenos Aires', '23': 'Buenos Aires',
  '24': 'Buenos Aires', '25': 'Buenos Aires', '26': 'Buenos Aires', '27': 'Buenos Aires',
  '28': 'Buenos Aires', '29': 'Buenos Aires', '30': 'Santa Fe', '31': 'Entre Ríos',
  '32': 'Entre Ríos', '33': 'Misiones', '34': 'Corrientes', '35': 'Chaco', '36': 'Formosa',
  '37': 'Formosa', '38': 'Chaco', '40': 'Tucumán', '41': 'Chaco', '42': 'Santiago del Estero',
  '43': 'Santiago del Estero', '44': 'Salta', '45': 'Salta', '46': 'Jujuy', '47': 'Catamarca',
  '48': 'La Rioja', '49': 'La Rioja', '50': 'Santa Fe', '51': 'Santa Fe', '52': 'Mendoza',
  '53': 'La Rioja', '54': 'San Juan', '55': 'Mendoza', '56': 'San Luis', '57': 'San Luis',
  '60': 'Entre Ríos', '61': 'Entre Ríos', '70': 'Corrientes', '76': 'Buenos Aires',
  '80': 'Buenos Aires', '83': 'Neuquén', '84': 'Río Negro', '85': 'Chubut', '86': 'Santa Cruz',
  '87': 'Santa Cruz', '88': 'Santa Cruz', '89': 'Santa Cruz', '90': 'Chubut', '91': 'Chubut',
  '92': 'Chubut', '93': 'Tierra del Fuego', '94': 'Tierra del Fuego',
}

export interface OpcionEnvio {
  id_servicio: string | null
  correo_id: string | null
  carrier: { id: number | null; name: string; rating: number | null; logo: string | null }
  service_type: { code: string | null; name: string }
  costo: number
  tiempo_estimado: string | null
  modalidad: string | null
  despacho: string | null
  horas_entrega: number | null
  cumplimiento: number | null
  anomalos: number | null
  logistic_type: string | null
  estimado: {
    minimo_dias: number | null
    maximo_dias: number | null
    estimado: string | null
    leyenda: string
  }
  tags: string[]
  selectable: boolean
  quote_token?: string
}

export interface ResultadoCotizacion {
  codigo_postal: string
  origen_cp: string
  provincia: string
  destino: { city: string | null; state: string | null } | null
  paquetes: string
  peso: number
  opciones: OpcionEnvio[]
  mock: boolean
  error?: string
}

export interface QuotePayload {
  v: 1
  cp: string
  items_hash: string
  costo: number
  carrier: string
  carrier_id: number | null
  servicio: string
  service_type: string
  logistic_type: string | null
  tiempo: string | null
  mock: boolean
  exp: number
}

export interface ItemCarrito {
  producto_id: string
  talle?: string
  cantidad: number
}

function enc(texto: string): Uint8Array {
  return new TextEncoder().encode(texto)
}

// `crypto.subtle` del DOM exige `ArrayBuffer` (no `SharedArrayBuffer`).
// Copiamos a un buffer propio para que el mismo archivo typechequee tanto en
// Deno como en el tsconfig del frontend, que usa los tipos del DOM.
function aBuffer(bytes: Uint8Array): ArrayBuffer {
  const copia = new Uint8Array(bytes.byteLength)
  copia.set(bytes)
  return copia.buffer as ArrayBuffer
}

function b64url(bytes: Uint8Array): string {
  let binario = ''
  for (const byte of bytes) binario += String.fromCharCode(byte)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deB64url(texto: string): Uint8Array {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binario, (c) => c.charCodeAt(0))
}

export function normalizarCp(cp: unknown): string {
  return String(cp ?? '').trim().replace(/\D/g, '').slice(0, 8)
}

export function provinciaPorCp(cp: string): string {
  const limpio = normalizarCp(cp)
  return PROVINCIAS[limpio.slice(0, 2)] ?? PROVINCIAS[limpio[0] ?? ''] ?? 'Destino'
}

export async function hashCarrito(items: ItemCarrito[]): Promise<string> {
  const normalizados = items
    .map((i) => ({
      producto_id: String(i.producto_id),
      talle: String(i.talle ?? '').trim(),
      cantidad: Math.max(1, Math.floor(Number(i.cantidad) || 0)),
    }))
    .sort((a, b) =>
      `${a.producto_id}:${a.talle}`.localeCompare(`${b.producto_id}:${b.talle}`),
    )
  const digest = await crypto.subtle.digest('SHA-256', aBuffer(enc(JSON.stringify(normalizados))))
  return b64url(new Uint8Array(digest))
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    aBuffer(enc(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function firmarCotizacion(
  payload: QuotePayload,
  secret: string,
): Promise<string> {
  const cuerpo = b64url(enc(JSON.stringify(payload)))
  const firma = await crypto.subtle.sign('HMAC', await hmacKey(secret), aBuffer(enc(cuerpo)))
  return `${cuerpo}.${b64url(new Uint8Array(firma))}`
}

export async function verificarCotizacion(
  token: unknown,
  secret: string,
): Promise<QuotePayload | null> {
  if (secret.length < 32) return null
  if (typeof token !== 'string' || token.length > 4096 || !token.includes('.')) return null
  const [cuerpo, firma] = token.split('.')
  if (!cuerpo || !firma) return null

  try {
    const ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      aBuffer(deB64url(firma)),
      aBuffer(enc(cuerpo)),
    )
    if (!ok) return null

    const payload = JSON.parse(new TextDecoder().decode(deB64url(cuerpo))) as QuotePayload
    if (payload?.v !== 1) return null
    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null
    if (!Number.isFinite(payload.costo) || payload.costo < 0) return null
    return payload
  } catch {
    return null
  }
}

function zonaPorCP(cp: string): Zona {
  const candidatas = ZONAS.flatMap((z) =>
    z.prefijos
      .filter((p) => cp.startsWith(p))
      .map((p) => ({ zona: z, largo: p.length })),
  ).sort((a, b) => b.largo - a.largo)

  return candidatas[0]?.zona ?? ZONAS[ZONAS.length - 1]!
}

function costoZona(zona: Zona, bultos: number, modalidad: 'domicilio' | 'sucursal'): number {
  return zona[modalidad] + (Math.max(1, bultos) - 1) * COSTO_BULTO_ADICIONAL
}

function opcionLocal(
  zona: Zona,
  modalidad: 'domicilio' | 'sucursal',
  costo: number,
): OpcionEnvio {
  const domicilio = modalidad === 'domicilio'
  return {
    id_servicio: `local-${zona.nombre.toLowerCase().replace(/\s+/g, '-')}-${modalidad}`,
    correo_id: 'LOCAL',
    carrier: { id: null, name: 'Correo Argentino', rating: null, logo: null },
    service_type: {
      code: domicilio ? 'DOMICILIO' : 'SUCURSAL',
      name: domicilio ? 'Entrega a Domicilio' : 'Retiro en Sucursal',
    },
    costo,
    tiempo_estimado: `${zona.dias[0]} a ${zona.dias[1]} días hábiles`,
    modalidad,
    despacho: null,
    horas_entrega: zona.dias[1] * 24,
    cumplimiento: null,
    anomalos: null,
    logistic_type: domicilio ? 'PUERTA_A_PUERTA' : 'CORREO_POR_RECOGER',
    estimado: {
      minimo_dias: zona.dias[0],
      maximo_dias: zona.dias[1],
      estimado: null,
      leyenda: `${zona.dias[0]} a ${zona.dias[1]} días hábiles`,
    },
    tags: [],
    selectable: true,
  }
}

export function marcarTags(opciones: OpcionEnvio[]): void {
  if (opciones.length === 0) return
  const menorCosto = Math.min(...opciones.map((o) => o.costo))
  const menoresHoras = Math.min(...opciones.map((o) => o.horas_entrega ?? Infinity))
  for (const o of opciones) {
    if (o.costo <= menorCosto) o.tags.push('cheapest')
    if ((o.horas_entrega ?? Infinity) <= menoresHoras) o.tags.push('fastest')
  }
}

export function cotizarLocal(cp: string, bultos: number): ResultadoCotizacion {
  const limpio = normalizarCp(cp)
  const cantidad = Math.max(1, bultos)
  const peso = Number(((cantidad * 300) / 1000).toFixed(2))
  const provincia = provinciaPorCp(limpio)

  if (limpio.length < 4) {
    return {
      codigo_postal: limpio,
      origen_cp: ORIGEN_CP,
      provincia,
      destino: null,
      paquetes: '',
      peso,
      opciones: [],
      mock: true,
      error: 'El código postal debe tener al menos 4 dígitos.',
    }
  }

  if (limpio === ORIGEN_CP) {
    return {
      codigo_postal: limpio,
      origen_cp: ORIGEN_CP,
      provincia,
      destino: { city: null, state: provincia },
      paquetes: `${cantidad} bulto${cantidad === 1 ? '' : 's'} de 30×20×5 cm`,
      peso,
      opciones: [{
        id_servicio: 'local-obera-gratis',
        correo_id: 'LOCAL',
        carrier: { id: null, name: 'Envío gratis', rating: null, logo: null },
        service_type: { code: 'GRATIS', name: 'Envío gratis' },
        costo: 0,
        tiempo_estimado: 'Inmediato',
        modalidad: 'domicilio',
        despacho: null,
        horas_entrega: 0,
        cumplimiento: null,
        anomalos: null,
        logistic_type: 'PUERTA_A_PUERTA',
        estimado: { minimo_dias: 0, maximo_dias: 0, estimado: null, leyenda: 'Inmediato' },
        tags: ['cheapest', 'fastest'],
        selectable: true,
      }],
      mock: true,
    }
  }

  const zona = zonaPorCP(limpio)
  const opciones = [
    opcionLocal(zona, 'domicilio', costoZona(zona, cantidad, 'domicilio')),
    opcionLocal(zona, 'sucursal', costoZona(zona, cantidad, 'sucursal')),
  ]
  marcarTags(opciones)

  return {
    codigo_postal: limpio,
    origen_cp: ORIGEN_CP,
    provincia,
    destino: { city: null, state: provincia },
    paquetes: `${cantidad} bulto${cantidad === 1 ? '' : 's'} de 30×20×5 cm`,
    peso,
    opciones,
    mock: true,
  }
}

interface RateMicorreo {
  deliveredType?: string
  productType?: string
  productName?: string
  price?: number
  costo?: number | null
  tiempo_estimado?: string | null
  deliveryTimeMin?: number | string | null
  deliveryTimeMax?: number | string | null
}

function aDias(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

function esClasico(rate: RateMicorreo): boolean {
  return rate.productType === 'CP' || /cl[aá]sico/i.test(rate.productName ?? '')
}

function rateAOpcion(rate: RateMicorreo): OpcionEnvio | null {
  const bruto = rate.price ?? rate.costo
  if (bruto === null || bruto === undefined) return null
  const precio = Number(bruto)
  if (!Number.isFinite(precio) || precio < 0) return null

  const min = aDias(rate.deliveryTimeMin)
  const max = aDias(rate.deliveryTimeMax)
  const leyenda = min !== null
    ? max !== null && max !== min
      ? `${min} a ${max} días hábiles`
      : `${min} ${min === 1 ? 'día' : 'días'} hábiles`
    : rate.tiempo_estimado ?? ''

  const domicilio = rate.deliveredType !== 'S'
  return {
    id_servicio: `micorreo-${domicilio ? 'd' : 's'}`,
    correo_id: 'CORREO_ARGENTINO',
    carrier: {
      id: null,
      name: (rate.productName?.trim() || 'Correo Argentino').replace(/Clasico/g, 'Clásico'),
      rating: null,
      logo: null,
    },
    service_type: {
      code: domicilio ? 'DOMICILIO' : 'SUCURSAL',
      name: domicilio ? 'Entrega a Domicilio' : 'Retiro en Sucursal',
    },
    costo: precio,
    tiempo_estimado: leyenda || null,
    modalidad: domicilio ? 'domicilio' : 'sucursal',
    despacho: null,
    horas_entrega: max !== null ? max * 24 : min !== null ? min * 24 : null,
    cumplimiento: null,
    anomalos: null,
    logistic_type: domicilio ? 'PUERTA_A_PUERTA' : 'CORREO_POR_RECOGER',
    estimado: {
      minimo_dias: min,
      maximo_dias: max,
      estimado: null,
      leyenda: leyenda || 'Entrega a confirmar',
    },
    tags: [],
    selectable: true,
  }
}

export function cotizarConRates(
  cp: string,
  bultos: number,
  rates: RateMicorreo[],
): ResultadoCotizacion | null {
  const opciones = rates
    .filter(esClasico)
    .map(rateAOpcion)
    .filter((o): o is OpcionEnvio => o !== null)

  if (opciones.length === 0) return null
  marcarTags(opciones)

  const provincia = provinciaPorCp(cp)
  return {
    codigo_postal: normalizarCp(cp),
    origen_cp: ORIGEN_CP,
    provincia,
    destino: { city: null, state: provincia },
    paquetes: `${bultos} bulto${bultos === 1 ? '' : 's'} de 30×20×5 cm`,
    peso: Number(((bultos * 300) / 1000).toFixed(2)),
    opciones,
    mock: false,
  }
}
