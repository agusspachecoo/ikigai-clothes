#!/usr/bin/env bash
# Verificación de policies de Storage con la anon key (rol anónimo real).
# No imprime credenciales.
#
#   bash scripts/verificar-storage.sh
#   SAMPLE_OBJECT="product-images/productos/archivo.webp" bash scripts/verificar-storage.sh
#
# SAMPLE_OBJECT es una ruta existente para comprobar la lectura pública. Si no se
# pasa, se resuelve con la CLI de Supabase.
set -uo pipefail

set -a
# shellcheck disable=SC1091
source .env.local
set +a

URL="${VITE_SUPABASE_URL%/}"
KEY="$VITE_SUPABASE_ANON_KEY"
[ -n "$URL" ] && [ -n "$KEY" ] || { echo "Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local"; exit 1; }

pass=0; fail=0
ok()   { echo "  OK    $1 ($2)"; pass=$((pass+1)); }
bad()  { echo "  FALLA $1 (esperado $2, obtenido $3)"; fail=$((fail+1)); }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

# Espera una clase de código (ej. 4xx), no un string literal.
espera() { # espera <descripción> <2xx|4xx> <código>
  local clase="$2" c="$3"
  case "$clase:$c" in
    2xx:2*|4xx:4*) ok "$1" "$c" ;;
    *) bad "$1" "$clase" "$c" ;;
  esac
}

upload() { printf 'verificacion-021' | code -X POST "$URL/storage/v1/object/$1/$2" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: text/plain" -H "x-upsert: false" --data-binary @-; }

# Nombre único por corrida: con x-upsert:false, reintentar sobre un objeto que
# ya existe devuelve 400 y el test daría un falso negativo.
RUN="verificacion-021-$(date +%s)-$RANDOM"
OBJ="reviews/$RUN.txt"
COMPROBANTE="comprobantes/$RUN.txt"

SAMPLE="${SAMPLE_OBJECT:-}"
if [ -z "$SAMPLE" ]; then
  # La CLI imprime la tabla en un recuadro: hay que sacar los bordes y espacios.
  SQL_TMP="$(mktemp)"
  printf "select bucket_id || '/' || name as ruta from storage.objects where bucket_id = 'product-images' order by name limit 1;\n" > "$SQL_TMP"
  SAMPLE="$(npx supabase db query --linked -f "$SQL_TMP" 2>/dev/null \
    | sed 's/[│|]//g' | tr -d ' ' | grep '^product-images/' | head -1)"
  rm -f "$SQL_TMP"
fi
[ -n "$SAMPLE" ] || { echo "No se pudo resolver SAMPLE_OBJECT"; exit 1; }

echo "== Lectura pública (lo que ve un visitante, sin sesión) =="
espera "GET $SAMPLE" 2xx "$(code "$URL/storage/v1/object/public/$SAMPLE")"

echo "== Lectura anónima: comprobantes tienen que estar privados =="
# El bucket comprobantes es privado (migración 022). Con la URL /object/public/
# responde 4xx aunque el archivo exista.
espera "GET comprobantes (sin sesión)" 4xx \
  "$(code "$URL/storage/v1/object/public/comprobantes/$COMPROBANTE")"
espera "descargar comprobantes (sin sesión)" 4xx \
  "$(code "$URL/storage/v1/object/authenticated/comprobantes/$COMPROBANTE" \
     -H "apikey: $KEY" -H "Authorization: Bearer $KEY")"

echo "== Escritura anónima: lo que tiene que funcionar =="
espera "foto de reseña en product-images/reviews/" 2xx "$(upload product-images "$OBJ")"
espera "comprobante en comprobantes/comprobantes/"   2xx "$(upload comprobantes "$COMPROBANTE")"

echo "== Escritura anónima: lo que tiene que estar bloqueado =="
espera "subir en product-images/productos/"    4xx "$(upload product-images productos/$RUN.txt)"
espera "subir en product-images/outfits/"      4xx "$(upload product-images outfits/$RUN.txt)"
espera "subir en product-images/banners/"      4xx "$(upload product-images banners/$RUN.txt)"
espera "subir en product-images/comunidad/"    4xx "$(upload product-images comunidad/$RUN.txt)"
espera "subir en product-images/showroom/"     4xx "$(upload product-images showroom/$RUN.txt)"
espera "subir en la raíz del bucket"           4xx "$(upload product-images "$RUN.txt")"
espera "salirse del bucket (../)"               4xx "$(upload product-images "../comprobantes/escape-$RUN.txt")"
espera "sobreescribir lo ya subido (upsert)"    4xx \
  "$(printf 'x' | code -X POST "$URL/storage/v1/object/product-images/$OBJ" \
     -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: text/plain" -H "x-upsert: true" --data-binary @-)"
espera "borrar lo que subió"                    4xx \
  "$(code -X DELETE "$URL/storage/v1/object/product-images/$OBJ" \
     -H "apikey: $KEY" -H "Authorization: Bearer $KEY")"
espera "listar comprobantes"                    4xx \
  "$(code "$URL/storage/v1/object/list/comprobantes/comprobantes" -H "apikey: $KEY" -H "Authorization: Bearer $KEY")"

echo
echo "OK: $pass | FALLAS: $fail"

# El anónimo no puede borrar (es justo lo que se prueba) y Supabase bloquea el
# DELETE directo sobre storage.objects (trigger storage.protect_delete), así que
# los dos objetos válidos quedan en el bucket. Son 16 bytes cada uno:
echo
echo "-- objetos de prueba que quedaron --"
echo "  product-images/reviews/$RUN.txt"
echo "  comprobantes/comprobantes/$RUN.txt"
echo "  Para borrarlos:"
echo "    bash scripts/limpiar-storage-pruebas.sh"
echo "  (usa la service_role key; si no está, los borra a mano desde el Dashboard)"

[ "$fail" -eq 0 ] || exit 1