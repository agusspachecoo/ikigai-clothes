import { Outlet, Link, useLocation } from 'react-router-dom'
import { SocialLinks } from '../components/SocialLinks'
import { Buscador } from '../components/Buscador'
import { useCart } from '../context/cart'
import { useCategorias } from '../hooks/useCategorias'
import { CONTACTO, WHATSAPP_URL } from '../lib/contacto'
import logo from '../assets/logo-transparent.png'
import logoWhite from '../assets/logo-white.png'

const NAV_ITEMS = [
  { to: '/', label: 'Inicio' },
  { to: '/catalogo', label: 'Catálogo' },
  { to: '/outfits', label: 'Outfits' },
  { to: '/contacto', label: 'Contacto' },
]

export function StoreLayout() {
  const location = useLocation()
  const { items, count, total, actualizarCantidad, eliminarItem, carritoAbierto, setCarritoAbierto } =
    useCart()
  const { categorias } = useCategorias()

  function esActivo(path: string) {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  function cerrarMenu() {
    const toggle = document.getElementById('mobile-menu-drawer') as HTMLInputElement | null
    if (toggle) toggle.checked = false
  }

  function cerrarCarrito() {
    setCarritoAbierto(false)
  }

  return (
    <div className="drawer min-h-screen bg-base-200">
      <input id="mobile-menu-drawer" type="checkbox" className="drawer-toggle" />

      {/* Contenido principal */}
      <div className="drawer-content flex flex-col min-h-screen">
        {/* Announcement Bar */}
        <div className="bg-primary text-primary-content text-center text-xs md:text-sm py-2 px-4 tracking-wide">
          <span>Envíos a todo el país</span>
          <span className="mx-3 opacity-40">|</span>
          <span>Retiro en el showroom sin cargo</span>
        </div>

        {/* Header */}
        <header className="bg-[#111111] text-white border-b border-white/10 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center gap-3">
            {/* Botón hamburguesa (mobile) */}
            <label
              htmlFor="mobile-menu-drawer"
              aria-label="Abrir menú"
              className="btn btn-ghost btn-circle lg:hidden text-white hover:bg-white/10"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </label>

            {/* Logo */}
            <Link to="/" aria-label="Ikigai Clothes - Inicio" className="shrink-0">
              <img
                src={logoWhite}
                alt="Ikigai Clothes"
                className="h-10 max-h-10 md:h-12 md:max-h-12 w-auto"
              />
            </Link>

            {/* Navegación desktop */}
            <nav className="hidden lg:flex items-center gap-8 mx-auto">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`text-sm font-medium transition-colors relative py-1 ${
                    esActivo(item.to)
                      ? 'text-white font-semibold after:absolute after:left-0 after:right-0 after:-bottom-0.5 after:h-0.5 after:bg-white after:rounded-full'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="dropdown dropdown-hover">
                <div
                  tabIndex={0}
                  role="button"
                  className={`flex items-center gap-1 text-sm font-medium transition-colors relative py-1 ${
                    esActivo('/catalogo') ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Categorías
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content menu bg-base-100 text-gray-900 rounded-xl shadow-lg border border-base-300 w-52 z-50 p-1.5"
                >
                  <li>
                    <Link to="/catalogo">Ver catálogo completo</Link>
                  </li>
                  {categorias.map((cat) => (
                    <li key={cat.id}>
                      <Link to={`/catalogo?categoria=${cat.slug}`}>{cat.nombre}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>

            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              {/* Buscador desktop */}
              <Buscador
                className="hidden lg:block input input-bordered input-sm w-56 xl:w-72 items-center gap-2 bg-white/10 text-white border-white/20"
              />

              {/* Carrito */}
              <div className="drawer drawer-end w-auto">
                <input
                  id="cart-drawer"
                  type="checkbox"
                  className="drawer-toggle"
                  checked={carritoAbierto}
                  onChange={(e) => setCarritoAbierto(e.target.checked)}
                />
                <label htmlFor="cart-drawer" className="btn btn-ghost btn-circle text-white hover:bg-white/10">
                  <div className="indicator">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                    </svg>
                    <span className="badge badge-sm indicator-item bg-white text-neutral border-white">{count}</span>
                  </div>
                </label>
                <div className="drawer-side z-50">
                  <label htmlFor="cart-drawer" className="drawer-overlay"></label>
                  <div className="menu bg-base-100 text-base-content w-80 min-h-full p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900">Tu Carrito</h2>
                      <span className="badge badge-primary">{count}</span>
                    </div>

                    {items.length === 0 ? (
                      <div className="text-sm opacity-60">
                        <p className="mb-4">El carrito está vacío</p>
                        <Link
                          to="/catalogo"
                          onClick={cerrarCarrito}
                          className="btn btn-primary btn-block"
                        >
                          Ver productos
                        </Link>
                      </div>
                    ) : (
                      <>
                        <ul className="space-y-4">
                          {items.map((it) => (
                            <li
                              key={`${it.producto_id}|${it.talle}`}
                              className="flex gap-3 items-start"
                            >
                              <Link
                              to={`/producto/${it.producto_id}`}
                              onClick={cerrarCarrito}
                              className="shrink-0 block"
                              aria-label={`Ver ${it.nombre}`}
                            >
                              <img
                                src={it.imagen}
                                alt={it.nombre}
                                className="w-14 h-16 object-cover rounded-lg bg-base-300 hover:opacity-80 transition-opacity"
                              />
                            </Link>
                            <div className="flex-1 min-w-0">
                              <Link
                                to={`/producto/${it.producto_id}`}
                                onClick={cerrarCarrito}
                                className="text-sm font-semibold truncate block text-gray-900 hover:text-primary hover:underline transition-colors"
                              >
                                {it.nombre}
                              </Link>
                              <p className="text-xs opacity-70 text-gray-600">Talle {it.talle || 'Único'}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <button
                                    className="btn btn-xs btn-ghost"
                                    aria-label="Disminuir cantidad"
                                    onClick={() =>
                                      actualizarCantidad(it.producto_id, it.talle, it.cantidad - 1)
                                    }
                                  >
                                    −
                                  </button>
                                  <span className="text-sm font-semibold text-gray-900">{it.cantidad}</span>
                                  <button
                                    className="btn btn-xs btn-ghost"
                                    aria-label="Aumentar cantidad"
                                    onClick={() =>
                                      actualizarCantidad(it.producto_id, it.talle, it.cantidad + 1)
                                    }
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">
                                  $ {(it.precio_unitario * it.cantidad).toLocaleString('es-AR')}
                                </p>
                                <button
                                  className="btn btn-xs btn-ghost text-error"
                                  onClick={() => eliminarItem(it.producto_id, it.talle)}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>

                        <div className="divider my-4"></div>
                        <div className="flex items-center justify-between font-bold">
                          <span className="text-gray-900">Total</span>
                          <span className="text-gray-900">$ {total.toLocaleString('es-AR')}</span>
                        </div>

                        <div className="mt-6 space-y-2">
                          <Link
                            to="/checkout"
                            onClick={cerrarCarrito}
                            className="btn btn-primary btn-block"
                          >
                            Finalizar compra
                          </Link>
                          <label htmlFor="cart-drawer" className="btn btn-ghost btn-block">
                            Seguir comprando
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-[#111111] text-white border-t border-white/10 mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <img src={logoWhite} alt="Ikigai Clothes" className="h-12 w-auto" />
                <p className="text-sm text-white/60 mt-3 max-w-xs">
                  Ropa urbana y deportiva con estilo y actitud. Encontrá tu esencia.
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-widest text-white/50 mb-3">Navegación</h4>
                <ul className="text-sm space-y-2">
                  {NAV_ITEMS.map((item) => (
                    <li key={item.to}>
                      <Link to={item.to} className="link link-hover text-white/80">{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold uppercase tracking-widest text-white/50 mb-3">Contacto</h4>
                <ul className="text-sm space-y-2">
                  <li>
                    <a
                      href={`mailto:${CONTACTO.email}`}
                      className="link link-hover text-white/80"
                    >
                      {CONTACTO.email}
                    </a>
                  </li>
                  <li>
                    <a
                      href={WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-hover text-white/80"
                    >
                      {CONTACTO.whatsappVisible}
                    </a>
                  </li>
                </ul>
                <img src={logoWhite} alt="Ikigai Clothes" className="h-14 w-auto mx-auto mt-8" />
                <SocialLinks className="mt-3 justify-center" />
              </div>
            </div>
            <div className="divider my-6"></div>
            <p className="text-center text-xs text-white/50">&copy; 2026 Ikigai Clothes. Todos los derechos reservados.</p>
          </div>
        </footer>
      </div>

      {/* Menú lateral mobile */}
      <div className="drawer-side z-[70]">
        <label htmlFor="mobile-menu-drawer" className="drawer-overlay"></label>
        <aside className="menu bg-base-100 text-base-content w-80 min-h-full p-6 gap-6">
          <div className="flex items-center justify-between">
            <img src={logo} alt="Ikigai Clothes" className="h-10 w-auto" />
            <label htmlFor="mobile-menu-drawer" className="btn btn-ghost btn-circle btn-sm" aria-label="Cerrar menú">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </label>
          </div>

          {/* Buscador mobile */}
          <Buscador
            className="input input-bordered w-full items-center gap-2"
            onNavegar={cerrarMenu}
          />

          {/* Navegación mobile */}
          <nav>
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={cerrarMenu}
                    className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                      esActivo(item.to)
                        ? 'bg-base-300 text-primary font-semibold'
                        : 'opacity-75 hover:bg-base-300 hover:opacity-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="divider my-0"></div>

          {/* Categorías */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-3">Categorías</p>
            <ul className="space-y-1">
              {categorias.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/catalogo?categoria=${cat.slug}`}
                    onClick={cerrarMenu}
                    className="block rounded-lg px-4 py-2 text-sm opacity-75 hover:bg-base-300 hover:opacity-100 transition-colors"
                  >
                    {cat.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="divider my-0"></div>

          {/* Redes sociales */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-3">Seguinos en redes</p>
            <SocialLinks />
          </div>
        </aside>
      </div>
    </div>
  )
}