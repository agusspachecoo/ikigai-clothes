import { createContext, useContext } from 'react'

export interface ConfigTienda {
  /** Monto mínimo para obtener envío gratis (0 = deshabilitado) */
  umbral_envio_gratis: number
  envio_gratis_activo: boolean
  /** Descuento al pagar por transferencia, de 0 a 1 (0.2 = 20%) */
  descuento_transferencia: number
  cuotas_sin_interes: number
  whatsapp: string
  email_contacto: string
  instagram: string
  nombre_tienda: string
  /** URL de la imagen del bloque de showroom (subida desde el panel) */
  imagen_showroom: string
}

export const CONFIG_POR_DEFECTO: ConfigTienda = {
  umbral_envio_gratis: 150000,
  envio_gratis_activo: true,
  descuento_transferencia: 0.2,
  cuotas_sin_interes: 6,
  whatsapp: '5493755732335',
  email_contacto: 'ikigaiclothes.contacto@gmail.com',
  instagram: 'https://www.instagram.com/ikigai_clothess/',
  nombre_tienda: 'IKIGAI CLOTHES',
  imagen_showroom: '',
}

export const TiendaContexto = createContext<ConfigTienda>(CONFIG_POR_DEFECTO)

export function useTienda() {
  return useContext(TiendaContexto)
}
