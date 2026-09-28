-- ============================================================
-- Prendas de prueba (datos genéricos)
--
-- Sirven para ver la tienda con volumen real de productos: home,
-- catálogo, filtros, quickshop, outfits y carrito.
--
-- Reutilizan las imágenes que ya están en el bucket product-images
-- para no subir archivos nuevos.
--
-- INSERTAR:   npx supabase db query --linked -f supabase/demo_prendas.sql
-- BORRAR:     ver la sección "borrar" al final de este archivo.
-- ============================================================

-- ------------------------------------------------------------
-- Productos
-- ------------------------------------------------------------
insert into productos (nombre, descripcion, categoria, precio, precio_transferencia, imagenes, discount_percent)
values
  (
    'Remera Lisa Algodón',
    'Remera lisa de algodón peinado, corte regular. Unisex. Lavar a máquina con agua fría.',
    'Remeras',
    24500,
    22050,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807568115-aqxh2f.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807572243-tzuu65.webp'
    ],
    0
  ),
  (
    'Remera Oversize Rayada',
    'Oversize con estampas rayadas al agua. Tela gruesa, no transparenta.',
    'Remeras',
    31000,
    27900,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807568115-aqxh2f.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807572243-tzuu65.webp'
    ],
    15
  ),
  (
    'Buzo Cremalla con Capucha',
    'Buzo de algodón con capucha, puños y bajo en elastano. Súper abrigado.',
    'Buzos',
    56000,
    50400,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807501587-n3oja9.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807504619-184ltm.webp'
    ],
    0
  ),
  (
    'Buzo Cropped relaxed',
    'Corto, holgado y con ribete al medio. Combina bien con pantalón cargo.',
    'Buzos',
    39500,
    35550,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807504619-184ltm.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807501587-n3oja9.webp'
    ],
    25
  ),
  (
    'Pantalón Cargo Utility',
    'Cargo con seis bolsillos y cordón lateral. Twill lavado.',
    'Pantalones',
    68000,
    61200,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807433544-gdzgig.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807437537-0el4in.webp'
    ],
    0
  ),
  (
    'Pantalón Jogger Tizado',
    'Jogger con puño y cordón. Ideal para training.',
    'Pantalones',
    44500,
    40050,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807624006-hgesk2.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807627490-bdvhzi.webp'
    ],
    10
  ),
  (
    'Pantalón Denim Roto',
    'Jean tiro alto con lavado y roturas. Corte flare.',
    'Pantalones',
    72000,
    64800,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807437537-0el4in.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807433544-gdzgig.webp'
    ],
    0
  ),
  (
    'Gorra Snapback Ikigai',
    'Gorra de seis paneles con bordado frontal. Ajuste regulable.',
    'Accesorios',
    22000,
    19800,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807501587-n3oja9.webp'
    ],
    0
  ),
  (
    'Bolso Crossbody',
    'Bolso compacto para el celular y la billetera. Correa larga regulable.',
    'Accesorios',
    29000,
    26100,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807627490-bdvhzi.webp'
    ],
    20
  ),
  (
    'Mochila Urbana 18L',
    'Compartimento acolchado para notebook de 15". Impermeable.',
    'Accesorios',
    64000,
    57600,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807624006-hgesk2.webp'
    ],
    0
  ),
  (
    'Set Adidas x Umbro White',
    'Set de dos piezas blanco con costuras en contraste. Talla M.',
    'Remeras',
    85000,
    76500,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807572243-tzuu65.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807568115-aqxh2f.webp'
    ],
    30
  ),
  (
    'Set Umbro White',
    'Set de dos piezas blanco liso. Talla M, unisex.',
    'Remeras',
    79000,
    71100,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807504619-184ltm.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807433544-gdzgig.webp'
    ],
    0
  ),
  (
    'Buzo Umbro White',
    'Buzo con escudo bordado en el pecho. Interior cepillado.',
    'Buzos',
    78000,
    70200,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807501587-n3oja9.webp',
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807624006-hgesk2.webp'
    ],
    0
  ),
  (
    'Remera Boxy con Bollos',
    'Corte boxy con hombros caídos y estampas en la espalda.',
    'Remeras',
    27000,
    24300,
    array[
      'https://djixdahosjjnszuafgsw.supabase.co/storage/v1/object/public/product-images/productos/1788807568115-aqxh2f.webp'
    ],
    0
  );

-- ------------------------------------------------------------
-- Stock por talle para las prendas recién cargadas
-- (solo para productos que aún no tienen variaciones)
-- ------------------------------------------------------------
insert into variaciones_stock (producto_id, talle, stock_disponible)
select p.id, v.talle::text, v.stock
from productos p
join (values
  ('Remera Lisa Algodón',            'S', 12), ('Remera Lisa Algodón',            'M', 15), ('Remera Lisa Algodón',            'L', 14), ('Remera Lisa Algodón',            'XL', 8),
  ('Remera Oversize Rayada',         'S', 9),  ('Remera Oversize Rayada',         'M', 11), ('Remera Oversize Rayada',         'L', 10), ('Remera Oversize Rayada',         'XL', 6),
  ('Buzo Cremalla con Capucha',      'M', 10), ('Buzo Cremalla con Capucha',      'L', 12), ('Buzo Cremalla con Capucha',      'XL', 9), ('Buzo Cremalla con Capucha',      'XXL', 4),
  ('Buzo Cropped relaxed',           'S', 7),  ('Buzo Cropped relaxed',           'M', 9),  ('Buzo Cropped relaxed',           'L', 8),
  ('Pantalón Cargo Utility',         'M', 8),  ('Pantalón Cargo Utility',         'L', 10), ('Pantalón Cargo Utility',         'XL', 7),
  ('Pantalón Jogger Tizado',         'S', 10), ('Pantalón Jogger Tizado',         'M', 13), ('Pantalón Jogger Tizado',         'L', 11), ('Pantalón Jogger Tizado',         'XL', 5),
  ('Pantalón Denim Roto',            'S', 6),  ('Pantalón Denim Roto',            'M', 8),  ('Pantalón Denim Roto',            'L', 6),  ('Pantalón Denim Roto',            'XL', 0),
  ('Gorra Snapback Ikigai',          'Único', 20),
  ('Bolso Crossbody',                'Único', 16),
  ('Mochila Urbana 18L',            'Único', 9),
  ('Set Adidas x Umbro White',       'M', 3),  ('Set Adidas x Umbro White',       'L', 2),
  ('Set Umbro White',                'M', 4),  ('Set Umbro White',                'L', 3),
  ('Buzo Umbro White',               'M', 5),  ('Buzo Umbro White',               'L', 4), ('Buzo Umbro White',               'XL', 2),
  ('Remera Boxy con Bollos',         'S', 11), ('Remera Boxy con Bollos',         'M', 14), ('Remera Boxy con Bollos',         'L', 12), ('Remera Boxy con Bollos',         'XL', 7)
) as v(nombre, talle, stock) on v.nombre = p.nombre
where not exists (select 1 from variaciones_stock s where s.producto_id = p.id);

-- ------------------------------------------------------------
-- Para borrar todo lo de esta prueba:
--   delete from variaciones_stock
--    where producto_id in (select id from productos where nombre in (
--      'Remera Lisa Algodón','Remera Oversize Rayada','Buzo Cremalla con Capucha',
--      'Buzo Cropped relaxed','Pantalón Cargo Utility','Pantalón Jogger Tizado',
--      'Pantalón Denim Roto','Gorra Snapback Ikigai','Bolso Crossbody',
--      'Mochila Urbana 18L','Set Adidas x Umbro White','Set Umbro White',
--      'Buzo Umbro White','Remera Boxy con Bollos'));
--   delete from outfit_items
--    where producto_id in (select id from productos where nombre in ( ... ));
--   delete from productos where nombre in ( ... );
-- ============================================================
