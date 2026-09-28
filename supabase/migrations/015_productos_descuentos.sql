-- ============================================
-- IKIGAI CLOTHES - Descuentos en productos
-- ============================================

-- Porcentaje de descuento promocional (0 = sin descuento). El precio
-- promocional se calcula como precio * (1 - discount_percent / 100).
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

CREATE INDEX IF NOT EXISTS idx_productos_descuento
  ON productos(discount_percent)
  WHERE discount_percent > 0;