-- ============================================
-- IKIGAI CLOTHES - Migración 003: Categorías Dinámicas
-- ============================================

-- Tabla de categorías
CREATE TABLE IF NOT EXISTS categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now()
);

-- Insertar las categorías iniciales
INSERT INTO categorias (nombre, slug) VALUES
  ('Remeras', 'remeras'),
  ('Buzos', 'buzos'),
  ('Pantalones', 'pantalones'),
  ('Accesorios', 'accesorios')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Lectura pública (cualquier visitante puede ver las categorías)
CREATE POLICY "Categorías visibles públicamente" ON categorias
  FOR SELECT USING (true);

-- Escritura admin (mismo criterio DEV que 002_admin_panel.sql:
-- habilitada en el cliente anónimo para el panel de administración.
-- Antes de producción, reemplazar por auth.role()='authenticated').
CREATE POLICY "Admin panel - crear categorías" ON categorias
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin panel - actualizar categorías" ON categorias
  FOR UPDATE USING (true);

CREATE POLICY "Admin panel - borrar categorías" ON categorias
  FOR DELETE USING (true);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_categorias_slug ON categorias(slug);