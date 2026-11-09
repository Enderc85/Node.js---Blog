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

// Middleware para pasar el usuario autenticado a todas las vistas EJS
const jwt = require('jsonwebtoken');
app.use((req, res, next) => {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.SECRET);
            res.locals.user = decoded;
            req.user = decoded;
        } catch (err) {
            res.locals.user = null;
        }
    } else {
        res.locals.user = null;
    }
    res.locals.currentPath = req.path;
    next();
});

// 3. Carpeta pública de archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// 4. Rutas principales
const indexRoutes = require('./routes/index.routes');
const userRoutes = require('./routes/user.routes');
const authRoutes = require('./routes/auth.routes');  // <-- NUEVO
const postRoutes = require('./routes/post.routes');  // <-- RUTAS CON SLUGS

app.use('/', indexRoutes);
app.use('/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);  // <-- NUEVO

module.exports = app;