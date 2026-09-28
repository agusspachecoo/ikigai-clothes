// ============================================================
// IKIGAI CLOTHES - zippin-envio
// Cotiza el envío de un pedido/carrito contra Zipnova (ex Zippin)
// consultando las opciones de transporte disponibles y sus tarifas.
//
// Requiere los secrets de Supabase:
//   ZIPPIN_API_KEY
//   ZIPPIN_API_SECRET
//   ZIPPIN_ACCOUNT_ID          (ID de cuenta Zipnova)
//   ZIPPIN_ORIGIN_ID           (opcional; si se omite, Zipnova usa el
//                               origen por defecto de la cuenta)
//   ZIPPIN_ORIGIN_CP           (opcional; CP de despacho del local, se guarda
//                               como metadata. Si se omite, usa el `origen_cp`
//                               enviado por el frontend)
//
// Documentación: https://docs.zipnova.com/envios/recursos-api/envios/cotizar-envios
// ============================================================

import { corsHeaders, json } from '../_shared/cors.ts'

interface ItemEnvio {
  nombre: string
  cantidad: number
  valor_unitario: number
  peso_g?: number
  alto_cm?: number
  ancho_cm?: number
  largo_cm?: number
}

// Fallback de paquete por defecto (30 x 20 x 5 cm / 300 g por unidad)
const DEF_LARGO_CM = 30
const DEF_ANCHO_CM = 20
const DEF_ALTO_CM = 5
const DEF_PESO_G = 300

function pisar(numero: number | undefined, rango: [number, number]) {
  return Math.min(rango[1], Math.max(rango[0], Math.round(numero ?? 0)))
}

function buildBasicAuth(key: string, secret: string) {
  return `Basic ${btoa(`${key}:${secret}`)}`
}

// Opciones de prueba (mock) que se devuelven cuando la API de Zipnova falla
// (credenciales incompletas, origin_id no configurado, dirección no válida, etc.)
// para no cortar el flujo de compra. Mismo formato que las opciones reales.
function opcionesMock(cp: string) {
  return [
    {
      logistic_type: 'carrier_pickup',
      carrier: { id: null, name: 'Andreani / Correo Argentino', rating: null, logo: null },
      service_type: { code: 'standard_delivery', name: 'Envío Estándar a Domicilio' },
      estimado: {
        minimo_dias: 3,
        maximo_dias: 5,
        estimado: null,
        leyenda: '3 a 5 días hábiles',
      },
      costo: 4500,
      tags: [],
      selectable: true,
    },
    {
      logistic_type: 'carrier_dropoff',
      carrier: { id: null, name: 'Sucursal', rating: null, logo: null },
      service_type: { code: 'express_sucursal', name: 'Envío Exprés a Sucursal' },
      estimado: {
        minimo_dias: 2,
        maximo_dias: 3,
        estimado: null,
        leyenda: '2 a 3 días hábiles',
      },
      costo: 3200,
      tags: [],
      selectable: true,
    },
    {
      logistic_type: 'pickup_point',
      carrier: { id: null, name: 'Retiro en Local / Punto de Encuentro', rating: null, logo: null },
      service_type: { code: 'pickup', name: 'Retiro en Local' },
      estimado: {
        minimo_dias: 0,
        maximo_dias: 0,
        estimado: null,
        leyenda: 'Gratis',
      },
      costo: 0,
      tags: ['cheapest'],
      selectable: true,
    },
  ].map((o) => ({ ...o, mock: true, codigo_postal: cp }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const apiKey = Deno.env.get('ZIPPIN_API_KEY')
    const apiSecret = Deno.env.get('ZIPPIN_API_SECRET')
    const accountId = Deno.env.get('ZIPPIN_ACCOUNT_ID')
    const originId = Deno.env.get('ZIPPIN_ORIGIN_ID')

    const body = await req.json()
    const { destino_cp, items, valor_declarado, origen_cp } = body as {
      destino_cp?: string
      items?: ItemEnvio[]
      valor_declarado?: number
      origen_cp?: string
    }

    const cp = String(destino_cp ?? '').trim().replace(/\D/g, '')
    // CP de despacho (origen): prioriza el secret, sino el enviado por el frontend.
    const origenCp = (Deno.env.get('ZIPPIN_ORIGIN_CP') ?? String(origen_cp ?? ''))
      .trim()
      .replace(/\D/g, '')
    const origen = { zipcode: origenCp || null }

    if (!cp) {
      return json({ error: 'Ingresá un código postal para calcular el envío.' }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return json({ error: 'No hay ítems para cotizar.' }, { status: 400 })
    }

    // Configuración incompleta: en vez de cortar el flujo, devolvemos opciones mock
    if (!apiKey || !apiSecret || !accountId) {
      console.warn('zippin-envio: faltan secrets de Zipnova, usando opciones mock')
      return json({
        codigo_postal: cp,
        origen_cp: origenCp,
        origen,
        destino: null,
        paquetes: [],
        opciones: opcionesMock(cp),
        mock: true,
      })
    }

    const ziItems = items.flatMap((i) => {
      const cantidad = Math.max(1, Math.round(Number(i.cantidad) || 1))
      const pesoG = pisar(i.peso_g, [10, 10_000_000]) || DEF_PESO_G
      const alto = pisar(i.alto_cm, [1, 5000]) || DEF_ALTO_CM
      const ancho = pisar(i.ancho_cm, [1, 5000]) || DEF_ANCHO_CM
      const largo = pisar(i.largo_cm, [1, 5000]) || DEF_LARGO_CM
      return Array.from({ length: cantidad }, () => ({
        description: String(i.nombre ?? 'Producto').slice(0, 250),
        weight: pesoG,
        height: alto,
        width: ancho,
        length: largo,
      }))
    })

    const declaredValue = Math.max(
      0,
      Number(valor_declarado) ||
        items.reduce((n, i) => n + Number(i.valor_unitario || 0) * (Number(i.cantidad) || 1), 0),
    )

    const ziBody: Record<string, unknown> = {
      account_id: accountId,
      source: 'ikigai-clothes',
      declared_value: declaredValue,
      destination: { zipcode: cp },
      items: ziItems,
      type_packaging: 'none',
    }
    if (originId) {
      ziBody.origin_id = parseInt(originId, 10)
    }

    const ziRes = await fetch('https://api.zipnova.com.ar/v2/shipments/quote', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: buildBasicAuth(apiKey, apiSecret),
      },
      body: JSON.stringify(ziBody),
    })

    const ziData = await ziRes.json().catch(() => ({}))

    if (!ziRes.ok) {
      console.error('Zipnova quote error:', ziRes.status, JSON.stringify(ziData))
      return json({
        codigo_postal: cp,
        origen_cp: origenCp,
        origen,
        destino: null,
        paquetes: [],
        opciones: opcionesMock(cp),
        mock: true,
      })
    }

    // Traducción de tiempos ISO-8601 (ej. P2D -> 2 días) al rango legible
    function parseDias(duracion: string | undefined): number | null {
      if (!duracion) return null
      const m = duracion.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?)?/)
      if (!m) return null
      return (Number(m[1] || 0) * 24 + Number(m[2] || 0)) / 24
    }

    const allResults = Array.isArray(ziData?.all_results) ? ziData.all_results : []

    const opciones = allResults
      .map((r: Record<string, any>) => {
        const price = Number(r?.amounts?.price_incl_tax ?? r?.amounts?.price ?? 0)
        if (!Number.isFinite(price)) return null
        const t = r?.delivery_time?.times?.total
        const min = parseDias(t?.min)
        const max = parseDias(t?.max)
        return {
          logistic_type: r?.logistic_type ?? null,
          carrier: {
            id: r?.carrier?.id ?? null,
            name: String(r?.carrier?.name ?? 'Transporte'),
            rating: r?.carrier?.rating ?? null,
            logo: r?.carrier?.logo ?? null,
          },
          service_type: {
            code: r?.service_type?.code ?? null,
            name: String(r?.service_type?.name ?? ''),
          },
          estimado: {
            minimo_dias: min,
            maximo_dias: max,
            estimado: r?.delivery_time?.estimated_delivery ?? null,
            leyenda:
              min != null && max != null
                ? min === max
                  ? `${Math.round(max)} día${max === 1 ? '' : 's'} hábiles`
                  : `${Math.round(min)} a ${Math.round(max)} días hábiles`
                : '',
          },
          costo: price,
          tags: r?.tags ?? [],
          selectable: r?.selectable !== false,
        }
      })
      .filter(Boolean)

    opciones.sort((a, b) => a.costo - b.costo)

    // Si la API respondió ok pero no devolvió opciones seleccionables, usar mock
    if (opciones.length === 0) {
      console.warn('zippin-envio: sin opciones reales, usando opciones mock')
      return json({
        codigo_postal: cp,
        origen_cp: origenCp,
        origen,
        destino: null,
        paquetes: [],
        opciones: opcionesMock(cp),
        mock: true,
      })
    }

    return json({
      codigo_postal: cp,
      origen_cp: origenCp,
      origen,
      destino: {
        city: ziData?.destination?.city ?? null,
        state: ziData?.destination?.state ?? null,
      },
      paquetes: ziData?.packages ?? [],
      opciones,
    })
  } catch (err) {
    console.error('zippin-envio error:', err)
    const body = await req.json().catch(() => ({}))
    const cp = String((body as { destino_cp?: string })?.destino_cp ?? '').trim().replace(/\D/g, '')
    const origenCp = (Deno.env.get('ZIPPIN_ORIGIN_CP') ?? String((body as { origen_cp?: string })?.origen_cp ?? ''))
      .trim()
      .replace(/\D/g, '')
    return json(
      {
        codigo_postal: cp,
        origen_cp: origenCp,
        origen: { zipcode: origenCp || null },
        destino: null,
        paquetes: [],
        opciones: cp ? opcionesMock(cp) : [],
        mock: true,
      },
      cp ? 200 : 400,
    )
  }
})