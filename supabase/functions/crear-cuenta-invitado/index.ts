import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DIAS_MAX = 30

function getSupabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, key)
}

function crearPasswordTemporal(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function esEmailExistente(mensaje: string, codigo: string): boolean {
  const texto = `${codigo} ${mensaje}`.toLowerCase()
  return (
    texto.includes('email_exists') ||
    texto.includes('already been registered') ||
    texto.includes('already registered') ||
    texto.includes('user already exists')
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, { status: 405 })
  }

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Cuerpo JSON inválido.' }, { status: 400 })
    }

    const { ordenId } = (body ?? {}) as { ordenId?: unknown }

    if (typeof ordenId !== 'string' || !UUID_RE.test(ordenId)) {
      return json({ error: 'ordenId inválido.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const { data: orden, error: errOrden } = await supabase
      .from('ordenes')
      .select('id, cliente_nombre, cliente_email, cliente_telefono, cliente_dni, cliente_id, created_at')
      .eq('id', ordenId)
      .maybeSingle()

    if (errOrden) {
      console.error('crear-cuenta-invitado: error leyendo orden:', errOrden.message)
      return json({ error: 'No se pudo leer el pedido.' }, { status: 500 })
    }

    if (!orden) {
      return json({ error: 'Pedido no encontrado.' }, { status: 404 })
    }

    const email = String(orden.cliente_email ?? '').trim().toLowerCase()
    if (!email) {
      return json({ error: 'El pedido no tiene un email válido.' }, { status: 409 })
    }

    if (orden.cliente_id) {
      return json({ creada: false, existente: true, email })
    }

    const creadaEn = Date.parse(String(orden.created_at ?? ''))
    if (!Number.isFinite(creadaEn) || Date.now() - creadaEn > DIAS_MAX * 24 * 60 * 60 * 1000) {
      return json({ error: 'El pedido es demasiado antiguo para crear la cuenta.' }, { status: 410 })
    }

    const nombre = String(orden.cliente_nombre ?? '').trim().slice(0, 120)
    const password = crearPasswordTemporal()

    const { data: userData, error: errUser } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre },
    })

    if (errUser) {
      const codigo = String((errUser as { code?: string }).code ?? '')
      if (esEmailExistente(errUser.message, codigo)) {
        return json({ creada: false, existente: true, email })
      }
      console.error('crear-cuenta-invitado: error creando usuario:', errUser.message)
      return json({ error: 'No pudimos crear la cuenta.' }, { status: 500 })
    }

    if (!userData.user) {
      return json({ error: 'No pudimos crear la cuenta.' }, { status: 500 })
    }

    const { error: errPerfil } = await supabase.from('perfiles').upsert(
      {
        id: userData.user.id,
        email,
        nombre: nombre || null,
        dni: String(orden.cliente_dni ?? '').trim() || null,
        telefono: String(orden.cliente_telefono ?? '').trim() || null,
      },
      { onConflict: 'id' },
    )

    if (errPerfil) {
      console.error('crear-cuenta-invitado: error actualizando perfil:', errPerfil.message)
    }

    const { error: errLink } = await supabase
      .from('ordenes')
      .update({ cliente_id: userData.user.id })
      .eq('id', ordenId)
      .is('cliente_id', null)

    if (errLink) {
      console.error('crear-cuenta-invitado: error vinculando orden:', errLink.message)
    }

    return json(
      { creada: true, email, password, nombre },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('crear-cuenta-invitado:', err)
    return json({ error: 'Error inesperado creando la cuenta.' }, { status: 500 })
  }
})
