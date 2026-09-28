-- ============================================
-- 009: Banners - Carrusel Hero
-- ============================================
-- Tabla para configurar las imágenes del banner principal (carrusel).
-- Si no hay filas activas, la tienda usa imágenes de respaldo (Unsplash).
CREATE TABLE IF NOT EXISTS banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imagen_url text NOT NULL,
  titulo text,
  link_url text,
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Índice para ordenar el carrusel
CREATE INDEX IF NOT EXISTS idx_banners_orden ON banners(orden, created_at);

-- Lectura pública de banners activos
CREATE POLICY "Banners activos visibles" ON banners
  FOR SELECT USING (activo = true);

-- Panel admin (DEV): lectura y gestión abierta (misma convención que 002)
CREATE POLICY "Admin panel - leer banners" ON banners
  FOR SELECT USING (true);

CREATE POLICY "Admin panel - gestionar banners" ON banners
  FOR ALL USING (true) WITH CHECK (true);