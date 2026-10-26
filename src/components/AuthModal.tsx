import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/auth'
import { useCierreModal } from '../hooks/useCierreModal'
import { AuthAlert } from './AuthAlert'
import { AuthField } from './AuthField'

type Modo = 'login' | 'registro' | 'recuperar'

export function AuthModal() {
  const {
    authModalAbierto,
    authModalModo,
    cerrarAuthModal,
    iniciarSesion,
    registrar,
    recuperarPassword,
  } = useAuth()
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [pendienteConfirmacion, setPendienteConfirmacion] = useState(false)
  const [emailConfirmacion, setEmailConfirmacion] = useState('')
  const [enviadoRecuperacion, setEnviadoRecuperacion] = useState(false)
  const [emailRecuperacion, setEmailRecuperacion] = useState('')
  const [abiertaPrevia, setAbiertaPrevia] = useState(authModalAbierto)
  useCierreModal(authModalAbierto, cerrarAuthModal)

  if (authModalAbierto !== abiertaPrevia) {
    setAbiertaPrevia(authModalAbierto)
    if (authModalAbierto) {
      setError(null)
      setPendienteConfirmacion(false)
      setEnviadoRecuperacion(false)
      setEmailRecuperacion('')
      setPassword('')
      setPasswordConfirm('')
      setModo(authModalModo)
    }
  }

  if (!authModalAbierto) return null

  function volverALogin() {
    setModo('login')
    setEnviadoRecuperacion(false)
    setError(null)
  }

  function irARecuperar() {
    setModo('recuperar')
    setError(null)
    setPassword('')
    setPasswordConfirm('')
  }

  function cambiarModo(nuevoModo: 'login' | 'registro') {
    if (modo === nuevoModo) return
    setModo(nuevoModo)
    setError(null)
    setPasswordConfirm('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (modo === 'recuperar') {
      const emailLimpio = email.trim()
      if (!emailLimpio) {
        setError('Ingresá tu email.')
        return
      }
      setCargando(true)
      const res = await recuperarPassword(emailLimpio)
      setCargando(false)
      if (res.error) {
        setError(res.error)
        return
      }
      setEmailRecuperacion(emailLimpio)
      setEnviadoRecuperacion(true)
      return
    }

    if (modo === 'registro') {
      if (password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres.')
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

  const titulo =
    pendienteConfirmacion || enviadoRecuperacion
      ? 'Revisá tu email'
      : modo === 'login'
        ? 'Bienvenido'
        : modo === 'registro'
          ? 'Creá tu cuenta'
          : 'Recuperá tu contraseña'

  const subtitulo =
    pendienteConfirmacion || enviadoRecuperacion
      ? null
      : modo === 'login'
        ? 'Ingresá a tu cuenta para ver tus compras y beneficios.'
        : modo === 'registro'
          ? 'Creá tu cuenta para seguir tus pedidos y acceder a beneficios.'
          : 'Ingresá tu email y te enviamos un enlace para definir una nueva contraseña.'

  return (
    <dialog
      className="modal modal-open z-[60]"
      aria-labelledby="auth-modal-title"
      aria-modal="true"
      onClose={cerrarAuthModal}
    >
      <div className="modal-box max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-x-hidden overflow-y-auto rounded-3xl border border-line/60 bg-base-100 p-0 shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-5 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-base-content/35">
              Ikigai Clothes
            </p>
            <h2
              id="auth-modal-title"
              className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              {titulo}
            </h2>
            {subtitulo && (
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-base-content/60">
                {subtitulo}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={cerrarAuthModal}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base-content/40 transition-colors hover:bg-base-200 hover:text-base-content focus:outline-none focus-visible:ring-2 focus-visible:ring-black/15"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="border-t border-line/60 px-5 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
          {pendienteConfirmacion ? (
            <div className="space-y-5 text-center">
              <div
                role="status"
                className="rounded-2xl border border-success/20 bg-success/5 px-5 py-6"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
                  <svg
                    className="h-7 w-7 text-success"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-base-content/70">
                  Te enviamos un enlace de confirmación a{' '}
                  <span className="break-all font-semibold text-base-content">
                    {emailConfirmacion}
                  </span>
                  . Revisá tu casilla (y también la carpeta de spam) y, una vez confirmada, podés
                  iniciar sesión.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-block h-11 rounded-xl"
                onClick={cerrarAuthModal}
              >
                Cerrar
              </button>
            </div>
          ) : enviadoRecuperacion ? (
            <div className="space-y-5 text-center">
              <div
                role="status"
                className="rounded-2xl border border-success/20 bg-success/5 px-5 py-6"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
                  <svg
                    className="h-7 w-7 text-success"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-base-content/70">
                  Te enviamos un enlace de recuperación a{' '}
                  <span className="break-all font-semibold text-base-content">
                    {emailRecuperacion}
                  </span>
                  . Revisá tu casilla (y también la carpeta de spam) y seguí las instrucciones para
                  definir una nueva contraseña.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block h-11 rounded-xl"
                onClick={volverALogin}
              >
                Volver a iniciar sesión
              </button>
            </div>
          ) : (
            <>
              {modo === 'recuperar' ? (
                <button
                  type="button"
                  className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-base-content/60 transition-colors hover:text-base-content focus:outline-none focus-visible:ring-2 focus-visible:ring-black/15"
                  onClick={volverALogin}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 19.5L8.25 12l7.5-7.5"
                    />
                  </svg>
                  Volver a iniciar sesión
                </button>
              ) : (
                <div
                  role="group"
                  aria-label="Elegí una opción"
                  className="relative grid grid-cols-2 rounded-full bg-base-200 p-1"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-neutral shadow-sm transition-transform duration-300 ease-out ${
                      modo === 'registro' ? 'translate-x-full' : 'translate-x-0'
                    }`}
                  />
                  <button
                    type="button"
                    aria-pressed={modo === 'login'}
                    onClick={() => cambiarModo('login')}
                    className={`relative z-10 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-200 ${
                      modo === 'login'
                        ? 'text-neutral-content'
                        : 'text-base-content/55 hover:text-base-content'
                    }`}
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    aria-pressed={modo === 'registro'}
                    onClick={() => cambiarModo('registro')}
                    className={`relative z-10 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition-colors duration-200 ${
                      modo === 'registro'
                        ? 'text-neutral-content'
                        : 'text-base-content/55 hover:text-base-content'
                    }`}
                  >
                    Registrarse
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <AuthField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                {modo !== 'recuperar' && (
                  <>
                    <AuthField
                      label="Contraseña"
                      type="password"
                      autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
                      placeholder="Tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      hint={modo === 'registro' ? 'Mínimo 8 caracteres.' : undefined}
                      required
                    />

                    {modo === 'login' && (
                      <div className="-mt-1 flex justify-end">
                        <button
                          type="button"
                          className="rounded text-xs font-medium text-base-content/55 underline-offset-4 transition-colors hover:text-base-content hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-black/15"
                          onClick={irARecuperar}
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </div>
                    )}
                  </>
                )}

                {modo === 'registro' && (
                  <AuthField
                    label="Repetí la contraseña"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Repetí tu contraseña"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                  />
                )}

                {error && <AuthAlert>{error}</AuthAlert>}

                <button
                  type="submit"
                  className="btn btn-primary btn-block h-12 rounded-xl text-sm font-semibold tracking-wide shadow-sm transition-all duration-200 hover:bg-neutral-800 hover:shadow-md disabled:opacity-60"
                  disabled={cargando}
                >
                  {cargando ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : modo === 'login' ? (
                    'Iniciar sesión'
                  ) : modo === 'registro' ? (
                    'Crear cuenta'
                  ) : (
                    'Enviar enlace de recuperación'
                  )}
                </button>
              </form>

              <p className="mt-5 border-t border-line/50 pt-4 text-center text-[11px] leading-relaxed text-base-content/55">
                {modo === 'recuperar'
                  ? 'Si el email está registrado, vas a recibir un enlace para restablecer tu contraseña.'
                  : 'Al registrarte podés consultar tus pedidos desde tu perfil. Podés seguir comprando sin cuenta.'}
              </p>
            </>
          )}
        </div>
      </div>

      <div
        className="modal-backdrop bg-black/20 backdrop-blur-md"
        onClick={cerrarAuthModal}
        aria-hidden="true"
      />
    </dialog>
  )
}
