-- Alinea el CHECK de estado_pago con los estados que usa el webhook de Mercado Pago.
-- El webhook puede reportar 'fallido' (rechazado/cancelado); sin este estado el UPDATE
-- viola el constraint y el pago queda como 'pendiente' para siempre.
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_estado_pago_check;
ALTER TABLE ordenes
  ADD CONSTRAINT ordenes_estado_pago_check
  CHECK (estado_pago IN ('pendiente', 'pagado', 'fallido'));
