import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CONFIG_POR_DEFECTO, TiendaContexto } from './tienda'
import type { ConfigTienda } from './tienda'

const CLAVES = [
  'umbral_envio_gratis',
  'envio_gratis_activo',
  'descuento_transferencia',
  'cuotas_sin_interes',
  'whatsapp',
  'email_contacto',
  'instagram',
  'nombre_tienda',
] as const

function numero(valor: string | null | undefined, porDefecto: number) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : porDefecto
}

export function TiendaProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigTienda>(CONFIG_POR_DEFECTO)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      const { data } = await supabase
        .from('config_tienda')
        .select('clave, valor')
        .in('clave', [...CLAVES])

      if (cancelado || !data?.length) return

      const valores = Object.fromEntries(data.map((r) => [r.clave, r.valor])) as Record<
        string,
        string
      >

      setConfig({
        umbral_envio_gratis: numero(
          valores.umbral_envio_gratis,
          CONFIG_POR_DEFECTO.umbral_envio_gratis,
        ),
        envio_gratis_activo: String(valores.envio_gratis_activo ?? 'true') === 'true',
        descuento_transferencia: Math.min(
          1,
          numero(
            valores.descuento_transferencia,
            CONFIG_POR_DEFECTO.descuento_transferencia * 100,
          ) / 100,
        ),
        cuotas_sin_interes: numero(
          valores.cuotas_sin_interes,
          CONFIG_POR_DEFECTO.cuotas_sin_interes,
        ),
        whatsapp: valores.whatsapp ?? CONFIG_POR_DEFECTO.whatsapp,
        email_contacto: valores.email_contacto ?? CONFIG_POR_DEFECTO.email_contacto,
        instagram: valores.instagram ?? CONFIG_POR_DEFECTO.instagram,
        nombre_tienda: valores.nombre_tienda ?? CONFIG_POR_DEFECTO.nombre_tienda,
      })
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [])

  return <TiendaContexto.Provider value={config}>{children}</TiendaContexto.Provider>
}
