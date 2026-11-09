const prisma = require('../config/db');

// Función auxiliar para generar slugs URL-friendly
const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar tildes
        .replace(/[^a-z0-9 -]/g, '')                     // Quitar caracteres raros
        .replace(/\s+/g, '-')                            // Espacios por guiones
        .replace(/-+/g, '-');                            // Evitar guiones consecutivos
};

// Obtener todos los posts (o paginados)
const getAllPosts = async (take = 10, skip = 0) => {
    return await prisma.post.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
            author: {
                select: { id: true, name: true, email: true }
            }
        }
    });
};

// Obtener un post por el nombre de usuario del autor y el id del post
const getPostByUsernameAndId = async (username, id) => {
    const post = await prisma.post.findUnique({
        where: { id: Number(id) },
        include: {
            author: {
                select: { id: true, name: true, email: true }
            }
        }
    });

    if (!post || !post.author) return null;

    // Comparar con el nombre o el prefijo del email del usuario (URL friendly)
    const authorUser = (post.author.name || post.author.email.split('@')[0])
        .toLowerCase()
        .replace(/\s+/g, '-');

    if (authorUser !== username.toLowerCase()) {
        return null;
    }

    return post;
};

// Obtener un post por su slug único
const getPostBySlug = async (slug) => {
    return await prisma.post.findUnique({
        where: { slug },
        include: {
            author: {
                select: { id: true, name: true, email: true }
            }
        }
    });
};

// Obtener los posts más recientes (para la barra lateral)
const getRecentPosts = async (limit = 4) => {
    return await prisma.post.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            title: true,
            slug: true,
            image: true,
            createdAt: true,
            author: {
                select: { name: true, email: true }
            }
        }
    });
};

// Crear un nuevo post con generación automática de slug
const createPost = async ({ title, content, image, authorId }) => {
    let baseSlug = slugify(title);
    let uniqueSlug = baseSlug;

    // Verificar si el slug ya existe para evitar colisión
    const existing = await prisma.post.findUnique({ where: { slug: uniqueSlug } });
    if (existing) {
        uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    return await prisma.post.create({
        data: {
            title,
            slug: uniqueSlug,
            content,
            image,
            authorId: Number(authorId)
        }
    });
};

// Obtener los posts destacados / recomendaciones
const getFeaturedPosts = async (limit = 3) => {
    return await prisma.post.findMany({
        take: limit,
        orderBy: { numLikes: 'desc' },
        include: {
            author: {
                select: { id: true, name: true, email: true }
            }
        }
    });
};

// Contar total de posts
const countPosts = async () => {
    return await prisma.post.count();
};

module.exports = {
    slugify,
    getAllPosts,
    getPostByUsernameAndId,
    getPostBySlug,
    getRecentPosts,
    getFeaturedPosts,
    countPosts,
    createPost
};

