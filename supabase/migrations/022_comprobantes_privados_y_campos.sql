-- ============================================================
-- 022_comprobantes_privados_y_campos.sql
--
-- Bloque 1 - Privacidad de los comprobantes:
--   El bucket "comprobantes" pasa a privado. Los recibos de transferencia
--   tienen nombre, DNI y datos bancarios del cliente: con public = true la URL
--   alcanzaba para verlos sin sesión.
--
--   Ojo con el detalle importante: poner el bucket en privado NO alcanza solo.
--   La policy "Anyone can view comprobantes" (SELECT para el rol public, de
--   010_comprobantes.sql) seguía sirviendo el archivo por el endpoint
--   autenticado (/object/authenticated/...) a cualquiera que tuviera el path,
--   que es lo que hace que funcione el enlace "Abrir en nueva pestaña". Por eso
--   la policy también se va, y la lectura queda solo para es_admin(): el panel
--   genera una signed URL con expiración para ver el comprobante.
--
--   La subida del comprobante por el comprador (guest, sin cuenta) no cambia:
--   subir no requiere bucket público, solo la policy de INSERT.
--
-- Bloque 2 - Campos nuevos:
--   productos.sku          → búsqueda por código en el panel de productos
--   categorias.imagen_url  → imagen representativa por categoría
--   banners.imagen_mobile  → versión vertical del banner para mobile
--
-- Aplicar con:
--   npx supabase db query --linked -f supabase/migrations/022_comprobantes_privados_y_campos.sql
-- ============================================================


-- ============================================================
-- PRECHECK
-- ============================================================
DO $$
DECLARE
  faltan text[] := '{}';
BEGIN
  IF to_regclass('public.productos') IS NULL THEN
    faltan := faltan || 'public.productos (falta 001_initial.sql)';
  END IF;
  IF to_regclass('public.categorias') IS NULL THEN
    faltan := faltan || 'public.categorias (falta 003_dynamic_categories.sql)';
  END IF;
  IF to_regclass('public.banners') IS NULL THEN
    faltan := faltan || 'public.banners (falta 009_banners.sql)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'comprobantes') THEN
    faltan := faltan || 'bucket comprobantes (falta 010_comprobantes.sql)';
  END IF;
  IF to_regprocedure('public.es_admin()') IS NULL THEN
    faltan := faltan || 'public.es_admin() (falta 012_auth.sql)';
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '022 no se puede aplicar: falta migración previa.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 001, 003, 009, 010 y 012 en orden antes de correr 022.';
  END IF;

  RAISE NOTICE 'PRECHECK OK. Continuando con 022.';
END;
$$;


-- ============================================================
-- 1. El bucket de comprobantes pasa a privado
-- ============================================================
UPDATE storage.buckets
   SET public = false
 WHERE id = 'comprobantes'
   AND public IS DISTINCT FROM false;

-- La lectura pública del bucket queda cerrada. La que queda es la de
-- "Admin gestiona comprobantes" (021), que exige es_admin().
DROP POLICY IF EXISTS "Anyone can view comprobantes" ON storage.objects;

-- product-images sigue siendo público a propósito: son fotos de catálogo.
-- product-images no se toca.


-- ============================================================
-- 2. productos.sku
-- ============================================================
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS sku text;

COMMENT ON COLUMN public.productos.sku IS
  'Código interno / SKU. Se usa para buscar productos desde el panel.';

-- Único e insensible a mayúsculas, ignorando los vacíos (varios productos
-- pueden quedar sin código y así no colisionan entre sí).
--
-- No hace falta un índice de búsqueda aparte: la búsqueda del panel
-- (ProductosAdmin) filtra en memoria, como el resto del catálogo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_sku_unico
  ON public.productos (lower(btrim(sku)))
  WHERE sku IS NOT NULL AND btrim(sku) <> '';


-- ============================================================
-- 3. categorias.imagen_url
-- ============================================================
ALTER TABLE public.categorias ADD COLUMN IF NOT EXISTS imagen_url text;

COMMENT ON COLUMN public.categorias.imagen_url IS
  'Imagen representativa de la categoría (bucket product-images, carpeta categorias/).';


-- ============================================================
-- 4. banners.imagen_mobile
-- ============================================================
ALTER TABLE public.banners ADD COLUMN IF NOT EXISTS imagen_mobile text;

COMMENT ON COLUMN public.banners.imagen_mobile IS
  'Versión vertical del banner para mobile. Si queda vacía se usa imagen_url.';


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- El bucket tiene que quedar privado:
--   select id, public from storage.buckets order by id;
--   -- comprobantes: false | product-images: true
--
-- Ninguna policy de lectura pública sobre comprobantes:
--   select policyname, cmd, roles from pg_policies
--    where schemaname='storage' and tablename='objects'
--      and qual like '%comprobantes%';
--   -- solo "Admin gestiona comprobantes" (authenticated)
--
-- Las columnas nuevas:
--   select column_name, data_type from information_schema.columns
--    where table_schema='public'
--      and (table_name, column_name) in
--          (('productos','sku'), ('categorias','imagen_url'), ('banners','imagen_mobile'));
--
-- SKU repetidos (tiene que dar 0 filas):
--   select lower(btrim(sku)) codigo, count(*)
--     from public.productos
--    where btrim(coalesce(sku,'')) <> ''
--    group by 1 having count(*) > 1;


-- ============================================================
-- REVERTIR
-- ============================================================
-- update storage.buckets set public = true where id = 'comprobantes';
-- create policy "Anyone can view comprobantes" on storage.objects
--   for select using (bucket_id = 'comprobantes');
-- alter table public.productos drop column if exists sku;
-- alter table public.categorias drop column if exists imagen_url;
-- alter table public.banners drop column if exists imagen_mobile;
-- ============================================================