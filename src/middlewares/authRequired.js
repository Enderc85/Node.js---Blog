const jwt = require('jsonwebtoken');

// Middleware que protege rutas:
// Si la petición NO trae un token válido en la cookie, responde 401/403.
// Si es válido, guarda los datos del usuario en req.user y deja pasar.
const authRequired = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Inicia sesión primero.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.user = decoded;  // { id, email, iat, exp }
        next();              // Todo correcto, pasa al siguiente controlador
    } catch (error) {
        return res.status(403).json({ message: 'Token inválido o expirado' });
    }
};

// Variante para páginas HTML: si no hay sesión, redirige al login
// guardando la ruta solicitada para volver después de iniciar sesión.
const authRequiredPage = (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
        const next = encodeURIComponent(req.originalUrl);
        return res.redirect(`/login?next=${next}`);
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        res.clearCookie('token');
        const next = encodeURIComponent(req.originalUrl);
        return res.redirect(`/login?next=${next}`);
    }
};

module.exports = authRequired;
module.exports.authRequiredPage = authRequiredPage;