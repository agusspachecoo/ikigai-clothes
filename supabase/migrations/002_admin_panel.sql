-- ============================================
-- IKIGAI CLOTHES - Migración 002: Panel Admin (DEV)
-- ============================================
-- NOTA: Estas políticas son SOLO para desarrollo.
-- Permiten que la app web (cliente anónimo) realice operaciones
-- de administración directamente. Antes de producción hay que
-- reemplazarlas por autenticación real (auth.role()='authenticated')
-- combinada con Supabase Auth y/o Edge Functions con service_role.

-- Estado unificado del pedido
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendiente'
  CHECK (estado IN ('pendiente', 'pagado', 'enviado', 'cancelado'));

-- ============================================
-- Reemplazar políticas de admin (rol authenticated) por
-- políticas de administración abiertas (DEV)
-- ============================================

DROP POLICY IF EXISTS "Admin gestiona productos" ON productos;
DROP POLICY IF EXISTS "Admin gestiona stock" ON variaciones_stock;
DROP POLICY IF EXISTS "Admin gestiona outfits" ON outfits;
DROP POLICY IF EXISTS "Admin gestiona outfit items" ON outfit_items;
DROP POLICY IF EXISTS "Admin modera reseñas" ON resenas;
DROP POLICY IF EXISTS "Admin modera fotos comunidad" ON comunidad_fotos;
DROP POLICY IF EXISTS "Admin gestiona órdenes" ON ordenes;
DROP POLICY IF EXISTS "Admin gestiona items de orden" ON orden_items;

-- Permitir lectura de TODOS los productos (incl. inactivos) en el panel
CREATE POLICY "Admin panel - leer productos" ON productos
  FOR SELECT USING (true);

CREATE POLICY "Admin panel - gestionar productos" ON productos
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin panel - actualizar productos" ON productos
  FOR UPDATE USING (true);

CREATE POLICY "Admin panel - borrar productos" ON productos
  FOR DELETE USING (true);

CREATE POLICY "Admin panel - gestionar stock" ON variaciones_stock
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admin panel - gestionar outfits" ON outfits
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Admin panel - gestionar outfit items" ON outfit_items
  FOR ALL USING (true) WITH CHECK (true);

-- Moderación de reseñas: admin ve todas y las aprueba/rechaza
CREATE POLICY "Admin panel - leer reseñas" ON resenas
  FOR SELECT USING (true);
CREATE POLICY "Admin panel - moderar reseñas" ON resenas
  FOR UPDATE USING (true);
CREATE POLICY "Admin panel - borrar reseñas" ON resenas
  FOR DELETE USING (true);

-- Moderación de fotos de comunidad
CREATE POLICY "Admin panel - leer fotos" ON comunidad_fotos
  FOR SELECT USING (true);
CREATE POLICY "Admin panel - moderar fotos" ON comunidad_fotos
  FOR UPDATE USING (true);
CREATE POLICY "Admin panel - borrar fotos" ON comunidad_fotos
  FOR DELETE USING (true);

-- Órdenes: admin ve todas y actualiza estados
CREATE POLICY "Admin panel - leer órdenes" ON ordenes
  FOR SELECT USING (true);
CREATE POLICY "Admin panel - actualizar órdenes" ON ordenes
  FOR UPDATE USING (true);

CREATE POLICY "Admin panel - leer items orden" ON orden_items
  FOR SELECT USING (true);

-- ============================================
-- ÍNDICES adicionales
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ordenes_estado_unico ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_outfit_items_outfit ON outfit_items(outfit_id);
CREATE INDEX IF NOT EXISTS idx_comunidad_aprobado ON comunidad_fotos(aprobado);