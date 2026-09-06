-- ============================================
-- IKIGAI CLOTHES - Migración 005: Descuento de stock (webhook Mercado Pago)
-- ============================================

-- Flag para descontar el stock una única vez por pedido.
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS stock_descontado boolean NOT NULL DEFAULT false;

-- Descuenta el stock de las prendas de un pedido de forma atómica e idempotente:
-- - Marca la orden con stock_descontado = true en la misma transacción.
-- - Si la orden ya estaba descontada, no hace nada (evita doble descuento
--   si Mercado Pago reenvía la misma notificación).
-- - Nunca deja stock negativo (GREATEST).
CREATE OR REPLACE FUNCTION descontar_stock(p_orden_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item RECORD;
BEGIN
  UPDATE ordenes
  SET stock_descontado = true
  WHERE id = p_orden_id AND stock_descontado = false;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR item IN
    SELECT producto_id, talle, cantidad
    FROM orden_items
    WHERE orden_id = p_orden_id
  LOOP
    UPDATE variaciones_stock
    SET stock_disponible = GREATEST(stock_disponible - item.cantidad, 0)
    WHERE producto_id = item.producto_id AND talle = item.talle;
  END LOOP;
END;
$$;