import { useState } from 'react'
import { useAuth } from '../context/auth'
import { useCierreModal } from '../hooks/useCierreModal'

type Modo = 'login' | 'registro'

export function AuthModal() {
  const { authModalAbierto, authModalModo, cerrarAuthModal, iniciarSesion, registrar } = useAuth()
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [pendienteConfirmacion, setPendienteConfirmacion] = useState(false)
  const [emailConfirmacion, setEmailConfirmacion] = useState('')
  const [abiertaPrevia, setAbiertaPrevia] = useState(authModalAbierto)
  useCierreModal(authModalAbierto, cerrarAuthModal)

  if (authModalAbierto !== abiertaPrevia) {
    setAbiertaPrevia(authModalAbierto)
    if (authModalAbierto) {
      setError(null)
      setPendienteConfirmacion(false)
      setModo(authModalModo)
    }
  }

  if (!authModalAbierto) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (modo === 'registro') {
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.')
        return
      }
      if (password !== passwordConfirm) {
        setError('Las contraseñas no coinciden.')
        return
      }
      setCargando(true)
      const res = await registrar(email, password)
      setCargando(false)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.confirmacionPendiente) {
        setPendienteConfirmacion(true)
        setEmailConfirmacion(email)
        return
      }
      cerrarAuthModal()
      return
    }

    if (!email.trim() || !password) {
      setError('Completá tu email y contraseña.')
      return
    }
    setCargando(true)
    const res = await iniciarSesion(email, password)
    setCargando(false)
    if (res.error) setError(res.error)
  }

  return (
    <dialog className="modal modal-open z-[60]" onClose={cerrarAuthModal}>
      <div className="modal-box max-w-md rounded-3xl overflow-hidden p-0">
        {/* Header */}
        <div className="bg-zinc-950 text-white p-6 pb-5">
          <h2 className="text-xl font-bold">
            {pendienteConfirmacion
              ? 'Revisá tu email'
              : modo === 'login'
                ? 'Bienvenido de nuevo'
                : 'Creá tu cuenta'}
          </h2>
          {!pendienteConfirmacion && (
            <p className="text-sm text-white/60 mt-1">
              {modo === 'login'
                ? 'Iniciá sesión para ver tus compras y beneficios.'
                : 'Registrate para seguir tus pedidos y tener beneficios.'}
            </p>
          )}
        </div>

        <div className="p-6 space-y-5">
          {pendienteConfirmacion ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
                <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="text-sm">
                Te enviamos un enlace de confirmación a{' '}
                <span className="font-semibold">{emailConfirmacion}</span>. Revisá tu casilla (y también la
                carpeta de spam) y, una vez confirmada, podés iniciar sesión.
              </p>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="tabs tabs-boxed gap-1 p-1">
                <button
                  type="button"
                  className={`tab flex-1 ${modo === 'login' ? 'tab-active' : ''}`}
                  onClick={() => setModo('login')}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  className={`tab flex-1 ${modo === 'registro' ? 'tab-active' : ''}`}
                  onClick={() => setModo('registro')}
                >
                  Registrarse
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="floating-label">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    className="input input-bordered w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>

                <label className="floating-label">
                  <span>Contraseña</span>
                  <input
                    type="password"
                    autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                    className="input input-bordered w-full"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>

                {modo === 'registro' && (
                  <label className="floating-label">
                    <span>Repetí la contraseña</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="input input-bordered w-full"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                    />
                  </label>
                )}

                {error && <div className="alert alert-error text-sm">{error}</div>}

                <button type="submit" className="btn btn-primary btn-block" disabled={cargando}>
                  {cargando ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : modo === 'login' ? (
                    'Iniciar sesión'
                  ) : (
                    'Crear cuenta'
                  )}
                </button>
              </form>

              <p className="text-xs opacity-60 text-center">
                Al registrarte podés consultar tus pedidos desde tu perfil. Podés seguir comprando sin
                cuenta.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Cierra con el fondo, con Escape y con el popstate (sin boton de cerrar) */}
      <div className="modal-backdrop" onClick={cerrarAuthModal} />
    </dialog>
  )
}