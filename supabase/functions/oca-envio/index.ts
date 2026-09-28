// ============================================================
// IKIGAI CLOTHES - oca-envio
// Cotiza el envío de un pedido/carrito contra el Web Service de
// OCA (Tarifar_Envio_Corporativo) y devuelve las opciones en el
// mismo formato uniforme que usa el frontend (andreani-envio).
//
// A diferencia de Andreani / EnvíoPack, OCA NO exige credenciales
// de usuario para cotizar: solo hace falta un CUIT registrado que
// se envía en el campo `Cuit`. Incluso sin contrato comercial la
// API devuelve las tarifas vigentes (lista).
//
// Documentación: https://developers.oca.com.ar/epak.html
//   - Cotizar: GET {OCA_API_BASE}/Tarifar_Envio_Corporativo
//
// Requiere los secrets de Supabase:
//   OCA_CUIT                -> CUIT registrado en OCA, formato ##-########-#.
//                              Default: CUIT de prueba que publica OCA
//                              (30-53625919-4). En producción debe ser el CUIT
//                              del local (o del cliente e-Pak), con guiones.
//   OCA_API_BASE            -> (opcional) base del webservice; default producción.
//   OCA_ORIGEN_CP           -> (opcional) CP de despacho del local; default 3360 (Oberá).
//   OCA_OPERATIVAS          -> (opcional) lista de operativas a cotizar, separadas
//                              por coma. Default: 64665,62342,94584,78254 (las
//                              cuatro modalidades de OCA).
// ============================================================

import { corsHeaders, json } from '../_shared/cors.ts'

const API_BASE_DEF = 'https://webservice.oca.com.ar/ePak_tracking/Oep_TrackEPak.asmx'
// Origen del despacho: Oberá, Misiones (mismo CP que las demás integraciones).
const ORIGEN_CP_DEF = '3360'
// CUIT de prueba que publica OCA en su documentación (Datos para pruebas).
const CUIT_DEF = '30-53625919-4'
// Operativas (códigos de servicio que publica OCA en su documentación):
//   64665 Puerta a Puerta | 62342 Puerta a Sucursal
//   94584 Sucursal a Puerta | 78254 Sucursal a Sucursal
const OPERATIVAS_DEF = '64665,62342,94584,78254'

// Paquete por defecto por unidad (mismas medidas que las demás integraciones)
const DEF_ALTO_CM = 30
const DEF_ANCHO_CM = 20
const DEF_LARGO_CM = 5
const DEF_PESO_KG = 0.3

// Nombre legible, modalidad de entrega (D = domicilio, S = sucursal) y forma de
// despacho (D = OCA retira en la puerta del local, S = el local lleva a sucursal)
const NOMBRE_OPERATIVA: Record<string, string> = {
  '64665': 'Estándar a Domicilio',
  '62342': 'Estándar a Sucursal',
  '94584': 'A Domicilio desde Sucursal',
  '78254': 'A Sucursal desde Sucursal',
}
const MODALIDAD_OPERATIVA: Record<string, string> = {
  '64665': 'D',
  '62342': 'S',
  '94584': 'D',
  '78254': 'S',
}
const DESPACHO_OPERATIVA: Record<string, string> = {
  '64665': 'D',
  '62342': 'D',
  '94584': 'S',
  '78254': 'S',
}

class OcaError extends Error {}

// ------------------------------------------------------------------
// Parser del XML que devuelve Tarifar_Envio_Corporativo (sin
// dependencias): extrae cada <Table> y sus campos (<Total>,
// <PlazoEntrega>, <Ambito>, <idTiposervicio>, ...).
// ------------------------------------------------------------------
function leerTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'))
  return m ? m[1].trim() : null
}

function parsearTablas(xml: string): Array<Record<string, string>> {
  const filas: Array<Record<string, string>> = []
  const CAMPOS = [
    'Tarifador',
    'Precio',
    'idTiposervicio',
    'Ambito',
    'PlazoEntrega',
    'Adicional',
    'Total',
  ]
  const re = /<Table\b[^>]*>([\s\S]*?)<\/Table>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const bloque = m[1]
    const fila: Record<string, string> = {}
    for (const campo of CAMPOS) {
      const v = leerTag(bloque, campo)
      if (v !== null) fila[campo] = v
    }
    filas.push(fila)
  }
  return filas
}

function numeroValido(v: string | null | undefined): number | null {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : null
}

// ------------------------------------------------------------------
// Cotización de una operativa contra la API de OCA
// ------------------------------------------------------------------
async function cotizarOperativa(
  apiBase: string,
  cuit: string,
  operativa: string,
  cpOrigen: string,
  cpDestino: string,
  pesoKg: number,
  volumenM3: string,
  cantidadPaquetes: number,
  valorDeclarado: number,
): Promise<{ ok: boolean; filas: Array<Record<string, string>> }> {
  const params = new URLSearchParams({
    Cuit: cuit,
    Operativa: operativa,
    PesoTotal: pesoKg.toFixed(2),
    VolumenTotal: volumenM3,
    CodigoPostalOrigen: cpOrigen,
    CodigoPostalDestino: cpDestino,
    CantidadPaquetes: String(cantidadPaquetes),
    ValorDeclarado: String(valorDeclarado),
  })

  const res = await fetch(`${apiBase}/Tarifar_Envio_Corporativo?${params.toString()}`, {
    signal: AbortSignal.timeout(20_000),
  })
  const xml = await res.text()
  if (!res.ok || /<Error\b/i.test(xml)) {
    console.warn(
      `oca-envio: operativa ${operativa} respondió ${res.status}`,
      xml.slice(0, 300),
    )
    return { ok: false, filas: [] }
  }
  return { ok: true, filas: parsearTablas(xml) }
}

// ------------------------------------------------------------------
// Normalización de cada tarifa de OCA al formato del frontend
// ------------------------------------------------------------------
function hacerOpcion(
  operativa: string,
  fila: Record<string, string>,
  cp: string,
): Record<string, any> | null {
  const total = numeroValido(fila.Total) ?? numeroValido(fila.Precio)
  if (total === null || total < 0) return null

  const plazo = numeroValido(fila.PlazoEntrega)
  const dias = plazo !== null && plazo > 0 ? Math.round(plazo) : null
  const leyenda = dias ? `${dias} ${dias === 1 ? 'día' : 'días'} hábiles` : ''
  const modalidad = MODALIDAD_OPERATIVA[operativa] ?? 'D'
  const despacho = DESPACHO_OPERATIVA[operativa] ?? 'S'
  const ambito = (fila.Ambito ?? '').trim()
  const base = NOMBRE_OPERATIVA[operativa] ?? `OCA ${operativa}`
  const nombre = ambito ? `${base} (${ambito})` : base

  return {
    id_servicio: `oca:${operativa}`,
    correo_id: 'oca',
    carrier: { id: null, name: 'OCA', rating: null, logo: null },
    service_type: { code: operativa, name: nombre },
    costo: total,
    tiempo_estimado: leyenda || null,
    modalidad,
    despacho,
    horas_entrega: dias ? dias * 24 : null,
    cumplimiento: null,
    anomalos: null,
    logistic_type: modalidad === 'D' ? 'carrier_pickup' : 'carrier_dropoff',
    estimado: {
      minimo_dias: dias,
      maximo_dias: dias,
      estimado: null,
      leyenda,
    },
    tags: [],
    selectable: true,
    codigo_postal: cp,
  }
}

// ------------------------------------------------------------------
// Respuesta de respaldo (mock) para no cortar el flujo de compra si
// la API de OCA falla o el CUIT todavía no devuelve tarifas.
// ------------------------------------------------------------------
function opcionesMock(cp: string) {
  return [
    {
      id_servicio: 'oca:standard_domicilio',
      correo_id: 'oca',
      carrier: { id: null, name: 'OCA', rating: null, logo: null },
      service_type: { code: 'standard_domicilio', name: 'Estándar a Domicilio' },
      costo: 4500,
      tiempo_estimado: '3 a 5 días hábiles',
      modalidad: 'D',
      despacho: 'S',
      horas_entrega: 96,
      cumplimiento: null,
      anomalos: null,
      logistic_type: 'carrier_pickup',
      estimado: { minimo_dias: 3, maximo_dias: 5, estimado: null, leyenda: '3 a 5 días hábiles' },
      tags: [],
      selectable: true,
      codigo_postal: cp,
      mock: true,
    },
    {
      id_servicio: 'oca:express_sucursal',
      correo_id: 'oca',
      carrier: { id: null, name: 'OCA', rating: null, logo: null },
      service_type: { code: 'express_sucursal', name: 'Exprés a Sucursal' },
      costo: 3200,
      tiempo_estimado: '2 a 3 días hábiles',
      modalidad: 'S',
      despacho: 'S',
      horas_entrega: 60,
      cumplimiento: null,
      anomalos: null,
      logistic_type: 'carrier_dropoff',
      estimado: { minimo_dias: 2, maximo_dias: 3, estimado: null, leyenda: '2 a 3 días hábiles' },
      tags: [],
      selectable: true,
      codigo_postal: cp,
      mock: true,
    },
    {
      id_servicio: 'oca:retiro_local',
      correo_id: 'oca',
      carrier: { id: null, name: 'Retiro en Local / Punto de Encuentro', rating: null, logo: null },
      service_type: { code: 'pickup', name: 'Retiro en Local' },
      costo: 0,
      tiempo_estimado: 'Gratis',
      modalidad: 'D',
      despacho: 'S',
      horas_entrega: 0,
      cumplimiento: null,
      anomalos: null,
      logistic_type: 'pickup_point',
      estimado: { minimo_dias: 0, maximo_dias: 0, estimado: null, leyenda: 'Gratis' },
      tags: ['cheapest'],
      selectable: true,
      codigo_postal: cp,
      mock: true,
    },
  ]
}

// ------------------------------------------------------------------
// Handler
// ------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiBase = (Deno.env.get('OCA_API_BASE') || API_BASE_DEF).replace(/\/+$/, '')
    const cuit = (Deno.env.get('OCA_CUIT') || CUIT_DEF).trim()
    const origenCp = (Deno.env.get('OCA_ORIGEN_CP') || ORIGEN_CP_DEF).trim().replace(/\D/g, '')
    const operativas = (Deno.env.get('OCA_OPERATIVAS') || OPERATIVAS_DEF)
      .split(',')
      .map((o) => o.trim())
      .filter((o) => /^\d+$/.test(o))
    const operativasUnicas = [...new Set(operativas)]

    const body = await req.json().catch(() => ({}))
    const {
      postal_code,
      cp_destino,
      weight,
      height,
      width,
      length,
      bultos,
      valor_declarado,
      origen_cp,
    } = body as {
      postal_code?: string | number
      cp_destino?: string | number
      weight?: number | string
      height?: number | string
      width?: number | string
      length?: number | string
      bultos?: number | string
      valor_declarado?: number | string
      origen_cp?: string | number
    }

    const cpDestino = String(postal_code ?? cp_destino ?? '').trim().replace(/\D/g, '')
    if (!cpDestino || cpDestino.length < 4) {
      return json({ error: 'Ingresá un código postal válido para calcular el envío.' }, { status: 400 })
    }

    const pesoKg = Math.max(0.05, Number(weight) || DEF_PESO_KG)
    const cantidadBultos = Math.max(1, Math.round(Number(bultos) || 1))
    const alto = Math.max(1, Math.round(Number(height) || DEF_ALTO_CM))
    const ancho = Math.max(1, Math.round(Number(width) || DEF_ANCHO_CM))
    const largo = Math.max(1, Math.round(Number(length) || DEF_LARGO_CM))
    const valorDeclarado = Math.max(0, Number(valor_declarado) || 0)
    // Volumen total en m³ (OCA lo pide en metros cúbicos)
    const volumenM3 = ((alto * ancho * largo) / 1_000_000 * cantidadBultos).toFixed(4)

    const origen = String(origen_cp ?? '').trim().replace(/\D/g, '') || origenCp
    const paquete = `${alto}x${ancho}x${largo}`
    const paquetesParam = Array.from({ length: cantidadBultos }, () => paquete).join(',')

    // Cotización de todas las operativas en paralelo
    const resultados = await Promise.all(
      operativasUnicas.map((operativa) =>
        cotizarOperativa(
          apiBase,
          cuit,
          operativa,
          origen,
          cpDestino,
          pesoKg,
          volumenM3,
          cantidadBultos,
          valorDeclarado,
        )
      ),
    )

    const opciones = resultados
      .flatMap((r, i) =>
        (r.ok ? r.filas : []).map((fila) => hacerOpcion(operativasUnicas[i], fila, cpDestino))
      )
      .filter((o): o is Record<string, any> => o !== null)
      .sort((a, b) => a.costo - b.costo)
      .filter((o, i, arr) => arr.findIndex((x) => x.id_servicio === o.id_servicio) === i)

    if (opciones.length === 0) {
      console.warn('oca-envio: sin opciones reales, usando opciones mock')
      return json({
        codigo_postal: cpDestino,
        origen_cp: origen,
        provincia: null,
        destino: null,
        paquetes: paquetesParam,
        peso: pesoKg,
        opciones: opcionesMock(cpDestino),
        mock: true,
      })
    }

    return json({
      codigo_postal: cpDestino,
      origen_cp: origen,
      provincia: null,
      destino: null,
      paquetes: paquetesParam,
      peso: pesoKg,
      opciones,
      mock: false,
    })
  } catch (err) {
    console.error('oca-envio error:', err)
    const mensaje = err instanceof OcaError
      ? err.message
      : 'No se pudo calcular el envío.'
    const cp = String((await req.json().catch(() => ({})))?.postal_code ?? '')
      .trim().replace(/\D/g, '')
    return json(
      {
        error: mensaje,
        codigo_postal: cp,
        origen_cp: (Deno.env.get('OCA_ORIGEN_CP') || ORIGEN_CP_DEF).trim(),
        provincia: null,
        destino: null,
        paquetes: [],
        peso: null,
        opciones: cp ? opcionesMock(cp) : [],
        mock: true,
      },
      cp ? { status: 200 } : { status: 400 },
    )
  }
})