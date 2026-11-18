# Node.js---Blog

Blog basado en Node.js con render en servidor (Express + EJS), Prisma y
PostgreSQL.

## Puesta en marcha

```bash
npm install
```

Copia `.env.example` a `.env` y rellena `SECRET` y `DATABASE_URL`.
Después prepara la base de datos y arranca:

```bash
npx prisma db push   # crea/actualiza el esquema
npm run seed         # opcional: datos de ejemplo
npm start            # o npm run dev para recarga automática
```

La aplicación queda en `http://localhost:3000`.

## Conexión a la base de datos (Prisma 7)

Con Prisma 7 la URL de conexión ya no se escribe en `schema.prisma`:

- `prisma.config.ts` lee `DATABASE_URL` del `.env` para la CLI (migraciones,
  `db push`, introspección...).
- `src/config/db.js` elige el adaptador según el host de `DATABASE_URL`:
  - Prisma Postgres (`db.prisma.io`): `@prisma/adapter-ppg`, el *serverless
    driver* oficial. Habla HTTP/WebSocket por el puerto **443**, así que
    funciona en redes que bloquean el 5432.
  - Cualquier otro PostgreSQL (local, Docker...): `@prisma/adapter-pg`, que
    necesita el puerto **5432**.

Variables relevantes:

- `DATABASE_URL`: cadena de conexión. Para Prisma Postgres es la conexión
  directa que da Prisma Console (`...@db.prisma.io:5432/postgres?sslmode=require`).
- `ACCELERATE_URL` (opcional): URL de Prisma Accelerate
  (`prisma+postgres://accelerate.prisma-data.net/?api_key=...`). Si está
  definida, tiene prioridad. También va por HTTPS 443, pero **se retira el
  1 de diciembre de 2026**, así que solo se recomienda como alternativa
  temporal.

### Redes que bloquean el puerto 5432

Si `npx prisma db execute` responde `P1001: Can't reach database server` pero
`https://db.prisma.io:443` sí funciona, el 5432 está bloqueado por la red.

- **La aplicación funciona igualmente**: con Prisma Postgres usa el serverless
  driver (`@prisma/adapter-ppg`) por 443. No hace falta configurar nada más.
- **La CLI no**: `prisma db push`, `prisma migrate` y `prisma studio` siguen
  necesitando una conexión directa al 5432. Para cambiar el esquema desde una
  red bloqueada, genera el SQL con `prisma migrate diff` y ejecútalo en el
  editor SQL de Prisma Console, o usa otra red.

`npm run seed` sí funciona: usa el cliente de la app, no la CLI.

### Ver la base de datos desde clase

`npx prisma studio` **no funciona** si el 5432 está bloqueado: Studio usa
conexión directa. Para consultar datos por terminal sin salir del 443:

```bash
npm run db:view                  # tablas y número de filas
npm run db:view -- post          # filas de una tabla
npm run db:view -- user --limit=3
npm run db:view -- media --json
```

El visor usa el mismo cliente que la app (`src/config/db.js`), oculta el campo
`password` y no muestra el binario de `media`. Como alternativa con interfaz,
Prisma Console → tu base de datos → **Studio** (también va por HTTPS).

## Almacenamiento de imágenes

Las imágenes que suben los usuarios (portadas, galerías y fotos de perfil) se
guardan **en la base de datos**, en la tabla `media`, y se sirven desde
`/media/:id/:archivo`. Así cualquier equipo o despliegue que use la misma
`DATABASE_URL` ve las mismas imágenes, aunque la subida se haya hecho desde otro
sitio.

- La URL conserva la extensión del archivo (`/media/12/foto.jpeg`) porque la web
  la usa para decidir si puede mostrar la imagen o debe ofrecerla como descarga
  (HEIC y RAW se descargan).
- Se aceptan JPG, JPEG, PNG, HEIC y los RAW habituales, con un máximo de 20 MB
  por imagen y 10 imágenes por post. Los avatares admiten JPG, JPEG, PNG, WEBP,
  GIF y AVIF con un máximo de 6 MB.
- La respuesta se cachea un año (`immutable`): el contenido de un `id` nunca
  cambia.
- Al borrar un post, una imagen o un avatar desde la web, el registro de `media`
  se elimina solo si ya no lo referencia ninguna otra parte de la base de datos.
- Las imágenes nuevas ya no dependen de `public/uploads`; esa carpeta solo
  conserva los archivos antiguos.

### Migrar imágenes antiguas

Si la base de datos todavía apunta a archivos de `public/uploads`, este comando
los copia a la tabla `media` y actualiza todas las referencias:

```bash
npm run migrate-media
```

Es idempotente: solo procesa URLs locales cuyo archivo siga existiendo en disco.
No borra los originales, así que puedes comprobar que todo se ve bien y después
eliminar el contenido de `public/uploads`.

## Intro de carga

La portada muestra una pequeña intro dibujada con CSS la primera vez que se
abre una página en la sesión: retícula y líneas, logo centrado, apertura de los
cuatro cuadraditos y, en ese mismo instante, vuelo del logo hasta el header
mientras el index real (header, posts y footer) hace fade-in detrás.

- Se controla con `sessionStorage` (`lumina-intro-seen`), así que no se repite
  al navegar por la web.
- `?intro=1` la fuerza y `?intro=0` la salta, útil para probar cambios.
- Respeta `prefers-reduced-motion: reduce`: en ese caso no se muestra.
- Si el JavaScript fallara, hay redes de seguridad en CSS y en el propio script
  para que la página nunca quede bloqueada.

### Ajustar los tiempos

Todos los tiempos están en un único bloque al principio de
`src/views/partials/page-loader.ejs` (`window.LUMINA_INTRO`). Se aplican como
variables CSS antes de pintar el loader, así que basta con editar y recargar.

| Variable          | Por defecto | Qué controla                                              |
| ----------------- | ----------- | --------------------------------------------------------- |
| `lineStart`       | `0.15`      | Cuándo empiezan a dibujarse las líneas del centro         |
| `lineDur`         | `1.10`      | Duración del trazado de las líneas                        |
| `seedDur`         | `0.70`      | Cuánto tarda en dibujarse el marco base                   |
| `logoAppear`      | `0.30`      | Cuándo aparece el logo centrado                           |
| `logoAppearDur`   | `0.45`      | Duración del fundido del logo                             |
| `tilesStart`      | `0.75`      | Cuándo empieza a abrirse el primer cuadradito             |
| `tilesStagger`    | `0.08`      | Separación entre la apertura de cada cuadradito           |
| `tileDur`         | `0.70`      | Duración de la apertura de cada cuadradito                |
| `tileRotate`      | `12`        | Grados de giro al abrirse (`0` para desactivarlo)         |
| `flightDur`       | `0.80`      | Vuelo del logo hasta el header                            |
| `tilesOutDur`     | `0.50`      | Desvanecido de los cuadraditos al despegar                |
| `bgOutDur`        | `0.90`      | Fundido del fondo del loader                              |
| `contentDur`      | `0.90`      | Fade-in del index real                                    |
| `loaderHold`      | `1.15`      | Tiempo hasta retirar el loader tras despegar              |
| `fallbackFlight`  | `2.20`      | Vuelo de emergencia si no llega el evento del cuadradito  |
| `safety`          | `4.00`      | Desbloqueo de emergencia de la página                     |

Notas:

- El vuelo se dispara con el `animationend` del **último** cuadradito, así que
  si cambias `tilesStart`, `tilesStagger` o `tileDur` el logo se ajusta solo.
- `loaderHold` debe ser mayor o igual que `flightDur`, o el loader se retirará
  con el logo a medio camino.
- Los fallbacks en CSS (contenido visible a los 3,6 s y loader oculto a los 4 s)
  son fijos a propósito: solo actúan si el script no se ejecuta.

## Rendimiento

- El fondo decorativo (glows y patrón de formas) es estático: ya no hay
  animaciones CSS a pantalla completa, así que no se recalcula ni repinta el
  fondo en cada fotograma. El paralaje con el ratón se mantiene y se desactiva
  en pantallas táctiles o con `prefers-reduced-motion`.
- Las tarjetas que se repiten (posts del feed y widgets de la barra lateral)
  usan una superficie translúcida sin `backdrop-filter`; el desenfoque se
  reserva para el header, los modales y las tarjetas únicas.
- La imagen de fondo del login y del registro es local y ligera
  (`public/images/auth-bg.jpg`), en lugar de descargarse de Unsplash.
- Las imágenes de los posts usan `loading="lazy"` y `decoding="async"` para no
  bloquear el renderizado.

## Perfiles

Cada usuario registrado tiene un perfil público propio:

| Ruta | Qué muestra |
| ---- | ----------- |
| `/profiles` | Ranking de actividad y buscador por nombre, usuario o descripción |
| `/profiles/:nombre` | Perfil público: foto, nombre, biografía y grid de 3 columnas con sus posts |
| `/personal` | Editor del perfil propio (foto, nombre, biografía y post destacado) |

- La URL usa el nombre del usuario, no su id: `/profiles/elena-garcia`. Los
  acentos se quitan y los espacios pasan a guiones. Si dos usuarios comparten
  nombre, se añade el id (`/profiles/manel-r-5`) para mantenerla única.
- Los enlaces antiguos por id (`/profiles/3`) redirigen a la URL con el nombre.

- Al pulsar cualquier tarjeta de `/profiles` se abre el perfil de ese usuario.
- El grid de posts muestra todos sus posts, del más reciente al más antiguo, con
  portada, fecha, me gusta y comentarios.
- En tu propio perfil aparece el botón **Editar mi perfil**; en el resto no.
- El botón de usuario de la cabecera («Mi perfil») lleva directamente a tu perfil
  público, y desde `/personal` hay un enlace para verlo.

## Administración

El panel de administración está disponible en `/admin` y solo pueden entrar
usuarios con rol `ADMIN`. Desde él se pueden ver y eliminar todas las imágenes
de los posts (portadas y galerías) y las de la biblioteca de imágenes, además de
borrar posts completos.

### Configurar un administrador

Promocionar un usuario que ya existe:

```bash
npm run make-admin -- correo@ejemplo.com
```

Crear directamente un usuario administrador:

```bash
npm run make-admin -- correo@ejemplo.com "contraseña" "Nombre"
```

Quitar el rol de administrador:

```bash
npm run make-admin -- correo@ejemplo.com --revoke
```

También se pueden usar las variables `ADMIN_EMAIL`, `ADMIN_PASSWORD` y
`ADMIN_NAME`. El seed de desarrollo crea `admin@blog.com` / `password123`.

### Cambiar la contraseña de un usuario

```bash
npm run change-password -- --list                  # ver usuarios
npm run change-password -- correo@ejemplo.com      # pide la contraseña (oculta)
npm run change-password -- correo@ejemplo.com "nueva-contraseña"
npm run change-password -- --id 3                  # buscar por id
npm run change-password -- correo@ejemplo.com --generate
```

- Si no indicas la contraseña, se pide dos veces por terminal sin mostrarla.
- `--generate` crea una contraseña aleatoria de 16 caracteres y la muestra una
  sola vez; cópiala en ese momento.
- Mínimo 6 caracteres. El hash se guarda con bcrypt (10 rondas), igual que en el
  registro.
- No invalida los tokens JWT ya emitidos: una sesión abierta sigue activa hasta
  que caduque. Para expulsar a alguien de inmediato habría que rotar `SECRET`.
- Usa el cliente de la app, así que funciona por el 443 aunque el 5432 esté
  bloqueado.

## Likes y comentarios

- Solo los usuarios registrados pueden dar «me gusta» o comentar. Si un visitante
  anónimo pulsa el botón, se le redirige al login y vuelve al mismo post.
- Cada usuario puede dar un único like por post (se puede quitar y volver a dar).
- Los comentarios se guardan vinculados al post y al autor, y se muestran en la
  sección `Comentarios` del detalle del post.
- Los contadores `numLikes` y `numComments` se actualizan en la misma transacción
  que crea o elimina la fila correspondiente.
