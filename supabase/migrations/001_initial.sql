-- ============================================
-- IKIGAI CLOTHES - Migración Inicial
-- ============================================

-- Productos
CREATE TABLE IF NOT EXISTS productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  categoria text NOT NULL,
  precio numeric NOT NULL,
  precio_transferencia numeric,
  imagenes text[] NOT NULL DEFAULT '{}',
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Variaciones de Stock por Talle
CREATE TABLE IF NOT EXISTS variaciones_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid REFERENCES productos(id) ON DELETE CASCADE NOT NULL,
  talle text NOT NULL,
  stock_disponible integer NOT NULL DEFAULT 0
);

-- Outfits / Combos
CREATE TABLE IF NOT EXISTS outfits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  precio_combo numeric NOT NULL,
  imagen_portada text NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outfit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id uuid REFERENCES outfits(id) ON DELETE CASCADE NOT NULL,
  producto_id uuid REFERENCES productos(id) ON DELETE CASCADE NOT NULL
);

-- Órdenes / Pedidos
CREATE TABLE IF NOT EXISTS ordenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nombre text NOT NULL,
  cliente_email text NOT NULL,
  cliente_telefono text NOT NULL,
  cliente_dni text NOT NULL,
  direccion text NOT NULL,
  codigo_postal text NOT NULL,
  metodo_pago text NOT NULL CHECK (metodo_pago IN ('mercadopago', 'transferencia')),
  monto_total numeric NOT NULL,
  costo_envio numeric NOT NULL,
  estado_pago text DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado')),
  estado_envio text DEFAULT 'pendiente',
  comprobante_url text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orden_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid REFERENCES ordenes(id) ON DELETE CASCADE NOT NULL,
  producto_id uuid REFERENCES productos(id),
  talle text NOT NULL,
  cantidad integer NOT NULL,
  precio_unitario numeric NOT NULL
);

-- Reseñas y Valoraciones
CREATE TABLE IF NOT EXISTS resenas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid REFERENCES productos(id) ON DELETE CASCADE NOT NULL,
  nombre_usuario text NOT NULL,
  puntuacion integer CHECK (puntuacion >= 1 AND puntuacion <= 5) NOT NULL,
  comentario text NOT NULL,
  imagen_url text,
  aprobado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Fotos de la Comunidad
CREATE TABLE IF NOT EXISTS comunidad_fotos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_usuario text NOT NULL,
  instagram_handle text,
  imagen_url text NOT NULL,
  aprobado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE variaciones_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orden_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunidad_fotos ENABLE ROW LEVEL SECURITY;

-- Productos: lectura pública para activos, escritura solo admin
CREATE POLICY "Productos visibles públicamente" ON productos
  FOR SELECT USING (activo = true);

CREATE POLICY "Admin gestiona productos" ON productos
  FOR ALL USING (auth.role() = 'authenticated');

-- Variaciones de stock: lectura pública
CREATE POLICY "Stock visible públicamente" ON variaciones_stock
  FOR SELECT USING (true);

CREATE POLICY "Admin gestiona stock" ON variaciones_stock
  FOR ALL USING (auth.role() = 'authenticated');

-- Outfits: lectura pública para activos
CREATE POLICY "Outfits visibles públicamente" ON outfits
  FOR SELECT USING (activo = true);

CREATE POLICY "Admin gestiona outfits" ON outfits
  FOR ALL USING (auth.role() = 'authenticated');

-- Outfit items: lectura pública
CREATE POLICY "Outfit items visibles públicamente" ON outfit_items
  FOR SELECT USING (true);

CREATE POLICY "Admin gestiona outfit items" ON outfit_items
  FOR ALL USING (auth.role() = 'authenticated');

-- Reseñas: lectura pública solo aprobadas, insert pública
CREATE POLICY "Reseñas aprobadas visibles" ON resenas
  FOR SELECT USING (aprobado = true);

CREATE POLICY "Cualquiera puede insertar reseña" ON resenas
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin modera reseñas" ON resenas
  FOR ALL USING (auth.role() = 'authenticated');

-- Comunidad fotos: lectura pública solo aprobadas, insert pública
CREATE POLICY "Fotos comunidad aprobadas visibles" ON comunidad_fotos
  FOR SELECT USING (aprobado = true);

CREATE POLICY "Cualquiera puede insertar foto" ON comunidad_fotos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin modera fotos comunidad" ON comunidad_fotos
  FOR ALL USING (auth.role() = 'authenticated');

-- Órdenes: insert pública, lectura solo por email propio o admin
CREATE POLICY "Cualquiera puede crear orden" ON ordenes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin gestiona órdenes" ON ordenes
  FOR ALL USING (auth.role() = 'authenticated');

-- Orden items: insert pública, lectura solo admin
CREATE POLICY "Cualquiera puede crear items de orden" ON orden_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin gestiona items de orden" ON orden_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX idx_productos_categoria ON productos(categoria);
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_variaciones_producto ON variaciones_stock(producto_id);
CREATE INDEX idx_resenas_producto ON resenas(producto_id);
CREATE INDEX idx_ordenes_estado ON ordenes(estado_pago);
