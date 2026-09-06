-- ============================================
-- IKIGAI CLOTHES - Migración 004: Mercado Pago
-- ============================================

-- Campos para trazabilidad de pagos con Mercado Pago
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS mp_preference_id text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS mp_payment_id text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS mp_pago_detalle jsonb;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();