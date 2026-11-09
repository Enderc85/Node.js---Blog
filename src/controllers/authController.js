const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userService = require('../services/user.services');

// Función auxiliar: crea un token JWT con el id y email del usuario
const createToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.SECRET || 'secret_fallback_key',
        { expiresIn: '24h' }
    );
};

// Evita redirecciones abiertas: solo se permite volver a una ruta interna
const safeNextPath = (value) => {
    if (typeof value !== 'string') return '/';
    if (!value.startsWith('/') || value.startsWith('//')) return '/';
    return value;
};

// ─────────────────────────────────────────────
// REGISTER — Crear una cuenta nueva
// ─────────────────────────────────────────────
const register = async (req, res) => {
    const isFormSubmit = !req.xhr && req.headers['content-type']?.includes('application/x-www-form-urlencoded');

    try {
        const { email, name, password, confirmPassword } = req.body;

        // 1. Validación básica
        if (!email || !password) {
            const errorMsg = 'El correo electrónico y la contraseña son obligatorios';
            if (isFormSubmit) {
                return res.status(400).render('auth/register', { title: 'Registrarse', error: errorMsg, name, email });
            }
            return res.status(400).json({ message: errorMsg });
        }

        // Validación confirmación si viene de formulario web
        if (confirmPassword && password !== confirmPassword) {
            const errorMsg = 'Las contraseñas no coinciden';
            if (isFormSubmit) {
                return res.status(400).render('auth/register', { title: 'Registrarse', error: errorMsg, name, email });
            }
            return res.status(400).json({ message: errorMsg });
        }

        // 2. ¿Ya existe un usuario con ese email?
        const existingUser = await userService.getUserByEmail(email);
        if (existingUser) {
            const errorMsg = 'Ya existe una cuenta con ese correo electrónico';
            if (isFormSubmit) {
                return res.status(409).render('auth/register', { title: 'Registrarse', error: errorMsg, name, email });
            }
            return res.status(409).json({ message: errorMsg });
        }

        // 3. Hashear la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Crear el usuario en la base de datos
        const newUser = await userService.createUser({
            email,
            name: name || null,
            password: hashedPassword,
        });

        // 5. Generar token JWT y enviarlo como cookie HttpOnly
        const token = createToken(newUser);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        });

        // Si viene del formulario HTML del navegador, redirigir al index logueado
        if (isFormSubmit) {
            return res.redirect('/');
        }

        // Si es petición API / JSON
        res.status(201).json({
            message: 'Usuario registrado correctamente',
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
            },
        });

    } catch (error) {
        console.error('Error en register:', error);
        if (isFormSubmit) {
            return res.status(500).render('auth/register', { title: 'Registrarse', error: 'Error interno del servidor. Inténtalo de nuevo.' });
        }
        res.status(500).json({
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ─────────────────────────────────────────────
// LOGIN — Iniciar sesión
// ─────────────────────────────────────────────
const login = async (req, res) => {
    const isFormSubmit = !req.xhr && req.headers['content-type']?.includes('application/x-www-form-urlencoded');

    try {
        const { email, password } = req.body;
        const next = safeNextPath(req.body.next);

        // 1. Validación básica
        if (!email || !password) {
            const errorMsg = 'El correo y la contraseña son obligatorios';
            if (isFormSubmit) {
                return res.status(400).render('auth/login', { title: 'Iniciar Sesión', error: errorMsg, email, next });
            }
            return res.status(400).json({ message: errorMsg });
        }

        // 2. Buscar al usuario por email
        const user = await userService.getUserByEmail(email);
        if (!user) {
            const errorMsg = 'Credenciales incorrectas';
            if (isFormSubmit) {
                return res.status(401).render('auth/login', { title: 'Iniciar Sesión', error: errorMsg, email, next });
            }
            return res.status(401).json({ message: errorMsg });
        }

        // 3. Comparar contraseña con el hash
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            const errorMsg = 'Credenciales incorrectas';
            if (isFormSubmit) {
                return res.status(401).render('auth/login', { title: 'Iniciar Sesión', error: errorMsg, email, next });
            }
            return res.status(401).json({ message: errorMsg });
        }

        // 4. Generar token JWT y enviarlo como cookie
        const token = createToken(user);

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        });

        // Si es formulario del navegador, volver a la ruta solicitada o a la home
        if (isFormSubmit) {
            return res.redirect(next);
        }

        res.status(200).json({
            message: 'Sesión iniciada correctamente',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        });

    } catch (error) {
        console.error('Error en login:', error);
        if (isFormSubmit) {
            return res.status(500).render('auth/login', { title: 'Iniciar Sesión', error: 'Error interno del servidor' });
        }
        res.status(500).json({
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// ─────────────────────────────────────────────
// LOGOUT — Cerrar sesión
// ─────────────────────────────────────────────
const logout = (req, res) => {
    res.clearCookie('token');
    const isFormSubmit = !req.xhr;
    if (isFormSubmit) {
        return res.redirect('/');
    }
    res.status(200).json({ message: 'Sesión cerrada correctamente' });
};

// ─────────────────────────────────────────────
// VERIFY — Comprobar si el token actual es válido
// ─────────────────────────────────────────────
const verify = async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'No hay sesión activa' });
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET || 'secret_fallback_key');
        const user = await userService.getUserById(decoded.id);

        if (!user) {
            return res.status(401).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        });
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
};

module.exports = {
    register,
    login,
    logout,
    verify,
};
