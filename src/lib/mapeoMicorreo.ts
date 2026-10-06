// ============================================================
// Mapeo puro de los `rates` de MiCorreo a `OpcionEnvio`.
//
// Sin red ni side effects: recibe la respuesta cruda de la Edge Function
// `micorreo-envio` y devuelve opciones en el mismo contrato que ya usan
// `Checkout.tsx` y `EnvioCalculator.tsx`. Al no importar nada que toque
// `import.meta.env`, este módulo se puede testear aislado con Node.
// ============================================================

import type { OpcionEnvio } from './enviopack'
import type { OpcionMicorreo } from './micorreo'

/** Modalidad de entrega que devuelve MiCorreo. */
export type ModalidadEnvio = 'domicilio' | 'sucursal'

/** `productType` que usa MiCorreo para el servicio Clásico. */
const PRODUCT_TYPE_CLASICO = 'CP'

/** Re serves: `CP` (Clásico) o el nombre por las dudas de que cambie el alias. */
export function esClasico(rate: OpcionMicorreo): boolean {
  if (rate.productType === PRODUCT_TYPE_CLASICO) return true
  const nombre = (rate.productName ?? '').toLowerCase()
  return nombre.includes('clásico') || nombre.includes('clasico')
}

function modalidad(rate: OpcionMicorreo): ModalidadEnvio {
  return rate.deliveredType === 'S' ? 'sucursal' : 'domicilio'
}

/**
 * Nombre del transportista tal cual lo escribe el cliente. La API devuelve
 * `Correo Argentino Clasico` sin tilde, y la fila del checkout se lee junto a
 * la modalidad ("Correo Argentino Clásico · Entrega a Domicilio").
 */
function nombreTransportista(rate: OpcionMicorreo): string {
  return (rate.productName?.trim() || 'Correo Argentino').replace(/Clasico/g, 'Clásico')
}

function aDias(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

/**
 * `"2 a 5 días hábiles"`. MiCorreo trae el rango en `deliveryTimeMin` /
 * `deliveryTimeMax`; si no, se cae a la cadena que arma la Edge Function.
 */
export function leyendaPlazo(rate: OpcionMicorreo): string {
  const min = aDias(rate.deliveryTimeMin)
  const max = aDias(rate.deliveryTimeMax)

  if (min !== null) {
    const unidad = (d: number) => `${d} ${d === 1 ? 'día' : 'días'}`
    if (max !== null && max !== min) return `${min} a ${unidad(max)} hábiles`
    return `${unidad(min)} hábiles`
  }

  return rate.tiempo_estimado ?? ''
}

function diasMaximos(rate: OpcionMicorreo): number | null {
  return aDias(rate.deliveryTimeMax) ?? aDias(rate.deliveryTimeMin)
}

/**
 * Una tarifa de MiCorreo como `OpcionEnvio`. El precio queda **tal cual** lo
 * devuelve la API: sin redondeos ni ajustes, salvo descartar el que no sea
 * un número finito (ahí el caller decide si descarta o cae al local).
 */
export function rateAOpcionEnvio(rate: OpcionMicorreo): OpcionEnvio | null {
  const bruto = rate.price ?? rate.costo
  // `Number(null)` da 0, no NaN: hay que descartarlo a mano o un rate roto
  // mapearía como envío gratis. Un string numérico igual lo convierte `Number`.
  if (bruto === null || bruto === undefined) return null
  const precio = Number(bruto)
  if (!Number.isFinite(precio) || precio < 0) return null

  const esDomicilio = modalidad(rate) === 'domicilio'
  const plazo = leyendaPlazo(rate)
  const dias = diasMaximos(rate)

  return {
    id_servicio: `micorreo-${esDomicilio ? 'd' : 's'}`,
    correo_id: 'CORREO_ARGENTINO',
    carrier: {
      id: null,
      name: nombreTransportista(rate),
      rating: null,
      logo: null,
    },
    service_type: {
      code: esDomicilio ? 'DOMICILIO' : 'SUCURSAL',
      name: esDomicilio ? 'Entrega a Domicilio' : 'Retiro en Sucursal',
    },
    costo: precio,
    tiempo_estimado: plazo || null,
    modalidad: esDomicilio ? 'domicilio' : 'sucursal',
    despacho: null,
    horas_entrega: dias !== null ? dias * 24 : null,
    cumplimiento: null,
    anomalos: null,
    logistic_type: esDomicilio ? 'PUERTA_A_PUERTA' : 'CORREO_POR_RECOGER',
    estimado: {
      minimo_dias: aDias(rate.deliveryTimeMin),
      maximo_dias: aDias(rate.deliveryTimeMax),
      estimado: null,
      leyenda: plazo,
    },
    tags: [],
    selectable: true,
  }
}

/** Sólo Correo Argentino Clásico, mapeado y con `cheapest`/`fastest` marcados. */
export function ratesACpciones(rates: OpcionMicorreo[]): OpcionEnvio[] {
  const opciones = rates.filter(esClasico).map(rateAOpcionEnvio)

  // El `filter` del map devuelve (OpcionEnvio | null)[]
  const validas = opciones.filter((o): o is OpcionEnvio => o !== null)
  marcarTags(validas)
  return validas
}

/**
 * Marca la más barata y la más rápida. Mismo criterio que `cotizarEnvioLocal`
 * para que la UI se comporte igual venga de donde venga la cotización.
 */
export function marcarTags(opciones: OpcionEnvio[]): void {
  if (opciones.length === 0) return

  const menorCosto = Math.min(...opciones.map((o) => o.costo))
  const menoresHoras = Math.min(...opciones.map((o) => o.horas_entrega ?? Infinity))

  opciones.forEach((o) => {
    if (o.costo <= menorCosto) o.tags.push('cheapest')
    if ((o.horas_entrega ?? Infinity) <= menoresHoras) o.tags.push('fastest')
  })
}
