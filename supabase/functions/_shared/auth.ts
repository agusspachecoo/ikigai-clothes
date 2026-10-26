import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2'

const TOKEN_RE = /^[a-f0-9]{64}$/

export function getSupabaseAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

export function getBearer(req: Request): string {
  const header = req.headers.get('Authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function esAnonKey(token: string): boolean {
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  return Boolean(anon) && token === anon
}

/**
 * Devuelve el usuario si el request trae un JWT de sesión real.
 * La anon key es un JWT válido para el gateway, pero no identifica usuario.
 */
export async function getUsuario(
  req: Request,
  admin: SupabaseClient,
): Promise<User | null> {
  const token = getBearer(req)
  if (!token || esAnonKey(token)) return null

  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function getUsuarioAdmin(
  req: Request,
  admin: SupabaseClient,
): Promise<User | null> {
  const user = await getUsuario(req, admin)
  if (!user) return null

  const { data, error } = await admin
    .from('perfiles')
    .select('es_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('No se pudo verificar es_admin:', error.message)
    return null
  }
  return data?.es_admin === true ? user : null
}

export function generarTokenInvitado(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashToken(token: string): Promise<string | null> {
  if (!TOKEN_RE.test(token)) return null
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export interface OrdenAcceso {
  cliente_id: string | null
  cliente_email: string
  guest_token_hash: string | null
  guest_token_expira_at: string | null
}

/**
 * Regla única de acceso a una orden:
 *  - usuario dueño por cliente_id;
 *  - usuario con email confirmado y orden todavía sin reclamar;
 *  - invitado con token válido y no vencido.
 *
 * No se acepta email sin confirmar: un atacante podría registrarse con el
 * email de un pedido ajeno si Supabase Auth tiene las confirmaciones apagadas.
 */
export async function puedeAccederOrden(
  orden: OrdenAcceso,
  user: User | null,
  token: string | null,
): Promise<boolean> {
  if (user) {
    if (orden.cliente_id === user.id) return true
    if (
      !orden.cliente_id &&
      user.email_confirmed_at &&
      user.email &&
      user.email.toLowerCase() === String(orden.cliente_email).trim().toLowerCase()
    ) {
      return true
    }
  }

  if (!token || !orden.guest_token_hash || !orden.guest_token_expira_at) return false
  if (Date.parse(orden.guest_token_expira_at) <= Date.now()) return false

  const hash = await hashToken(token)
  return Boolean(hash) && hash === orden.guest_token_hash
}
