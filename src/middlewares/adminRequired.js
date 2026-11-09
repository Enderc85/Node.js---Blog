// Middleware para rutas de administración.
// Se apoya en el usuario que app.js carga desde la base de datos (req.user),
// por lo que el rol siempre está actualizado aunque el token sea antiguo.
const adminRequired = (req, res, next) => {
    if (!req.user) {
        const next = encodeURIComponent(req.originalUrl);
        return res.redirect(`/login?next=${next}`);
    }

    if (req.user.role !== 'ADMIN') {
        return res.status(403).render('errors/403', {
            title: 'Acceso denegado',
            message: 'Esta sección solo está disponible para administradores.'
        });
    }

    return next();
};

module.exports = adminRequired;
