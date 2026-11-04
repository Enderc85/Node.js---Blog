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

module.exports = {
    getAllUsers,
    createUser,
    getUserById,
};