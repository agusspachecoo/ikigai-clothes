// ============================================================
// Tipos y helpers de envío. SIN RED.
//
// Este módulo ya no habla con ninguna API de transportista: la cotización se
// resuelve en `tarifasEnvio.ts` contra un tarifario local. Antes `cotizarEnvio`
// pegaba a la Edge Function `oca-envio` y devolvía "No se pudo contactar el
// servicio de cotización", dejando el checkout sin opciones de envío.
//
// Si algún día se vuelve a integrar un carrier real, la cotización va en su
// propia Edge Function y este archivo se queda solo con los tipos.
// ============================================================

// Peso por prenda: 300 g (paquete de 30 × 20 × 5 cm, medidas del PRD).
export const DEF_PESO_G = 300

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

// `import.meta.env` no existe fuera de Vite (tests con Deno/Node). El optional
// chaining evita que importar este módulo reviente en ese contexto.
const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {}

// Código postal de despacho del local (origen). Metadata de la orden.
export const ORIGEN_CP = String(
  env.VITE_ENVIOPACK_ORIGEN_CP ?? env.VITE_ZIPPIN_ORIGIN_CP ?? '',
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
