-- ============================================
-- 020: Imagen del showroom
-- ============================================
-- La foto del bloque de showroom se sube desde el panel (Configuración) y queda
-- en el bucket product-images, dentro de la carpeta showroom/.
-- Se reutiliza config_tienda (clave/valor) para no agregar una columna nueva.

INSERT INTO config_tienda (clave, valor, descripcion) VALUES
  ('imagen_showroom', '', 'URL de la imagen del bloque de showroom (carpeta showroom/ del bucket product-images)')
ON CONFLICT (clave) DO NOTHING;

-- No hace falta tocar Storage: el bucket product-images ya existe y es público,
-- y la política "Permitir subida de imagenes en product-images" (INSERT para
-- authenticated) alcanza para que el panel suba la foto. La URL que devuelve
-- getPublicUrl se muestra sin sesión.

-- La compresión ocurre en el navegador (src/lib/imageCompression.ts): la imagen
-- se reescala a 1800px de ancho, se baja la calidad hasta 320 KB y se sube en
-- WebP. Para seguir ajustando esos valores: src/pages/admin/ConfigAdmin.tsx
-- (COMPRESION_SHOWROOM) y src/lib/imageCompression.ts.

-- OJO (no se cambia acá a propósito): en producción existe la policy
-- "Storage Permitir todo publico" (ALL, public, using true) sobre
-- storage.objects. Deja abierto escribir y borrar cualquier objeto de cualquier
-- bucket para visitantes anónimos. Si se la elimina, hay que revisar que las
-- Policies existentes cubran lo que usa la app:
--   - comprobantes: "Anyone can upload/view comprobantes"
--   - product-images: "Permitir subida/update de imagenes en product-images"