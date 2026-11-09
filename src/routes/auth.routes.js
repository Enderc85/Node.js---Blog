const { Router } = require('express');
const authController = require('../controllers/authController');

const router = Router();

// POST /api/auth/register  → Crear cuenta
router.post('/register', authController.register);

// POST /api/auth/login     → Iniciar sesión
router.post('/login', authController.login);

// POST /api/auth/logout    → Cerrar sesión
router.post('/logout', authController.logout);

// GET  /api/auth/verify    → Comprobar si el token es válido
router.get('/verify', authController.verify);

module.exports = router;