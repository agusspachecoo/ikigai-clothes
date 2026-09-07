-- ============================================
-- 006: Fotos de la Comunidad - Panel Admin
-- ============================================
-- Añade columna 'orden' (opcional) para controlar el orden visual
ALTER TABLE comunidad_fotos ADD COLUMN IF NOT EXISTS orden integer;

-- Índice para ordenar por orden y fecha
CREATE INDEX IF NOT EXISTS idx_comunidad_fotos_orden ON comunidad_fotos(orden, created_at);

-- Lectura pública de fotos aprobadas (ya cubierta en 001, se garantiza idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comunidad_fotos' AND policyname = 'Fotos comunidad aprobadas visibles'
  ) THEN
    CREATE POLICY "Fotos comunidad aprobadas visibles" ON comunidad_fotos
      FOR SELECT USING (aprobado = true);
  END IF;
END
$$;
