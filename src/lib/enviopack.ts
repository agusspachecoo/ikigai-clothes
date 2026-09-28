import type { CartItem } from '../types/cart'

// Cotización de envíos (OCA). Body esperado por la Edge Function:
//   { postal_code, weight (kg), height, width, length, bultos, valor_declarado }
// La Edge Function de cotización se llama `oca-envio`; si algún día se vuelve
// a Andreani (`andreani-envio`) o EnvíoPack (`enviopack-envio`) basta con
// cambiar la constante `ENDPOINT_ENVIO`.
const ENDPOINT_ENVIO = 'oca-envio'

// Paquete por defecto por unidad: 30 × 20 × 5 cm / 300 g (medidas del PRD)
const DEF_LARGO_CM = 30
const DEF_ANCHO_CM = 20
const DEF_ALTO_CM = 5
const DEF_PESO_G = 300

export interface OpcionEnvio {
  id_servicio: string | null
  correo_id: string | null
  carrier: {
    id: number | null
    name: string
    rating: number | null
    logo: string | null
  }
  service_type: {
    code: string | null
    name: string
  }
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
}

export interface ResultadoCotizacion {
  codigo_postal: string
  origen_cp?: string | null
  provincia?: string | null
  destino: { city: string | null; state: string | null } | null
  paquetes: string
  peso: number | null
  opciones: OpcionEnvio[]
  mock?: boolean
  error?: string
}

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '')
const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`

// Código postal de despacho del local (origen). Metadata de la cotización y la orden.
export const ORIGEN_CP = String(
  import.meta.env.VITE_ENVIOPACK_ORIGEN_CP ?? import.meta.env.VITE_ZIPPIN_ORIGIN_CP ?? '',
)
  .trim()
  .replace(/\D/g, '')

// Nombre amigable del transporte: prioriza carrier.name (el nombre específico
// que devuelve EnvíoPack, ej. Andreani / Correo Argentino / OCA) y cae a correo_id
// si la API no trajera nombre.
export function nombreTransporte(
  opcion: OpcionEnvio | null | undefined,
  fallback = 'Transporte',
): string {
  const nombre = opcion?.carrier?.name?.trim()
  if (nombre) return nombre
  return opcion?.correo_id?.trim() || opcion?.id_servicio?.trim() || fallback
}

// Clave única de una opción de envío. Un mismo transporte puede ofrecer varios
// servicios (ej. OCA: a domicilio, a sucursal, desde sucursal), así que NO se
// usa carrier.name (se pisarían) sino el id_servicio, único por servicio.
export function claveOpcion(opcion: OpcionEnvio | null | undefined): string {
  if (!opcion) return ''
  return opcion.id_servicio ||
    `${opcion.carrier.name}:${opcion.service_type.code}`
}

export async function cotizarEnvio(
  destinoCp: string,
  items: CartItem[],
): Promise<ResultadoCotizacion> {
  // Peso total en kg y cantidad total de bultos del carrito
  const totalKg = Number(
    (items.reduce((n, i) => n + i.cantidad * DEF_PESO_G, 0) / 1000).toFixed(2),
  )
  const bultos = items.reduce((n, i) => n + i.cantidad, 0)

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      codigo_postal: destinoCp,
      origen_cp: ORIGEN_CP,
      destino: null,
      paquetes: '',
      peso: totalKg,
      opciones: [],
      error: 'Falta la configuración de Supabase.',
    }
  }

  try {
    const res = await fetch(`${FUNCTIONS_URL}/${ENDPOINT_ENVIO}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        postal_code: destinoCp,
        weight: totalKg,
        height: DEF_ALTO_CM,
        width: DEF_ANCHO_CM,
        length: DEF_LARGO_CM,
        bultos,
        origen_cp: ORIGEN_CP,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg =
        res.status === 401
          ? 'No autorizado. Verificá la API Key de Supabase.'
          : (data?.error ?? 'No se pudo calcular el envío.')
      return {
        codigo_postal: destinoCp,
        origen_cp: ORIGEN_CP,
        destino: null,
        paquetes: data?.paquetes ?? '',
        peso: data?.peso ?? totalKg,
        opciones: [],
        mock: data?.mock === true,
        error: msg,
      }
    }

    const opciones: OpcionEnvio[] = data.opciones ?? []

    // Tags de conveniencia para la UI (Más barato / Más rápido)
    if (opciones.length > 0) {
      const menorCosto = Math.min(...opciones.map((o) => o.costo))
      const menoresHoras = Math.min(
        ...opciones.map((o) => (o.horas_entrega ?? Infinity)),
      )
      opciones.forEach((o) => {
        if (o.costo <= menorCosto) o.tags.push('cheapest')
        if ((o.horas_entrega ?? Infinity) <= menoresHoras) o.tags.push('fastest')
      })
    }

    return {
      codigo_postal: data.codigo_postal ?? destinoCp,
      origen_cp: data.origen_cp ?? ORIGEN_CP,
      provincia: data.provincia ?? null,
      destino: data.destino ?? null,
      paquetes: data.paquetes ?? '',
      peso: data.peso ?? totalKg,
      opciones,
      mock: data.mock === true,
    }
  } catch {
    return {
      codigo_postal: destinoCp,
      origen_cp: ORIGEN_CP,
      destino: null,
      paquetes: '',
      peso: totalKg,
      opciones: [],
      error: 'No se pudo contactar el servicio de cotización.',
    }
  }
}