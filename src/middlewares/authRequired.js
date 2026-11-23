// Middlewares que protegen rutas.
//
// El usuario lo carga `src/app.js` en cada petición consultando la base de
// datos, así que aquí basta con comprobar `req.user`. De esta forma una cuenta
// desactivada (o eliminada) pierde el acceso al instante, aunque su token JWT
// siga siendo válido.

// Variante JSON/API: responde 401/403 en lugar de redirigir.
const authRequired = (req, res, next) => {
    if (req.user) return next();

    const hasToken = Boolean(req.cookies && req.cookies.token);

    if (!hasToken) {
        return res.status(401).json({ message: 'Acceso denegado. Inicia sesión primero.' });
    }

    return res.status(403).json({ message: 'Sesión no válida o cuenta desactivada.' });
};

// Variante para páginas HTML: si no hay sesión válida, redirige al login
// guardando la ruta solicitada para volver después de iniciar sesión.
const authRequiredPage = (req, res, next) => {
    if (req.user) return next();

    const nextPath = encodeURIComponent(req.originalUrl);

    // app.js ya limpia la cookie si el token no vale o la cuenta no está activa.
    return res.redirect(`/login?next=${nextPath}`);
};

module.exports = authRequired;
module.exports.authRequiredPage = authRequiredPage;
