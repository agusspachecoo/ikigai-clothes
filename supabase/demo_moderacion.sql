-- ============================================================
-- Contenido pendiente de moderación (datos de prueba)
--
-- Todo entra con aprobado = false: aparece en los paneles de
-- Reseñas y Comunidad del admin, pero NO se publica en la web.
-- Sirve para probar los formularios y la cola de moderación.
--
-- INSERTAR:   npx supabase db query --linked -f supabase/demo_moderacion.sql
-- BORRAR:     ver la sección "borrar" al final de este archivo.
-- ============================================================

insert into resenas (producto_id, nombre_usuario, puntuacion, comentario, aprobado)
select p.id, v.usuario, v.puntaje, v.comentario, false
from (values
  ('Remera Oversize Rayada', 'Camila R.',   5, 'La tela es más gruesa de lo que parece y no transparenta. La talle M me quedó bien.'),
  ('Buzo Cropped relaxed',   'Tomás G.',    4, 'Cómodo y liviano. Es medio corto de largo, si te gusta el cropped va crack.'),
  ('Pantalón Jogger Tizado', 'Julieta B.',  2, 'Me llegó tarde el pedido y me quedé con una talla.'),
  ('Bolso Crossbody',        'Nicolás P.',  5, 'Cierra con imán, se ven bien los detalles. Para el celular y la billetera alcanza.')
) as v(nombre, usuario, puntaje, comentario)
join productos p on p.nombre = v.nombre;

insert into comunidad_fotos (nombre_usuario, instagram_handle, imagen_url, aprobado)
values
  ('Camila R.',  '@camila.fit',    'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807568115-aqxh2f.webp', false),
  ('Franco D.',  '@franco.dg',     'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807501587-n3oja9.webp', false),
  ('Julieta B.', null,             'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807624006-hgesk2.webp', false);

-- ------------------------------------------------------------
-- Para borrar:
--   delete from resenas where comentario in (
--     'La tela es más gruesa de lo que parece y no transparenta. La talle M me quedó bien.',
--     'Cómodo y liviano. Es medio corto de largo, si te gusta el cropped va crack.',
--     'Me llegó tarde el pedido y me quedé con una talla.',
--     'Cierra con imán, se ven bien los detalles. Para el celular y la billetera alcanza.');
--   delete from comunidad_fotos where nombre_usuario in ('Camila R.', 'Franco D.', 'Julieta B.')
--     and aprobado = false;
-- ============================================================
