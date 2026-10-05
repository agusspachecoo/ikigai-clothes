-- ============================================================
-- 021_cierra_storage_publico.sql
--
-- Cierra "Storage Permitir todo publico" (ALL, rol public, USING true) sobre
-- storage.objects. Con esa policy, CUALQUIER visitante anónimo podía escribir,
-- sobreescribir y borrar objetos de TODOS los buckets con solo la anon key.
--
-- Reemplaza el permiso abierto por permisos mínimos según quién hace qué.
--
-- ── Auditoría previa (qué necesita la app y desde qué rol) ──────────────
--
--   Flujo                                        Bucket / carpeta      Rol
--   -------------------------------------------  --------------------  ---------------
--   Ficha de producto: foto de reseña             product-images/reviews  anon
--   Checkout: comprobante de transferencia       comprobantes/           anon (guest)
--   Panel: productos, outfits, banners,          product-images/*        es_admin
--     comunidad, showroom (sube y borra la vieja)
--
--   com.productos/outfits/etc. siguen usando la anon key del frontend, así que
--   "autenticado" NO alcanza como prueba de admin: cualquier cuenta registrada
--   podría subir o pisar el catálogo. Se usa public.es_admin() (ver 012_auth.sql
--   y 019), que lee perfiles.es_admin y ya no es auto-asignable desde el cliente.
--
-- ── Lectura ─────────────────────────────────────────────────────────────
-- Los dos buckets son public = true, así que las imágenes del sitio se siguen
-- sirviendo por URL pública (/object/public/...) sin sesión. Las policies de
-- SELECT quedan explícitas para no depender de ese comportamiento implícito.
--
-- ── Aplicar ─────────────────────────────────────────────────────────────
--   npx supabase db query --linked -f supabase/migrations/021_cierra_storage_publico.sql
-- O pegar el archivo entero en el SQL Editor de Supabase (Dashboard).
--
-- ── Revertir ────────────────────────────────────────────────────────────
--   create policy "Storage Permitir todo publico" on storage.objects
--     for all to public using (true) with check (true);
-- ============================================================


-- ============================================================
-- PRECHECK
-- ============================================================
DO $$
DECLARE
  faltan text[] := '{}';
BEGIN
  IF to_regprocedure('public.es_admin()') IS NULL THEN
    faltan := faltan || 'public.es_admin() (falta 012_auth.sql)';
  END IF;

  IF to_regclass('storage.buckets') IS NULL THEN
    faltan := faltan || 'storage.buckets';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'product-images'
  ) THEN
    faltan := faltan || 'bucket product-images';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'comprobantes'
  ) THEN
    faltan := faltan || 'bucket comprobantes (falta 010_comprobantes.sql)';
  END IF;

  -- Si la 020 está aplicada, el bucket tiene que seguir siendo público o las
  -- imágenes del sitio dejan de cargar sin sesión.
  IF EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'product-images' AND NOT public
  ) THEN
    faltan := faltan || 'product-images debe seguir con public = true';
  END IF;

  IF cardinality(faltan) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '021 no se puede aplicar: falta configuración previa.',
      DETAIL  = array_to_string(faltan, E'\n  - '),
      HINT    = 'Aplicá 010_comprobantes.sql, 012_auth.sql y 020_showroom.sql '
                || 'antes de correr 021.';
  END IF;

  RAISE NOTICE 'PRECHECK OK: buckets y es_admin() presentes. Continuando con 021.';
END;
$$;


-- ============================================================
-- 1. Se cierra el permiso abierto
-- ============================================================
-- Es lo único que cambia el comportamiento del anónimo: hasta acá, esta policy
-- en `public` con USING true era la que hacía pasar la subida de fotos de
-- reseña (rol anon) y cualquier otra escritura. A partir de acá cada operación
-- tiene su propia policy, y las de escritura están acotadas por bucket/carpeta.
DROP POLICY IF EXISTS "Storage Permitir todo publico" ON storage.objects;


-- ============================================================
-- 2. Lectura pública
-- ============================================================
-- El catálogo, los outfits y las fotos de la comunidad se leen sin sesión.
DROP POLICY IF EXISTS "Lectura pública de imágenes" ON storage.objects;
CREATE POLICY "Lectura pública de imágenes" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

-- Los comprobantes los lee el panel desde la URL pública; la policy de SELECT
-- equivalente ya existe como "Anyone can view comprobantes" (010). Se deja
-- como está para no duplicar.


-- ============================================================
-- 3. Escritura anónima: solo los dos flujos de invitado
-- ============================================================

-- 3.a Checkout por transferencia (guest, sin cuenta).
--     Se reemplaza "Anyone can upload comprobantes" (010) por una versión acotada
--     a la carpeta comprobantes/, y se le saca el acceso a authenticated que
--     no hacía falta.
DROP POLICY IF EXISTS "Anyone can upload comprobantes" ON storage.objects;
CREATE POLICY "Invitado sube su comprobante de transferencia" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'comprobantes'
    AND (storage.foldername(name))[1] = 'comprobantes'
  );

-- 3.b Foto opcional de la reseña en la ficha de producto (formulario abierto,
--     sin registro). Solo en reviews/: nadie puede publicar dentro de
--     productos/, outfits/, banners/, comunidad/ ni showroom/.
DROP POLICY IF EXISTS "Invitado sube foto de reseña" ON storage.objects;
CREATE POLICY "Invitado sube foto de reseña" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = 'reviews'
  );


-- ============================================================
-- 4. Escritura del panel: solo administradores
-- ============================================================
-- Cubre los uploader de ProductosAdmin, OutfitsAdmin, BannersAdmin,
-- CommunityAdmin y el de la imagen del showroom (que además borra la foto
-- anterior de la carpeta con storage.remove).
DROP POLICY IF EXISTS "Permitir subida de imagenes en product-images" ON storage.objects;
DROP POLICY IF EXISTS "Permitir update de imagenes en product-images" ON storage.objects;

DROP POLICY IF EXISTS "Admin gestiona imágenes" ON storage.objects;
CREATE POLICY "Admin gestiona imágenes" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images' AND public.es_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.es_admin());

-- 4.b El panel también lista y borra objetos del bucket de comprobantes.
--     Hoy no lo hace (mira la URL pública), pero sin esto no hay forma de
--     borrar un comprobante si el cliente lo pide.
DROP POLICY IF EXISTS "Admin gestiona comprobantes" ON storage.objects;
CREATE POLICY "Admin gestiona comprobantes" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'comprobantes' AND public.es_admin())
  WITH CHECK (bucket_id = 'comprobantes' AND public.es_admin());


-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- 1) Policies resultantes. Deben estar las cinco y ninguna con USING true
--    sobre el rol public:
--
--    select policyname, cmd, roles, coalesce(qual,'-') as using_expr,
--           coalesce(with_check,'-') as check_expr
--      from pg_policies
--     where schemaname = 'storage' and tablename = 'objects'
--     order by policyname;
--
-- 2) Ningún permiso abierto a anon/authenticated sobre otros buckets:
--
--    select policyname, cmd, roles from pg_policies
--     where schemaname='storage' and tablename='objects'
--       and 'public' = any(roles)
--       and coalesce(qual,'') <> 'true'
--       and coalesce(with_check,'') <> 'true';
--
-- 3) Los buckets siguen públicos (si esto devuelve filas, las imágenes
--    del sitio no cargan sin sesión):
--
--    select id, public from storage.buckets order by id;
--
-- 4) Prueba funcional con la anon key (ver README, sección "Storage"):
--    debe dar 200 la foto de reviews/ y 4xx cualquier escritura fuera de
--    products/.

-- ============================================================
-- REVERTIR
-- ============================================================
-- create policy "Storage Permitir todo publico" on storage.objects
--   for all to public using (true) with check (true);
-- ============================================================