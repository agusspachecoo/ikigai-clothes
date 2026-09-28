-- ============================================================
-- 018_admin_rls.sql
--
-- Cierra el panel de administración.
--
-- Problema que resuelve: hasta acá las políticas de administración
-- usaban USING (true) sobre el rol public, así que cualquier
-- visitante con la anon key podía leer los pedidos (con DNI y
-- dirección), crear cupones del 100%, borrar el catálogo o vaciar
-- la lista de suscriptores. El login del panel tampoco servía como
-- barrera: la contraseña viajaba dentro del bundle de JavaScript.
--
-- El admin ahora es un usuario de Supabase Auth con
-- perfiles.es_admin = true, y public.es_admin() (definida en
-- 012_auth.sql) decide todo.
--
-- Aplicar con:  npx supabase db query --linked -f supabase/migrations/018_admin_rls.sql
-- Revertir con:  ver la sección "revertir" del final del archivo.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Cuentas de administración
-- ------------------------------------------------------------
-- Promote de las cuentas existentes. Para agregar otra cuenta:
--   update public.perfiles set es_admin = true where email = 'correo@dominio';
update public.perfiles set es_admin = true;

-- Cualquier registro nuevo nace sin permisos (default de la tabla).
alter table public.perfiles alter column es_admin set default false;

-- ------------------------------------------------------------
-- 2. Productos
-- ------------------------------------------------------------
drop policy if exists "Admin panel - leer productos" on public.productos;
drop policy if exists "Admin panel - actualizar productos" on public.productos;
drop policy if exists "Admin panel - borrar productos" on public.productos;
-- Esta INSERT era la unica que quedaba con WITH CHECK (true) para el rol
-- public: cualquiera podia crear productos desde el navegador.
drop policy if exists "Admin panel - gestionar productos" on public.productos;

create policy "Admin gestiona productos" on public.productos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Se mantiene "Productos visibles públicamente" (activo = true).

-- ------------------------------------------------------------
-- 3. Variaciones de stock
-- ------------------------------------------------------------
drop policy if exists "Admin panel - leer stock" on public.variaciones_stock;
drop policy if exists "Admin panel - gestionar stock" on public.variaciones_stock;

create policy "Admin gestiona stock" on public.variaciones_stock
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- El stock público solo revela el de prendas activas.
drop policy if exists "Stock visible públicamente" on public.variaciones_stock;

create policy "Stock visible públicamente" on public.variaciones_stock
  for select to public
  using (
    exists (
      select 1 from public.productos p
      where p.id = variaciones_stock.producto_id
        and p.activo
    )
  );

-- ------------------------------------------------------------
-- 4. Outfits
-- ------------------------------------------------------------
drop policy if exists "Admin panel - gestionar outfits" on public.outfits;

create policy "Admin gestiona outfits" on public.outfits
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Esta política daba INSERT/UPDATE/DELETE sobre outfits a CUALQUIER
-- usuario registrado, no solo al admin.
drop policy if exists "Permitir todo en outfits a usuarios autenticados" on public.outfits;

-- Duplicaba "Outfits visibles públicamente" sin filtrar por activo,
-- por lo que dejaba ver outfits inactivos.
drop policy if exists "Permitir lectura publica de outfits" on public.outfits;

-- ------------------------------------------------------------
-- 5. Items de outfit
-- ------------------------------------------------------------
drop policy if exists "Admin panel - gestionar outfit items" on public.outfit_items;

create policy "Admin gestiona outfit items" on public.outfit_items
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

drop policy if exists "Outfit items visibles públicamente" on public.outfit_items;

create policy "Outfit items visibles públicamente" on public.outfit_items
  for select to public
  using (
    exists (
      select 1 from public.outfits o
      where o.id = outfit_items.outfit_id
        and o.activo
    )
  );

-- ------------------------------------------------------------
-- 6. Órdenes
-- ------------------------------------------------------------
-- El admin lee y actualiza todas (PedidosAdmin), pero no las borra:
-- las órdenes son el registro de ventas y auditoría de stock.
drop policy if exists "Admin panel - leer órdenes" on public.ordenes;
drop policy if exists "Admin panel - actualizar órdenes" on public.ordenes;

create policy "Admin lee órdenes" on public.ordenes
  for select to authenticated
  using (public.es_admin());

create policy "Admin actualiza órdenes" on public.ordenes
  for update to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Se mantiene "Cualquiera puede crear orden" (guest checkout) y
-- "El usuario lee sus propias órdenes".

-- ------------------------------------------------------------
-- 7. Items de orden
-- ------------------------------------------------------------
drop policy if exists "Admin panel - leer items orden" on public.orden_items;

create policy "Admin lee items de orden" on public.orden_items
  for select to authenticated
  using (public.es_admin());

-- ------------------------------------------------------------
-- 8. Cupones
-- ------------------------------------------------------------
-- Sin SELECT público: los códigos no se pueden enumerar desde el
-- navegador, los valida la Edge Function con service role.
drop policy if exists "Admin panel - leer cupones" on public.cupones;
drop policy if exists "Admin panel - gestionar cupones" on public.cupones;

create policy "Admin gestiona cupones" on public.cupones
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- ------------------------------------------------------------
-- 9. Reseñas
-- ------------------------------------------------------------
drop policy if exists "Admin panel - leer reseñas" on public.resenas;
drop policy if exists "Admin panel - moderar reseñas" on public.resenas;
drop policy if exists "Admin panel - borrar reseñas" on public.resenas;

create policy "Admin gestiona reseñas" on public.resenas
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- El PRD pide reseñas sin registro de usuario, pero además nadie
-- puede publicarse a sí mismo: todo entra con aprobado = false.
drop policy if exists "Solo usuarios autenticados pueden insertar reseñas" on public.resenas;

create policy "Cualquiera puede enviar una reseña" on public.resenas
  for insert to public
  with check (aprobado is not true);

-- ------------------------------------------------------------
-- 10. Fotos de la comunidad
-- ------------------------------------------------------------
drop policy if exists "Admin panel - leer fotos" on public.comunidad_fotos;
drop policy if exists "Admin panel - moderar fotos" on public.comunidad_fotos;
drop policy if exists "Admin panel - borrar fotos" on public.comunidad_fotos;

create policy "Admin gestiona fotos de comunidad" on public.comunidad_fotos
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Antes el INSERT era WITH CHECK (true): cualquiera podía subir una
-- foto ya aprobada y saltarse la moderación.
drop policy if exists "Cualquiera puede insertar foto" on public.comunidad_fotos;

create policy "Cualquiera puede enviar una foto" on public.comunidad_fotos
  for insert to public
  with check (aprobado is not true);

-- ------------------------------------------------------------
-- 11. Suscriptores del newsletter
-- ------------------------------------------------------------
drop policy if exists "Admin panel - leer suscriptores" on public.suscriptores_newsletter;
drop policy if exists "Admin panel - gestionar suscriptores" on public.suscriptores_newsletter;

create policy "Admin gestiona suscriptores" on public.suscriptores_newsletter
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Se mantiene "Suscripción pública" (INSERT).

-- ------------------------------------------------------------
-- 12. Configuración de la tienda
-- ------------------------------------------------------------
drop policy if exists "Admin panel - gestionar config" on public.config_tienda;

create policy "Admin gestiona config" on public.config_tienda
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- La tienda solo lee las claves públicas. Si alguna vez se guarda
-- una clave de API acá (Brevo, Mercado Pago), no va a quedar
-- expuesta: las credenciales van como secretos de Edge Function.
drop policy if exists "Config legible" on public.config_tienda;

create policy "Config pública para la tienda" on public.config_tienda
  for select to public
  using (
    clave in (
      'umbral_envio_gratis',
      'envio_gratis_activo',
      'descuento_transferencia',
      'cuotas_sin_interes',
      'whatsapp',
      'email_contacto',
      'instagram',
      'nombre_tienda'
    )
  );

-- ------------------------------------------------------------
-- 13. Banners
-- ------------------------------------------------------------
drop policy if exists "Admin panel - leer banners" on public.banners;
drop policy if exists "Admin panel - gestionar banners" on public.banners;

create policy "Admin gestiona banners" on public.banners
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Se mantiene "Banners activos visibles" (activo = true).

-- ------------------------------------------------------------
-- 14. Categorías
-- ------------------------------------------------------------
drop policy if exists "Admin panel - crear categorías" on public.categorias;
drop policy if exists "Admin panel - actualizar categorías" on public.categorias;
drop policy if exists "Admin panel - borrar categorías" on public.categorias;

create policy "Admin gestiona categorías" on public.categorias
  for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Se mantiene "Categorías visibles públicamente".

-- ------------------------------------------------------------
-- 15. Habilitar RLS donde estaba apagado
-- ------------------------------------------------------------
-- Estas cuatro tablas tenían políticas escritas pero RLS DESHABILITADO
-- (relrowsecurity = false), así que ninguna se aplicaba: cualquiera con
-- la anon key podía insertar, editar y borrar productos, stock, outfits
-- y combos. Crear una política no alcanza, hay que habilitar RLS.
--
-- Con esto sus políticas pasan a valer: lectura pública filtrada y
-- escritura solo para es_admin().
alter table public.productos enable row level security;
alter table public.variaciones_stock enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;

-- El servicio de las Edge Functions corre con service_role, que ignora
-- RLS, así que el webhook de Mercado Pago y descontar_stock siguen
-- funcionando sin cambios.

-- ------------------------------------------------------------
-- REVERTIR (deja el panel abierto, no usar en producción)
-- ------------------------------------------------------------
-- create policy "Admin panel - leer productos" on public.productos for all using (true);
-- create policy "Admin panel - leer órdenes" on public.ordenes for select using (true);
-- create policy "Admin panel - actualizar órdenes" on public.ordenes for update using (true);
-- create policy "Admin panel - leer cupones" on public.cupones for select using (true);
-- create policy "Admin panel - gestionar cupones" on public.cupones for all using (true);
-- create policy "Admin panel - gestionar suscriptores" on public.suscriptores_newsletter for all using (true);
-- create policy "Admin panel - gestionar config" on public.config_tienda for all using (true);
-- ============================================================
