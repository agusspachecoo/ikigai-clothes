-- ============================================
-- IKIGAI CLOTHES - Migración 007: RLS Outfits (DEV)
-- ============================================
-- Corrige el error "new row violates row-level security policy"
-- al crear/editar outfits desde el Panel Admin.
--
-- El login del panel es solo frontend (flag en localStorage), por lo
-- que las consultas viajan con rol `anon`. Las políticas de la migración
-- 001 exigían auth.role()='authenticated' y no dejaban escribir.
-- Estas políticas abiertas (USING (true)) permiten administrar los
-- outfits directamente desde el cliente web (solo para desarrollo;
-- en producción reemplazar por autenticación real o Edge Functions).

-- Tabla `outfits` (INSERT / UPDATE)
DROP POLICY IF EXISTS "Admin gestiona outfits" ON outfits;
DROP POLICY IF EXISTS "Admin panel - gestionar outfits" ON outfits;
CREATE POLICY "Admin panel - gestionar outfits" ON outfits
  FOR ALL USING (true) WITH CHECK (true);

-- Tabla intermedia `outfit_items` (DELETE + INSERT)
DROP POLICY IF EXISTS "Admin gestiona outfit items" ON outfit_items;
DROP POLICY IF EXISTS "Admin panel - gestionar outfit items" ON outfit_items;
CREATE POLICY "Admin panel - gestionar outfit items" ON outfit_items
  FOR ALL USING (true) WITH CHECK (true);

-- Lectura de productos para el selector de prendas del modal
DROP POLICY IF EXISTS "Admin gestiona productos" ON productos;
DROP POLICY IF EXISTS "Admin panel - leer productos" ON productos;
CREATE POLICY "Admin panel - leer productos" ON productos
  FOR SELECT USING (true);

-- Lectura de stock para el selector de prendas del modal
DROP POLICY IF EXISTS "Admin gestiona stock" ON variaciones_stock;
CREATE POLICY "Admin panel - leer stock" ON variaciones_stock
  FOR SELECT USING (true);