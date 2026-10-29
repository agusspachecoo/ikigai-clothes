import type { PromocionAplicada } from '../lib/promociones'

export interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string
  precio: number
  precio_transferencia: number | null
  discount_percent: number
  imagenes: string[]
  activo: boolean
  drop_id: string | null
  created_at: string
  sku?: string | null
}

export interface Categoria {
  id: string
  nombre: string
  slug: string
  created_at: string
  imagen_url?: string | null
}

export interface VariacionStock {
  id: string
  producto_id: string
  talle: string
  stock_disponible: number
}

export interface Talle {
  id: string
  nombre: string
  orden: number
  activo: boolean
  created_at: string
}

export interface DropResumen {
  id: string
  fecha_lanzamiento: string
  activo: boolean
}

export interface ProductoConStock extends Producto {
  variaciones_stock: VariacionStock[]
  /**
   * Drop embebido en las consultas públicas. Permite descartar en el
   * frontend los productos de drops futuros aunque la RLS no los oculte.
   */
  drop?: DropResumen | null
  /**
   * `true` cuando el producto pertenece a un drop que todavía no se lanzó.
   * El dato viene enmascarado desde `productos_proximos()` (nombre "Próximamente..."
   * y precio 0), así que la tarjeta debe renderizarlo bloqueada y no cliqueable.
   */
  bloqueado?: boolean
}

export interface Drop {
  id: string
  titulo: string
  descripcion: string | null
  fecha_lanzamiento: string
  activo: boolean
  created_at: string
}

export interface DropPreviewProducto {
  producto_id: string
  imagen: string | null
}

export interface Outfit {
  id: string
  nombre: string
  descripcion: string | null
  precio_combo: number
  imagen_portada: string
  activo: boolean
  created_at: string
}

export interface OutfitItem {
  id: string
  outfit_id: string
  producto_id: string
  producto?: Producto & { variaciones_stock?: VariacionStock[] }
}

export interface OutfitConItems extends Outfit {
  outfit_items: OutfitItem[]
}

export interface EnvioDetalle {
  metodo: 'envio' | 'retiro'
  carrier?: string | null
  carrier_id?: number | null
  servicio?: string | null
  service_type?: string | null
  logistic_type?: string | null
  costo?: number
  codigo_postal?: string | null
  origen_cp?: string | null
  tiempo?: string | null
  mock?: boolean
  seleccion?: unknown | null
  cotizacion?: unknown | null
}

export interface Orden {
  id: string
  cliente_nombre: string
  cliente_email: string
  cliente_telefono: string
  cliente_dni: string
  direccion: string
  codigo_postal: string
  metodo_pago: 'mercadopago' | 'transferencia'
  monto_total: number
  costo_envio: number
  estado: string
  estado_pago: 'pendiente' | 'pagado'
  estado_envio: string
  comprobante_url: string | null
  cupon_codigo: string | null
  descuento_cupon: number
  descuento_promociones: number
  promociones_aplicadas: PromocionAplicada[]
  descuento_outfit: number
  cupon_consumido: string | null
  envio_detalle?: EnvioDetalle | null
  created_at: string
}

export interface Cupon {
  id: string
  codigo: string
  descripcion: string | null
  tipo: 'porcentaje' | 'fijo'
  valor: number
  descuento_maximo: number | null
  minimo_compra: number
  usos_max: number | null
  usos: number
  fecha_inicio: string | null
  fecha_fin: string | null
  activo: boolean
  created_at: string
}

export interface OrdenItem {
  id: string
  orden_id: string
  producto_id: string
  talle: string
  cantidad: number
  precio_unitario: number
}

export interface Resena {
  id: string
  producto_id: string
  nombre_usuario: string
  puntuacion: number
  comentario: string
  imagen_url: string | null
  aprobado: boolean
  created_at: string
}

export function parseResenaImagenes(url: string | null): string[] {
  if (!url) return []
  const valor = String(url).trim()
  if (!valor) return []
  try {
    const parsed = JSON.parse(valor)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.trim())
    }
    if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()]
  } catch {
    // No es JSON: puede ser una URL, un path o un nombre de archivo viejo.
  }
  // Se devuelve el valor crudo. La normalización (bucket, carpeta, URL base)
  // vive en `normalizarUrlImagen`, no en el parser de la base de datos.
  return [valor]
}

export interface ComunidadFoto {
  id: string
  nombre_usuario: string
  instagram_handle: string | null
  imagen_url: string
  aprobado: boolean
  orden: number | null
  created_at: string
}

export interface Banner {
  id: string
  imagen_url: string
  imagen_mobile?: string | null
  titulo: string | null
  link_url: string | null
  orden: number
  activo: boolean
  created_at: string
}

export interface Perfil {
  id: string
  email: string | null
  nombre: string | null
  apellido: string | null
  dni: string | null
  telefono: string | null
  es_admin: boolean
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      categorias: {
        Row: Categoria
        Insert: Omit<Categoria, 'id' | 'created_at'>
        Update: Partial<Omit<Categoria, 'id' | 'created_at'>>
      }
      productos: {
        Row: Producto
        Insert: Omit<Producto, 'id' | 'created_at' | 'discount_percent' | 'drop_id'> & { discount_percent?: number; drop_id?: string | null }
        Update: Partial<Omit<Producto, 'id' | 'created_at' | 'discount_percent'>> & { discount_percent?: number }
      }
      drops: {
        Row: Drop
        Insert: Omit<Drop, 'id' | 'created_at' | 'activo'> & { activo?: boolean }
        Update: Partial<Omit<Drop, 'id' | 'created_at'>>
      }
      variaciones_stock: {
        Row: VariacionStock
        Insert: Omit<VariacionStock, 'id'>
        Update: Partial<Omit<VariacionStock, 'id'>>
      }
      talles: {
        Row: Talle
        Insert: Omit<Talle, 'id' | 'created_at' | 'orden' | 'activo'> & { orden?: number; activo?: boolean }
        Update: Partial<Omit<Talle, 'id' | 'created_at'>>
      }
      outfits: {
        Row: Outfit
        Insert: Omit<Outfit, 'id' | 'created_at'>
        Update: Partial<Omit<Outfit, 'id' | 'created_at'>>
      }
      outfit_items: {
        Row: OutfitItem
        Insert: Omit<OutfitItem, 'id'>
        Update: Partial<Omit<OutfitItem, 'id'>>
      }
      ordenes: {
        Row: Orden
        Insert: Omit<Orden, 'id' | 'created_at'>
        Update: Partial<Omit<Orden, 'id' | 'created_at'>>
      }
      orden_items: {
        Row: OrdenItem
        Insert: Omit<OrdenItem, 'id'>
        Update: Partial<Omit<OrdenItem, 'id'>>
      }
      resenas: {
        Row: Resena
        Insert: Partial<Omit<Resena, 'id' | 'created_at'>> & {
          producto_id: string
          nombre_usuario: string
          puntuacion: number
          comentario: string
        }
        Update: Partial<Omit<Resena, 'id' | 'created_at'>>
      }
      comunidad_fotos: {
        Row: ComunidadFoto
        Insert: Omit<ComunidadFoto, 'id' | 'created_at'>
        Update: Partial<Omit<ComunidadFoto, 'id' | 'created_at'>>
      }
      banners: {
        Row: Banner
        Insert: Omit<Banner, 'id' | 'created_at'>
        Update: Partial<Omit<Banner, 'id' | 'created_at'>>
      }
      perfiles: {
        Row: Perfil
        Insert: Partial<Omit<Perfil, 'id' | 'created_at'>>
        Update: Partial<Omit<Perfil, 'id' | 'created_at'>>
      }
      cupones: {
        Row: Cupon
        Insert: Omit<Cupon, 'id' | 'created_at' | 'usos'>
        Update: Partial<Omit<Cupon, 'id' | 'created_at' | 'usos'>>
      }
      config_tienda: {
        Row: { clave: string; valor: string; descripcion: string | null; updated_at: string }
        Insert: { clave: string; valor: string; descripcion?: string | null }
        Update: { valor: string }
      }
    }
  }
}
