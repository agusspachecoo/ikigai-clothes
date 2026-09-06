import { HashRouter, Routes, Route } from 'react-router-dom'
import { StoreLayout } from './layouts/StoreLayout'
import { Home } from './pages/Home'
import { Catalogo } from './pages/Catalogo'
import { Producto } from './pages/Producto'
import { Outfits } from './pages/Outfits'
import { Contacto } from './pages/Contacto'
import { Checkout } from './pages/Checkout'
import { CheckoutResultado } from './pages/CheckoutResultado'
import { AdminLayout } from './layouts/AdminLayout'
import { Dashboard } from './pages/admin/Dashboard'
import { ProductosAdmin } from './pages/admin/ProductosAdmin'
import { OutfitsAdmin } from './pages/admin/OutfitsAdmin'
import { CategoriasAdmin } from './pages/admin/CategoriasAdmin'
import { PedidosAdmin } from './pages/admin/PedidosAdmin'
import { ResenasAdmin } from './pages/admin/ResenasAdmin'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/producto/:id" element={<Producto />} />
          <Route path="/outfits" element={<Outfits />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/checkout/success" element={<CheckoutResultado status="success" />} />
          <Route path="/checkout/failure" element={<CheckoutResultado status="failure" />} />
          <Route path="/checkout/pending" element={<CheckoutResultado status="pending" />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="productos" element={<ProductosAdmin />} />
            <Route path="outfits" element={<OutfitsAdmin />} />
            <Route path="categorias" element={<CategoriasAdmin />} />
            <Route path="pedidos" element={<PedidosAdmin />} />
            <Route path="resenas" element={<ResenasAdmin />} />
          </Route>
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
