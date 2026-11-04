-- ============================================================
-- 032_precios_lista_desde_transferencia.sql
--
-- El precio de transferencia es la base que define el administrador.
-- El precio de lista se calcula invirtiendo el descuento global:
--
--   precio_lista = precio_transferencia / (1 - descuento / 100)
--
-- Ej: con 20% de descuento, una transferencia de $40.000 deja un
-- precio de lista de $50.000.
--
-- Esta migración recalcula los productos existentes que ya tienen un
-- precio de transferencia propio.
-- ============================================================


-- ============================================================
-- PRECHECK
-- ============================================================
DO $$
DECLARE
  descuento_texto text;
  descuento numeric;
BEGIN
  IF to_regclass('public.productos') IS NULL THEN
    RAISE EXCEPTION '032 no se puede aplicar: falta public.productos.';
  END IF;

  IF to_regclass('public.config_tienda') IS NULL THEN
    RAISE EXCEPTION '032 no se puede aplicar: falta public.config_tienda.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'productos'
       AND column_name = 'precio_transferencia'
  ) THEN
    RAISE EXCEPTION '032 no se puede aplicar: falta productos.precio_transferencia.';
  END IF;

  SELECT valor
    INTO descuento_texto
    FROM public.config_tienda
   WHERE clave = 'descuento_transferencia';

  IF descuento_texto IS NULL THEN
    RAISE EXCEPTION '032 no se puede aplicar: falta config_tienda.descuento_transferencia.';
  END IF;

  descuento := replace(trim(descuento_texto), ',', '.')::numeric;

  IF descuento < 0 OR descuento >= 100 THEN
    RAISE EXCEPTION
      '032 no se puede aplicar: descuento_transferencia debe estar entre 0 y 99.99 (valor: %).',
      descuento;
  END IF;

  RAISE NOTICE 'PRECHECK OK. Recalculando precios de lista con descuento %.', descuento;
END;
$$;


-- ============================================================
-- 1. Recalcular precio de lista de productos con transferencia propia
-- ============================================================
DO $$
DECLARE
  descuento numeric;
BEGIN
  SELECT replace(trim(valor), ',', '.')::numeric
    INTO descuento
    FROM public.config_tienda
   WHERE clave = 'descuento_transferencia';

  IF descuento = 0 THEN
    UPDATE public.productos
       SET precio = round(precio_transferencia::numeric, 2)
     WHERE precio_transferencia IS NOT NULL
       AND precio_transferencia > 0;
  ELSE
    UPDATE public.productos
       SET precio = round(
         (precio_transferencia::numeric / (1 - descuento / 100))::numeric,
         2
       )
     WHERE precio_transferencia IS NOT NULL
       AND precio_transferencia > 0;
  END IF;
END;
$$;


-- ============================================================
-- 2. Refrescar la caché de PostgREST (Supabase API)
-- ============================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
--   select nombre,
--          precio as precio_lista,
--          precio_transferencia,
--          round((precio - precio_transferencia) / precio * 100, 2) as descuento_pct
--     from public.productos
--    where precio_transferencia is not null
--      and precio_transferencia > 0
--    order by nombre;
--
-- El descuento_pct debe coincidir con config_tienda.descuento_transferencia.
