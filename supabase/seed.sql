-- ============================================================
-- IKIGAI CLOTHES - DATOS DE PRUEBA (SEED)
-- Cómo ejecutar: Supabase Dashboard -> SQL Editor -> pegar -> Run
-- El archivo es re-ejecutable: elimina los registros de los ids fijos
-- antes de insertarlos de nuevo.
-- ============================================================

BEGIN;

-- Limpieza previa (solo registros de este seed, por ids fijos)
DELETE FROM outfit_items
WHERE outfit_id IN (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003'
);

DELETE FROM outfits
WHERE id IN (
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003'
);

DELETE FROM variaciones_stock
WHERE producto_id IN (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
);

DELETE FROM productos
WHERE id IN (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
);

-- ============================================================
-- 1) PRODUCTOS
-- ============================================================
INSERT INTO productos (id, nombre, descripcion, categoria, precio, precio_transferencia, imagenes, activo) VALUES
(
  '10000000-0000-4000-8000-000000000001',
  'Remera Oversize',
  'Remera urbana de corte oversize en algodón 100% algodón peinado. Diseño minimalista con estampa frontal y espalda limpia. Ideal para looks cómodos de todos los días.',
  'Remeras',
  32000.00,
  28800.00,
  ARRAY[
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?q=80&w=800&auto=format&fit=crop'
  ],
  true
),
(
  '10000000-0000-4000-8000-000000000002',
  'Hoodie Boxy Fit',
  'Buzo hoodie de corte boxy, fur polar interior. Puños y cintura elastizados. Estética streetwear con bolsillo canguro.',
  'Buzos',
  48000.00,
  43200.00,
  ARRAY[
    'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?q=80&w=800&auto=format&fit=crop'
  ],
  true
),
(
  '10000000-0000-4000-8000-000000000003',
  'Pantalón Cargo',
  'Pantalón cargo de tela técnica con corte amplio, múltiples bolsillos y ajuste de tobillo. Resistente y versátil.',
  'Pantalones',
  45000.00,
  40500.00,
  ARRAY[
    'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?q=80&w=800&auto=format&fit=crop'
  ],
  true
),
(
  '10000000-0000-4000-8000-000000000004',
  'Jogger Deportivo',
  'Jogger de algodón con cintura elasticada y cordones, bolsillos laterales y puño de tobillo. Máxima comodidad para entrenar o salir.',
  'Pantalones',
  42000.00,
  37800.00,
  ARRAY[
    'https://images.unsplash.com/photo-1537832816519-689ad163238b?q=80&w=800&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=800&auto=format&fit=crop'
  ],
  true
);

-- ============================================================
-- 2) STOCK POR TALLE (S, M, L, XL)
-- ============================================================
INSERT INTO variaciones_stock (producto_id, talle, stock_disponible) VALUES
('10000000-0000-4000-8000-000000000001', 'S', 8),
('10000000-0000-4000-8000-000000000001', 'M', 12),
('10000000-0000-4000-8000-000000000001', 'L', 10),
('10000000-0000-4000-8000-000000000001', 'XL', 5),
('10000000-0000-4000-8000-000000000002', 'S', 5),
('10000000-0000-4000-8000-000000000002', 'M', 8),
('10000000-0000-4000-8000-000000000002', 'L', 7),
('10000000-0000-4000-8000-000000000002', 'XL', 4),
('10000000-0000-4000-8000-000000000003', 'S', 6),
('10000000-0000-4000-8000-000000000003', 'M', 10),
('10000000-0000-4000-8000-000000000003', 'L', 8),
('10000000-0000-4000-8000-000000000003', 'XL', 3),
('10000000-0000-4000-8000-000000000004', 'S', 4),
('10000000-0000-4000-8000-000000000004', 'M', 9),
('10000000-0000-4000-8000-000000000004', 'L', 11),
('10000000-0000-4000-8000-000000000004', 'XL', 6);

-- ============================================================
-- 3) OUTFITS / COMBOS (imágenes verticales estilo selfie de vestidor)
-- ============================================================
INSERT INTO outfits (id, nombre, descripcion, precio_combo, imagen_portada, activo) VALUES
(
  '20000000-0000-4000-8000-000000000001',
  'Look Street Diario',
  'Remera oversize + pantalón cargo. El combo ideal para un look urbano cómodo y canchero.',
  72000.00,
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=600&auto=format&fit=crop',
  true
),
(
  '20000000-0000-4000-8000-000000000002',
  'Fit Boxy Cozy',
  'Hoodie boxy + jogger deportivo. Calce amplio y calentito para el día a día.',
  84000.00,
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=600&auto=format&fit=crop',
  true
),
(
  '20000000-0000-4000-8000-000000000003',
  'Capas Urbanas',
  'Remera oversize + hoodie boxy + pantalón cargo. El look de 3 capas que no pasa desapercibido.',
  116000.00,
  'https://images.unsplash.com/photo-1495385794356-15371f348c31?q=80&w=600&auto=format&fit=crop',
  true
),
(
  '20000000-0000-4000-8000-000000000004',
  'Sport Essential',
  'Remera oversize + jogger deportivo. Liviano y cómodo, del gimnasio directo a la calle.',
  70000.00,
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=600&auto=format&fit=crop',
  true
);

-- ============================================================
-- 4) ITEMS DE CADA OUTFIT
-- ============================================================
INSERT INTO outfit_items (outfit_id, producto_id) VALUES
-- Look Street Diario: Remera + Cargo
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003'),
-- Fit Boxy Cozy: Hoodie + Jogger
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002'),
('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004'),
-- Capas Urbanas: Remera + Hoodie + Cargo
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002'),
('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000003'),
-- Sport Essential: Remera + Jogger
('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000004');

COMMIT;

-- Verificación rápida (opcional)
-- SELECT p.nombre, p.precio, p.precio_transferencia, array_length(p.imagenes, 1) AS fotos
-- FROM productos p ORDER BY p.nombre;
--
-- SELECT o.nombre, o.precio_combo, string_agg(pr.nombre, ' + ' ORDER BY pr.nombre) AS prendas
-- FROM outfits o
-- JOIN outfit_items oi ON oi.outfit_id = o.id
-- JOIN productos pr ON pr.id = oi.producto_id
-- GROUP BY o.id ORDER BY o.nombre;