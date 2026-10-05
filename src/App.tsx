import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { StoreLayout } from './layouts/StoreLayout'
import { Home } from './pages/Home'
import { Catalogo } from './pages/Catalogo'
import { Producto } from './pages/Producto'

// El bundle inicial se queda con Home y Catalogo; el resto se carga por ruta.
const Categoria = lazy(() => import('./pages/Categoria').then((m) => ({ default: m.Categoria })))
const Outfits = lazy(() => import('./pages/Outfits').then((m) => ({ default: m.Outfits })))
const Contacto = lazy(() => import('./pages/Contacto').then((m) => ({ default: m.Contacto })))
const QuienesSomos = lazy(() =>
  import('./pages/QuienesSomos').then((m) => ({ default: m.QuienesSomos })),
)
const Devoluciones = lazy(() =>
  import('./pages/Devoluciones').then((m) => ({ default: m.Devoluciones })),
)
const PoliticaPrivacidad = lazy(() =>
  import('./pages/PoliticaPrivacidad').then((m) => ({ default: m.PoliticaPrivacidad })),
)
const TerminosCondiciones = lazy(() =>
  import('./pages/TerminosCondiciones').then((m) => ({ default: m.TerminosCondiciones })),
)
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })))
const PreguntasFrecuentes = lazy(() =>
  import('./pages/PreguntasFrecuentes').then((m) => ({ default: m.PreguntasFrecuentes })),
)
const Perfil = lazy(() => import('./pages/Perfil').then((m) => ({ default: m.Perfil })))
const CheckoutGuard = lazy(() =>
  import('./components/CheckoutGuard').then((m) => ({ default: m.CheckoutGuard })),
)
const CheckoutResultado = lazy(() =>
  import('./pages/CheckoutResultado').then((m) => ({ default: m.CheckoutResultado })),
)

const AdminLayout = lazy(() => import('./layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const Dashboard = lazy(() => import('./pages/admin/Dashboard').then((m) => ({ default: m.Dashboard })))
const ProductosAdmin = lazy(() =>
  import('./pages/admin/ProductosAdmin').then((m) => ({ default: m.ProductosAdmin })),
)
const OutfitsAdmin = lazy(() =>
  import('./pages/admin/OutfitsAdmin').then((m) => ({ default: m.OutfitsAdmin })),
)
const CategoriasAdmin = lazy(() =>
  import('./pages/admin/CategoriasAdmin').then((m) => ({ default: m.CategoriasAdmin })),
)
const BannersAdmin = lazy(() =>
  import('./pages/admin/BannersAdmin').then((m) => ({ default: m.BannersAdmin })),
)
const PedidosAdmin = lazy(() =>
  import('./pages/admin/PedidosAdmin').then((m) => ({ default: m.PedidosAdmin })),
)
const ResenasAdmin = lazy(() =>
  import('./pages/admin/ResenasAdmin').then((m) => ({ default: m.ResenasAdmin })),
)
const CommunityAdmin = lazy(() =>
  import('./pages/admin/CommunityAdmin').then((m) => ({ default: m.CommunityAdmin })),
)
const CuponesAdmin = lazy(() =>
  import('./pages/admin/CuponesAdmin').then((m) => ({ default: m.CuponesAdmin })),
)
const NewsletterAdmin = lazy(() =>
  import('./pages/admin/NewsletterAdmin').then((m) => ({ default: m.NewsletterAdmin })),
)
const ConfigAdmin = lazy(() =>
  import('./pages/admin/ConfigAdmin').then((m) => ({ default: m.ConfigAdmin })),
)

function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <span className="loading loading-spinner loading-lg text-neutral" />
          </div>
        }
      >
        <Routes>
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/categoria/:slug" element={<Categoria />} />
          <Route path="/productos" element={<Navigate to="/catalogo" replace />} />
          <Route path="/producto/:id" element={<Producto />} />
          <Route path="/outfits" element={<Outfits />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/quienes-somos" element={<QuienesSomos />} />
          <Route path="/devoluciones" element={<Devoluciones />} />
          <Route path="/preguntas-frecuentes" element={<PreguntasFrecuentes />} />
          <Route path="/politica-de-privacidad" element={<PoliticaPrivacidad />} />
          <Route path="/terminos-y-condiciones" element={<TerminosCondiciones />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/checkout" element={<CheckoutGuard />} />
          <Route path="/checkout/success" element={<CheckoutResultado status="success" />} />
          <Route path="/checkout/failure" element={<CheckoutResultado status="failure" />} />
          <Route path="/checkout/pending" element={<CheckoutResultado status="pending" />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="productos" element={<ProductosAdmin />} />
            <Route path="outfits" element={<OutfitsAdmin />} />
            <Route path="categorias" element={<CategoriasAdmin />} />
            <Route path="banners" element={<BannersAdmin />} />
            <Route path="pedidos" element={<PedidosAdmin />} />
            <Route path="resenas" element={<ResenasAdmin />} />
            <Route path="comunidad" element={<CommunityAdmin />} />
            <Route path="cupones" element={<CuponesAdmin />} />
            <Route path="newsletter" element={<NewsletterAdmin />} />
            <Route path="config" element={<ConfigAdmin />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
