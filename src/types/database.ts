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

export interface ProductoConStock extends Producto {
  variaciones_stock: VariacionStock[]
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

export interface SuscriptorNewsletter {
  id: string
  email: string
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
  try {
    const parsed = JSON.parse(url)
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : []
  } catch {
    return url.startsWith('http') ? [url] : []
  }
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
        Insert: Omit<Producto, 'id' | 'created_at' | 'discount_percent'> & { discount_percent?: number }
        Update: Partial<Omit<Producto, 'id' | 'created_at' | 'discount_percent'>> & { discount_percent?: number }
      }
      variaciones_stock: {
        Row: VariacionStock
        Insert: Omit<VariacionStock, 'id'>
        Update: Partial<Omit<VariacionStock, 'id'>>
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
      suscriptores_newsletter: {
        Row: SuscriptorNewsletter
        Insert: { email: string; activo?: boolean }
        Update: Partial<Omit<SuscriptorNewsletter, 'id' | 'created_at'>>
      }
    }
  }
}
