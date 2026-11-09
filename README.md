# Node.js---Blog
Blog basado en node.js

## Administración

El panel de administración está disponible en `/admin` y solo pueden entrar
usuarios con rol `ADMIN`. Desde él se pueden ver y eliminar todas las imágenes
de los posts (portadas y galerías) y las de la biblioteca de imágenes.

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


