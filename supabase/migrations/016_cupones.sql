-- ============================================
-- 016: Cupones y códigos de descuento
-- ============================================
-- Los cupones se validan en la Edge Function `validar-cupon` (service role):
-- el navegador no debe poder listar los códigos ni ver sus valores.
CREATE TABLE IF NOT EXISTS cupones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  descripcion text,
  tipo text NOT NULL DEFAULT 'porcentaje' CHECK (tipo IN ('porcentaje', 'fijo')),
  valor numeric NOT NULL DEFAULT 0 CHECK (valor >= 0),
  descuento_maximo numeric CHECK (descuento_maximo IS NULL OR descuento_maximo > 0),
  minimo_compra numeric NOT NULL DEFAULT 0 CHECK (minimo_compra >= 0),
  usos_max integer CHECK (usos_max IS NULL OR usos_max > 0),
  usos integer NOT NULL DEFAULT 0 CHECK (usos >= 0),
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;

-- El panel de administración se autentica en el frontend (ver src/lib/admin.ts)
-- y opera con la anon key, sin sesión de Supabase: por eso estas políticas usan
-- la misma convención que el resto de las tablas de admin (ver NOTA DE SEGURIDAD
-- en 012_auth.sql). Es un problema conocido del panel, no de esta tabla.
--
-- La validación de cupones nunca confía en el navegador: el descuento se
-- recalcula en la Edge Function con service role y se contrasta contra el
-- monto de la orden (ver create-preference).
CREATE POLICY "Admin panel - leer cupones" ON cupones
  FOR SELECT USING (true);

CREATE POLICY "Admin panel - gestionar cupones" ON cupones
  FOR ALL USING (true) WITH CHECK (true);

-- Pedido: cupón aplicado y descuento resultante (para auditar y reenviar totales)
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS cupon_codigo text;

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS descuento_cupon numeric NOT NULL DEFAULT 0;

-- Marca de consumo: evita contar dos veces el mismo cupón si el webhook
-- se reintenta, sin depender del estado de pago de la orden.
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS cupon_consumido timestamptz;

CREATE INDEX IF NOT EXISTS idx_ordenes_cupon ON ordenes(cupon_codigo);

-- Suma un uso al cupón cuando el pago queda confirmado.
-- Idempotente: solo cuenta la primera vez que se marca la orden.
CREATE OR REPLACE FUNCTION public.usar_cupon(p_codigo text, p_orden_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ordenes
     SET cupon_consumido = now()
   WHERE id = p_orden_id
     AND cupon_codigo = p_codigo
     AND cupon_consumido IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE cupones
     SET usos = usos + 1
   WHERE codigo = p_codigo;
END;
$$;

-- Solo el backend (webhook con service role) puede consumir cupones.
REVOKE ALL ON FUNCTION public.usar_cupon(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.usar_cupon(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usar_cupon(text, uuid) TO service_role;
