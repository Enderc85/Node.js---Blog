const userService = require('../services/user.services');

// Obtener todos los usuarios
const getUsers = async (req, res) => {
    try {
        const users = await userService.getAllUsers();
        res.status(200).json(users);
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({
            message: 'Error interno al obtener los usuarios',
            error: error.message
        });
    }
};

// Crear un nuevo usuario
const createUser = async (req, res) => {
    try {
        const { email, name, password } = req.body;

        // Validación básica
        if (!email) {
            return res.status(400).json({ message: 'El email es obligatorio' });
        }

        const newUser = await userService.createUser({
            email,
            name,
            password
        });

        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error al crear usuario:', error);

        // Control de error de clave única en Prisma (email repetido: P2002)
        if (error.code === 'P2002') {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado' });
        }

        res.status(500).json({
            message: 'Error interno al crear el usuario',
            error: error.message
        });
    }
};

// Obtener un usuario por su ID
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await userService.getUserById(id);

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error al buscar usuario por ID:', error);
        res.status(500).json({
            message: 'Error interno al buscar el usuario',
            error: error.message
        });
    }
};

module.exports = {
    getUsers,
    createUser,
    getUserById,
};

