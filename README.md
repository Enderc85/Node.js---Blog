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

## Likes y comentarios

- Solo los usuarios registrados pueden dar «me gusta» o comentar. Si un visitante
  anónimo pulsa el botón, se le redirige al login y vuelve al mismo post.
- Cada usuario puede dar un único like por post (se puede quitar y volver a dar).
- Los comentarios se guardan vinculados al post y al autor, y se muestran en la
  sección `Comentarios` del detalle del post.
- Los contadores `numLikes` y `numComments` se actualizan en la misma transacción
  que crea o elimina la fila correspondiente.
