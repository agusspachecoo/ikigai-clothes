-- IKIGAI CLOTHES - Zippin / Zipnova envío
-- Almacena el detalle del método de envío seleccionado en la orden.

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS envio_detalle jsonb;
