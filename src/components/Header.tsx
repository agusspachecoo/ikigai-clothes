import { useState, useCallback } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/cart'
import { useAuth } from '../context/auth'
import { useTienda } from '../context/tienda'
import { useCategorias } from '../hooks/useCategorias'
import { Buscador } from './Buscador'
import { CarritoDrawer } from './CarritoDrawer'
import { SocialLinks } from './SocialLinks'
import { useCierreModal } from '../hooks/useCierreModal'
import logoWhite from '../assets/logo-white.png'
import { formatearPrecio } from '../lib/precios'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio' },
  { to: '/catalogo', label: 'Productos' },
  { to: '/catalogo?descuentos=1', label: 'Ofertas' },
  { to: '/outfits', label: 'Comprá el Outfit' },
  { to: '/quienes-somos', label: 'Quienes Somos' },
  { to: '/contacto', label: 'Contacto' },
]

export function Header() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { count, carritoAbierto, setCarritoAbierto } = useCart()
  const { user, cargando: cargandoAuth, abrirAuthModal, cerrarSesion } = useAuth()
  const { descuento_transferencia, umbral_envio_gratis, cuotas_sin_interes } = useTienda()
  const { categorias } = useCategorias()

  const [menuOpen, setMenuOpen] = useState(false)
  const [busquedaOpen, setBusquedaOpen] = useState(false)
  const [perfilMenuAbierto, setPerfilMenuAbierto] = useState(false)

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeBusqueda = useCallback(() => setBusquedaOpen(false), [])

  useCierreModal(menuOpen, closeMenu)
  useCierreModal(busquedaOpen, closeBusqueda)

  const openCart = useCallback(() => {
    setMenuOpen(false)
    setCarritoAbierto(true)
  }, [setCarritoAbierto])

  const mensajes = [
    `${Math.round(descuento_transferencia * 100)}% OFF pagando por transferencia`,
    umbral_envio_gratis > 0
      ? `Envío gratis desde $${formatearPrecio(umbral_envio_gratis)}`
      : 'Envíos a todo el país',
    `${cuotas_sin_interes} cuotas sin interés`,
    'Envíos a todo el país · Retiro en showroom',
  ]

  function esActivo(path: string) {
    if (path === '/') return location.pathname === '/'
    if (path === '/catalogo') {
      return location.pathname.startsWith('/catalogo') && searchParams.get('descuentos') !== '1'
    }
    if (path.includes('descuentos')) return searchParams.get('descuentos') === '1'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* ────────── ADBAR ────────── */}
      <div className="bg-adbar text-adbar-content h-9 flex items-center overflow-hidden">
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          {[0, 1].map((copia) => (
            <ul
              key={copia}
              aria-hidden={copia === 1}
              className="flex shrink-0 items-center list-none m-0 p-0"
            >
              {mensajes.map((mensaje) => (
                <li
                  key={mensaje}
                  className="flex items-center gap-6 px-6 text-[11px] md:text-xs uppercase tracking-[0.15em] whitespace-nowrap"
                >
                  {mensaje}
                  <span aria-hidden="true" className="opacity-40">
                    ✦
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>

      {/* ────────── HEADER ────────── */}
      <header className="sticky top-0 z-40 w-full bg-neutral text-neutral-content">
        <div className="relative flex items-center h-16 md:h-20 px-4 gap-3">
          {/* Izquierda: en mobile la navegación vive en la barra inferior */}
          <div className="flex items-center gap-2 z-10">
            <div className="hidden lg:block w-full max-w-xs">
              <Buscador
                className="w-full h-9 px-3 bg-white/5 border border-white/15 text-sm text-white placeholder:text-white/40 focus:bg-white/10"
                placeholder="Buscar productos"
              />
            </div>
          </div>

          {/* Centro: logo */}
          <div className="absolute inset-x-0 flex justify-center items-center">
            <Link to="/" aria-label="Ikigai Clothes - Inicio" className="flex items-center">
              <img
                src={logoWhite}
                alt="Ikigai Clothes"
                decoding="async"
                width={500}
                height={500}
                className="h-12 md:h-[4.75rem] w-auto max-w-[46vw] object-contain"
              />
            </Link>
          </div>

          {/* Derecha */}
          <div className="ml-auto flex items-center gap-1 z-10 lg:flex lg:justify-end lg:flex-1">
            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setPerfilMenuAbierto((v) => !v)}
                aria-label="Mi cuenta"
                className="btn btn-ghost btn-circle btn-sm text-white hover:bg-white/10"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </button>

              {perfilMenuAbierto && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPerfilMenuAbierto(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 bg-base-100 text-base-content border border-line p-1.5">
                    {cargandoAuth ? (
                      <div className="px-3 py-2">
                        <span className="loading loading-spinner loading-xs align-middle" />
                      </div>
                    ) : user ? (
                      <>
                        <div className="px-3 py-2">
                          <p className="text-xs truncate">{user.email}</p>
                        </div>
                        <div className="h-px bg-line my-1" />
                        <Link
                          to="/perfil"
                          onClick={() => setPerfilMenuAbierto(false)}
                          className="block px-3 py-2 text-sm hover:bg-base-200"
                        >
                          Mis compras
                        </Link>
                        <Link
                          to="/perfil"
                          state={{ tab: 'favoritos' }}
                          onClick={() => setPerfilMenuAbierto(false)}
                          className="block px-3 py-2 text-sm hover:bg-base-200"
                        >
                          Mis favoritos
                        </Link>
                        <Link
                          to="/perfil"
                          state={{ tab: 'cuenta' }}
                          onClick={() => setPerfilMenuAbierto(false)}
                          className="block px-3 py-2 text-sm hover:bg-base-200"
                        >
                          Mi cuenta
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            setPerfilMenuAbierto(false)
                            void cerrarSesion()
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-error hover:bg-base-200"
                        >
                          Cerrar sesión
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setPerfilMenuAbierto(false)
                            abrirAuthModal()
                          }}
                          className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-base-200"
                        >
                          Iniciar sesión
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPerfilMenuAbierto(false)
                            abrirAuthModal('registro')
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-base-200"
                        >
                          Crear cuenta
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={openCart}
              aria-label="Abrir carrito"
              className="btn btn-ghost btn-circle btn-sm relative text-white hover:bg-white/10 hidden lg:flex"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
              </svg>
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-semibold bg-white text-neutral">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Navegación desktop */}
        <nav className="hidden lg:flex items-center justify-center border-t border-white/10">
          {NAV_ITEMS.map((item) =>
            item.label === 'Productos' ? (
              <div key={item.to} className="dropdown dropdown-hover">
                <div
                  tabIndex={0}
                  role="button"
                  className={`px-4 py-3 text-[11px] uppercase tracking-[0.15em] cursor-pointer ${
                    esActivo(item.to) ? 'text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {item.label}
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-100 text-base-content border border-line w-56 z-50 p-1.5 rounded-none"
                >
                  <li>
                    <Link to="/catalogo">Ver todos los productos</Link>
                  </li>
                  {categorias.map((cat) => (
                    <li key={cat.id}>
                      <Link to={`/catalogo?categoria=${cat.slug}`}>{cat.nombre}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Link
                key={item.to}
                to={item.to}
                className={`px-4 py-3 text-[11px] uppercase tracking-[0.15em] border-l border-white/10 ${
                  esActivo(item.to) ? 'text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>
      </header>

      {/* ────────── MENÚ MOBILE ────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeMenu} />
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-base-100 border-r border-line flex flex-col overflow-y-auto">
            <div className="h-14 flex items-center px-4 border-b border-line shrink-0">
              <span className="text-sm uppercase tracking-widest">Menú</span>
            </div>

            <div className="p-4">
              <Buscador className="w-full h-9 px-3 bg-base-200" onNavegar={closeMenu} />
            </div>

            <nav className="px-4 pb-4">
              <ul className="divide-y divide-line">
                {NAV_ITEMS.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={closeMenu}
                      className={`block py-3 text-sm uppercase tracking-[0.12em] ${
                        esActivo(item.to) ? 'text-primary' : ''
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="px-4 pb-4">
              <p className="text-[11px] uppercase tracking-widest opacity-50 mb-2">Categorías</p>
              <ul className="space-y-1">
                {categorias.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      to={`/catalogo?categoria=${cat.slug}`}
                      onClick={closeMenu}
                      className="block py-1.5 text-sm opacity-70 hover:opacity-100"
                    >
                      {cat.nombre}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="px-4 pb-4 mt-auto">
              {user ? (
                <Link to="/perfil" onClick={closeMenu} className="btn btn-outline btn-sm btn-block">
                  Mi cuenta
                </Link>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu()
                      abrirAuthModal('login')
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu()
                      abrirAuthModal('registro')
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    Crear cuenta
                  </button>
                </div>
              )}
              <div className="mt-3">
                <SocialLinks />
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ────────── BUSCADOR MOBILE ────────── */}
      {busquedaOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeBusqueda} />
          <div className="absolute inset-x-0 top-0 bg-base-100 border-b border-line p-4">
            <div className="h-9 flex items-center px-3 mb-3 text-sm uppercase tracking-widest opacity-50 border-b border-line">
              Buscar
            </div>
            <Buscador
              className="w-full h-9 px-3 bg-base-200"
              onNavegar={closeBusqueda}
            />
          </div>
        </div>
      )}

      {/* ────────── BARRA INFERIOR MOBILE ────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-base-100 border-t border-line grid grid-cols-4 h-14">
        <Link to="/" className="flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wider">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.125 1.125 0 011.59 0L21.75 12M4.5 9.75V21h15V9.75" />
          </svg>
          Inicio
        </Link>

        <button
          type="button"
          onClick={toggleMenu}
          className="flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wider"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          Menú
        </button>

        <button
          type="button"
          onClick={() => setBusquedaOpen(true)}
          className="flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wider"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          Buscar
        </button>

        <div className="hidden lg:flex flex-col items-center justify-center gap-1"></div>
        <div className="hidden lg:flex flex-col items-center justify-center gap-1"></div>

        <button
          type="button"
          onClick={openCart}
          className="flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-wider relative col-start-4"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
          Bolsa
          {count > 0 && (
            <span className="absolute top-2 right-[22%] rounded-full min-w-4 h-4 px-1 flex items-center justify-center text-[10px] bg-neutral text-neutral-content">
              {count}
            </span>
          )}
        </button>
      </nav>

      {/* ────────── CARRITO ────────── */}
      {carritoAbierto && <CarritoDrawer />}
    </>
  )
}
