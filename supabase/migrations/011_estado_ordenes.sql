-- ============================================
-- IKIGAI CLOTHES - Migración 011: Estados de orden
-- ============================================
-- Alinea el check constraint con los estados reales usados en el frontend.
-- Se elimina 'aprobado' / 'rechazado' (no existen en DB) y se agregan
-- 'pendiente_verificacion' (comprobante de transferencia subido) y 'entregado'.

-- Seguridad: mapear valores que pudieran existir en caso de constraints previos
UPDATE ordenes SET estado = 'pagado' WHERE estado = 'aprobado' OR estado = 'rechazado';

ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_check;

ALTER TABLE ordenes ADD CONSTRAINT ordenes_estado_check
  CHECK (estado IN ('pendiente', 'pendiente_verificacion', 'pagado', 'enviado', 'entregado', 'cancelado'));