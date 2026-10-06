import type { CartItem } from '../types/cart'

// Los tipos viven en enviopack.ts y se reexportan: este módulo reemplaza solo
// la fuente del precio, no el contrato.
export type { OpcionEnvio, ResultadoCotizacion } from './enviopack'
import type { OpcionEnvio, ResultadoCotizacion } from './enviopack'
import { ORIGEN_CP, claveOpcion, nombreTransporte } from './enviopack'

export { ORIGEN_CP, claveOpcion, nombreTransporte }

// ============================================================
// IKIGAI CLOTHES - Tarifario de envío local
// ============================================================
// Reemplaza la cotización contra la API del carrier (OCA / EnvíoPack /
// Andreani). Esa API está caída o no disponible y devolvía
// "No se pudo contactar el servicio de cotización", dejando el checkout
// bloqueado.
//
// Los importes de acá son **tablas fijas estimadas**, no tarifas del
// transportista. Antes de abrir al público hay que reemplazarlos por los
// valores reales que negocie la tienda con OCA/Correo y mantenerlos en una
// tabla editable (idealmente una tabla `costos_envio` en Supabase leída por
// `config_tienda`-style, para poder cambiar precios sin redeploy).
//
// El formato de salida es el mismo `ResultadoCotizacion` que devuelve la API,
// así que la UI de Checkout y `crear-orden` no necesitan cambios.

// Cargo por cada bulto adicional al primero. El precio base por zona ya
// incluye el primer bulto (cada prenda pesa 30×20×5 cm / 300 g, medidas del PRD).
const COSTO_BULTO_ADICIONAL = 1200

// Precio del envío a domicilio por zona. La sucursal siempre sale más barato.
//
// Los prefijos siguen el CPA legacy de 4 dígitos. En Argentina los primeros
// dígitos identifican la provincia, pero ojo: la correspondencia no es
// obvious (Rosario es 2000 y es Santa Fe, no Buenos Aires; 80xx es Buenos
// Aires y no Chaco). Por eso el match es por prefijo MÁS LARGO primero, y la
// provincia se muestra como dato informativo, no como fuente del precio.
interface Zona {
  nombre: string
  /** Prefijos de CP (sin guiones) que caen en la zona. */
  prefijos: string[]
  domicilio: number
  sucursal: number
  dias: [number, number]
}

const ZONAS: Zona[] = [
  {
    // Local: el showroom está en Oberá, Misiones (CP 3360). 33xx = Misiones.
    nombre: 'Local (Misiones)',
    prefijos: ['33'],
    domicilio: 3500,
    sucursal: 2200,
    dias: [1, 2],
  },
  {
    // Litoral: Santa Fe (incluida la capital, 30xx/50xx), Entre Ríos,
    // Corrientes, Chaco y Formosa.
    nombre: 'Litoral',
    prefijos: ['30', '31', '32', '34', '35', '36', '37', '50', '51'],
    domicilio: 5800,
    sucursal: 3800,
    dias: [2, 4],
  },
  {
    // NOA: Tucumán, Salta, Jujuy, Catamarca y Santiago del Estero.
    nombre: 'Norte',
    prefijos: ['40', '41', '42', '43', '44', '45', '46', '47', '48', '49'],
    domicilio: 8900,
    sucursal: 5400,
    dias: [3, 5],
  },
  {
    // Cuyo: Mendoza, San Juan, San Luis y La Rioja.
    nombre: 'Cuyo',
    prefijos: ['52', '53', '54', '55', '56', '57'],
    domicilio: 11500,
    sucursal: 6900,
    dias: [4, 6],
  },
  {
    // Litoral norte / interior del Litoral.
    nombre: 'Interior',
    prefijos: ['60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79'],
    domicilio: 13900,
    sucursal: 8200,
    dias: [5, 8],
  },
  {
    // CABA, Buenos Aires y Bahía Blanca (80xx es Buenos Aires, no Chaco).
    nombre: 'Buenos Aires',
    prefijos: ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '80', '81', '82'],
    domicilio: 8900,
    sucursal: 5400,
    dias: [2, 4],
  },
  {
    // Neuquén y Río Negro.
    nombre: 'Patagonia norte',
    prefijos: ['83', '84'],
    domicilio: 13900,
    sucursal: 8200,
    dias: [5, 8],
  },
  {
    // Chubut, Santa Cruz y Tierra del Fuego.
    nombre: 'Patagonia',
    prefijos: ['85', '86', '87', '88', '89', '90', '91', '92', '93', '94'],
    domicilio: 17500,
    sucursal: 10500,
    dias: [7, 12],
  },
]

// Provincia por prefijo de 2 dígitos. Solo informativo (para mostrar el
// destino); el precio sale de la zona.
const NOMBRES_PROVINCIA: Record<string, string> = {
  '10': 'Ciudad Autónoma de Buenos Aires',
  '11': 'Ciudad Autónoma de Buenos Aires',
  '12': 'Ciudad Autónoma de Buenos Aires',
  '13': 'Ciudad Autónoma de Buenos Aires',
  '14': 'Ciudad Autónoma de Buenos Aires',
  '15': 'Ciudad Autónoma de Buenos Aires',
  '16': 'Ciudad Autónoma de Buenos Aires',
  '17': 'Ciudad Autónoma de Buenos Aires',
  '18': 'Ciudad Autónoma de Buenos Aires',
  '19': 'Ciudad Autónoma de Buenos Aires',
  '20': 'Santa Fe',
  '21': 'Buenos Aires',
  '22': 'Buenos Aires',
  '23': 'Buenos Aires',
  '24': 'Buenos Aires',
  '25': 'Buenos Aires',
  '26': 'Buenos Aires',
  '27': 'Buenos Aires',
  '28': 'Buenos Aires',
  '29': 'Buenos Aires',
  '30': 'Santa Fe',
  '31': 'Entre Ríos',
  '32': 'Entre Ríos',
  '33': 'Misiones',
  '34': 'Corrientes',
  '35': 'Chaco',
  '36': 'Formosa',
  '37': 'Formosa',
  '38': 'Chaco',
  '40': 'Tucumán',
  '41': 'Chaco',
  '42': 'Santiago del Estero',
  '43': 'Santiago del Estero',
  '44': 'Salta',
  '45': 'Salta',
  '46': 'Jujuy',
  '47': 'Catamarca',
  '48': 'La Rioja',
  '49': 'La Rioja',
  '50': 'Santa Fe',
  '51': 'Santa Fe',
  '52': 'Mendoza',
  '53': 'La Rioja',
  '54': 'San Juan',
  '55': 'Mendoza',
  '56': 'San Luis',
  '57': 'San Luis',
  '60': 'Entre Ríos',
  '61': 'Entre Ríos',
  '70': 'Corrientes',
  '76': 'Buenos Aires',
  '80': 'Buenos Aires',
  '83': 'Neuquén',
  '84': 'Río Negro',
  '85': 'Chubut',
  '86': 'Santa Cruz',
  '87': 'Santa Cruz',
  '88': 'Santa Cruz',
  '89': 'Santa Cruz',
  '90': 'Chubut',
  '91': 'Chubut',
  '92': 'Chubut',
  '93': 'Tierra del Fuego',
  '94': 'Tierra del Fuego',
}

/** Nombre aproximado de la provincia a partir del prefijo de 2 dígitos del CP. */
export function provinciaPorCP(cp: string): string {
  const limpio = String(cp ?? '').replace(/\D/g, '')
  const prefijo = limpio.slice(0, 2)
  return NOMBRES_PROVINCIA[prefijo] ?? NOMBRES_PROVINCIA[limpio[0] ?? ''] ?? 'Destino'
}

/**
 * Devuelve la zona tarifaria para un CP. Usa coincidencia por prefijo más
 * largo primero, para que "3360" gane sobre "33".
 */
function zonaPorCP(cp: string): Zona {
  const limpio = String(cp ?? '').replace(/\D/g, '')

  const candidatas = ZONAS.flatMap((z) =>
    z.prefijos
      .filter((p) => limpio.startsWith(p))
      .map((p) => ({ zona: z, largo: p.length })),
  ).sort((a, b) => b.largo - a.largo)

  return candidatas[0]?.zona ?? ZONAS[ZONAS.length - 1]!
}

/** Costo total del envío para `bultos` bultos en una zona y modalidad. */
export function costoEnvio(zona: Zona, bultos: number, modalidad: 'domicilio' | 'sucursal'): number {
  const n = Math.max(1, bultos)
  const base = zona[modalidad]
  return base + (n - 1) * COSTO_BULTO_ADICIONAL
}

/** Arma una `OpcionEnvio` sintética con la misma forma que devuelve la API. */
function opcion(
  zona: Zona,
  modalidad: 'domicilio' | 'sucursal',
  costo: number,
): OpcionEnvio {
  const esDomicilio = modalidad === 'domicilio'
  const etiqueta = esDomicilio ? 'Entrega a Domicilio' : 'Retiro en Sucursal'

  return {
    id_servicio: `local-${zona.nombre.toLowerCase().replace(/\s+/g, '-')}-${modalidad}`,
    correo_id: 'LOCAL',
    carrier: {
      id: null,
      // Nombre visible para el cliente. "Tarifario local" es un detalle
      // interno que no le dice nada (y rompe la idea de que el fallback sea
      // invisible): el admin igual distingue esa cotización por `mock: true`.
      name: 'Correo Argentino',
      rating: null,
      logo: null,
    },
    service_type: {
      code: esDomicilio ? 'DOMICILIO' : 'SUCURSAL',
      name: etiqueta,
    },
    costo,
    tiempo_estimado: `${zona.dias[0]} a ${zona.dias[1]} días hábiles`,
    modalidad,
    despacho: null,
    horas_entrega: zona.dias[1] * 24,
    cumplimiento: null,
    anomalos: null,
    logistic_type: esDomicilio ? 'PUERTA_A_PUERTA' : 'CORREO_POR_RECOGER',
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

/**
 * Sustituye a `cotizarEnvio`. Misma firma y mismo tipo de retorno, pero
 * resuelto contra el tarifario local en vez de una API externa.
 *
 * Es síncrona: no hay red, no hay loading, no hay timeout.
 */
export function cotizarEnvioLocal(destinoCp: string, items: CartItem[]): ResultadoCotizacion {
  const cp = String(destinoCp ?? '').replace(/\D/g, '')
  const bultos = items.reduce((n, i) => n + i.cantidad, 0)
  const peso = Number(((bultos * 300) / 1000).toFixed(2))
  const provincia = provinciaPorCP(cp)

  if (cp.length < 4) {
    return {
      codigo_postal: cp,
      origen_cp: ORIGEN_CP,
      destino: null,
      paquetes: '',
      peso,
      opciones: [],
      error: 'El código postal debe tener al menos 4 dígitos.',
    }
  }

  const zona = zonaPorCP(cp)
  const opciones = [
    opcion(zona, 'domicilio', costoEnvio(zona, bultos, 'domicilio')),
    opcion(zona, 'sucursal', costoEnvio(zona, bultos, 'sucursal')),
  ]

  // Mismo criterio de UI que la API: marcar la más barata y la más rápida.
  const menorCosto = Math.min(...opciones.map((o) => o.costo))
  const menoresHoras = Math.min(...opciones.map((o) => o.horas_entrega ?? Infinity))
  opciones.forEach((o) => {
    if (o.costo <= menorCosto) o.tags.push('cheapest')
    if ((o.horas_entrega ?? Infinity) <= menoresHoras) o.tags.push('fastest')
  })

  return {
    codigo_postal: cp,
    origen_cp: ORIGEN_CP,
    provincia,
    destino: { city: null, state: provincia },
    paquetes: `${bultos} bulto${bultos === 1 ? '' : 's'} de 30×20×5 cm`,
    peso,
    opciones,
  }
}