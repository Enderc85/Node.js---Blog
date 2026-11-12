const prisma = require('../config/db');

// Guarda un mensaje del formulario de contacto.
// postId es opcional: los mensajes generales no van ligados a un post concreto.
const createContact = async ({ name, email, message }) => {
    return await prisma.contact.create({
        data: { name, email, message }
    });
};

module.exports = {
    createContact
};
