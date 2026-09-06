# PRODUCT REQUIREMENTS DOCUMENT (PRD) - E-COMMERCE IKIGAI CLOTHES

## 1. Visión General del Proyecto
Desarrollar una aplicación e-commerce para la marca de ropa urbana/deportiva "Ikigai Clothes". La plataforma debe ser rápida, moderna, totalmente responsiva (Mobile First) y enfocada en una excelente conversión de ventas sin fricción.

## 2. Tech Stack Mandatorio
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, DaisyUI.
- **Backend / BaaS:** Supabase (PostgreSQL, Row Level Security - RLS, Storage, Edge Functions).
- **Pasarela de Pagos:** Mercado Pago SDK (Checkout Pro / API) + Webhooks de confirmación.
- **Hosting & Deploy:** Vercel.

---

## 3. Referencia Visual & Estilo de UI (Referencia: Moscú Showroom)

El diseño debe inspirarse en la estética de https://www.moscushowroom.com.ar/:
1. **Estilo Minimalista:** Fondos limpios (`#FFFFFF` / `#FAFAFA`), tipografía sans-serif moderna y legible, texto en tonos oscuros (`#111111`) y acentos neutros.
2. **Announcement Bar (Header):** Franja superior fija con mensajes rotativos o destacados: *"10% OFF pagando por Transferencia"* | *"Envíos a todo el país"*.
3. **Tarjetas de Producto (Cards):**
   - Fotografía limpia con efecto hover opcional para mostrar la segunda imagen (frente/dorso).
   - Badge destacado para descuentos por transferencia (ej. *"10% OFF"*) o para "Outfit Combos".
   - Selector rápido de talles o acceso directo a ver detalles.
4. **Ficha de Producto (Single View):**
   - Galería de fotos (frente, dorso, detalles).
   - Selector interactivo de talles (deshabilitando automáticamente los que no tengan stock).
   - Precio destacado con cálculo visible: *"Pagando por Transferencia: $XX.XXX (Ahorrás $X.XXX)"*.
   - Widget integrado para cálculo de costo de envío por Código Postal.

---

## 4. Estructura de Funcionalidades e Interfaz

### A. Navegación Principal
- **Header / Navbar:** Logo de Ikigai Clothes, buscador en tiempo real, selector de categorías y widget del Carrito de Compras (Drawer lateral o Modal).
- **Catálogo de Productos:** Filtros dinámicos por categoría (Remeras, Buzos, Pantalones, Accesorios, etc.), talle y rango de precio.
- **Sección de Outfits (Combos & Lookbook):**
  - Módulo visual para mostrar prendas combinadas.
  - Permite vincular 2 o más prendas del inventario (ej. 1 Remera + 1 Pantalón) para armar un "Outfit Bundle" con un precio especial en oferta o como sugerencia de look.
- **Espacio Comunidad & Reseñas (Sin Registro de Usuarios):**
  - **Reseñas de Producto:** Formulario abierto en la ficha del producto (Nombre, Puntuación 1-5 estrellas, Comentario y Foto opcional).
  - **Fotos de la Comunidad:** Galería interactiva con fotos reales enviadas por los clientes.
  - *Regla de Moderación:* Todo comentario o foto ingresa con estado `aprobado: false`. No se muestra públicamente hasta ser aprobado por el administrador en el Dashboard.
- **Calculadora de Envíos:**
  - Disponible en la ficha del producto y en el resumen del Carrito.
  - Permite ingresar el Código Postal (CP) para estimar la tarifa de envío.

---

## 5. Flujo de Compra y Métodos de Pago

El checkout opera en modalidad **Guest Checkout** (sin registro ni login obligatorios).

### A. Datos del Cliente
Al procesar la compra se solicitan: Nombre, Apellido, Email, Teléfono, DNI (necesario para la pasarela/envíos), Dirección de Entrega y Código Postal.

### B. Métodos de Pago Integrados
1. **Mercado Pago:**
   - Procesamiento de Tarjetas de Crédito, Débito y Dinero en Cuenta.
   - Generación de preferencia de pago e integración de **Webhook / IPN** en el backend para actualizar el estado del pedido a `PAGADO` de forma automática.
2. **Transferencia Bancaria Directa (0% Comisión):**
   - Descuento automático configurable (ej. 10% OFF sobre el subtotal).
   - Muestra los datos bancarios completos (Titular, CUIT, CBU/Alias, Banco) en la pantalla final de confirmación.
   - Incluye botón directo a WhatsApp o formulario para adjuntar la foto del comprobante indicando el ID del pedido.

---

## 6. Panel de Administración (Dashboard Interno)

Acceso privado protegido para el administrador:
- **Gestión de Inventario (CRUD):** Alta, baja y modificación de prendas (imágenes frente/dorso, precios, categorías, variaciones de talle y stock).
- **Gestión de Outfits:** Crear combos vinculando productos existentes y fijando precios promocionales.
- **Gestión de Pedidos:** Listado de ventas con estados (`Pendiente de Pago`, `Pagado`, `Enviado`, `Cancelado`).
- **Moderación de Reseñas:** Aprobar o rechazar valoraciones y fotos de la comunidad pendientes.

---

## 7. Esquema de Base de Datos (Supabase PostgreSQL)

Configurar las siguientes tablas con sus respectivas reglas de **Row Level Security (RLS)**:

```sql
-- Productos
productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  categoria text not null,
  precio numeric not null,
  precio_transferencia numeric,
  imagenes text[] not null,
  activo boolean default true,
  created_at timestamp with time zone default now()
);

-- Variaciones de Stock por Talle
variaciones_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid references productos(id) on delete cascade,
  talle text not null,
  stock_disponible integer not null default 0
);

-- Outfits / Combos
outfits (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio_combo numeric not null,
  imagen_portada text not null,
  activo boolean default true,
  created_at timestamp with time zone default now()
);

outfit_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid references outfits(id) on delete cascade,
  producto_id uuid references productos(id) on delete cascade
);

-- Órdenes / Pedidos
ordenes (
  id uuid primary key default gen_random_uuid(),
  cliente_nombre text not null,
  cliente_email text not null,
  cliente_telefono text not null,
  cliente_dni text not null,
  direccion text not null,
  codigo_postal text not null,
  metodo_pago text not null, -- 'mercadopago' | 'transferencia'
  monto_total numeric not null,
  costo_envio numeric not null,
  estado_pago text default 'pendiente', -- 'pendiente' | 'pagado'
  estado_envio text default 'pendiente',
  comprobante_url text,
  created_at timestamp with time zone default now()
);

orden_items (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid references ordenes(id) on delete cascade,
  producto_id uuid references productos(id),
  talle text not null,
  cantidad integer not null,
  precio_unitario numeric not null
);

-- Reseñas y Valoraciones
resenas (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid references productos(id) on delete cascade,
  nombre_usuario text not null,
  puntuacion integer check (puntuacion >= 1 and puntuacion <= 5),
  comentario text not null,
  imagen_url text,
  aprobado boolean default false,
  created_at timestamp with time zone default now()
);

-- Fotos de la Comunidad
comunidad_fotos (
  id uuid primary key default gen_random_uuid(),
  nombre_usuario text not null,
  instagram_handle text,
  imagen_url text not null,
  aprobado boolean default false,
  created_at timestamp with time zone default now()
);