const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');  // <-- NUEVO

const app = express();

// 1. Configuración del motor de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 2. Middlewares esenciales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());  // <-- NUEVO: lee las cookies de cada petición

// 3. Carpeta pública de archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Middleware para cargar el usuario autenticado (con su rol) en cada petición
const jwt = require('jsonwebtoken');
const prisma = require('./config/db');

app.use(async (req, res, next) => {
    res.locals.user = null;
    res.locals.currentPath = req.path;

    const token = req.cookies.token;
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, name: true, role: true, bio: true, avatar: true, featuredPostId: true }
        });

        if (user) {
            req.user = user;
            res.locals.user = user;
        } else {
            res.clearCookie('token');
        }
    } catch (error) {
        res.clearCookie('token');
    }

    return next();
});

// 4. Rutas principales
const indexRoutes = require('./routes/index.routes');
const userRoutes = require('./routes/user.routes');
const authRoutes = require('./routes/auth.routes');  // <-- NUEVO
const postRoutes = require('./routes/post.routes');  // <-- RUTAS CON SLUGS
const adminRoutes = require('./routes/admin.routes');

app.use('/', indexRoutes);
app.use('/posts', postRoutes);
app.use('/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);  // <-- NUEVO

module.exports = app;