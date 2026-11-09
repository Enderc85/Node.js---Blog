const prisma = require('../config/db');

const getAllUsers = async () => {
    return await prisma.user.findMany();
};

const createUser = async (data) => {
    return await prisma.user.create({
        data,
    });
};

const getUserById = async (id) => {
    return await prisma.user.findUnique({
        where: { id: Number(id) },
    });
};

// NUEVO: buscar usuario por email (necesario para login y para comprobar si ya existe en register)
const getUserByEmail = async (email) => {
    return await prisma.user.findUnique({
        where: { email },
    });
};

module.exports = {
    getAllUsers,
    createUser,
    getUserById,
    getUserByEmail,  // <-- NUEVO
};