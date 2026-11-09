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

// Convierte un autor en el slug que usan las URLs /posts/:username/:id
const authorSlug = (author) => {
    return (author.name || author.email.split('@')[0])
        .toLowerCase()
        .replace(/\s+/g, '-');
};

// Formatos que cualquier navegador puede mostrar directamente.
// HEIC y RAW se guardan igualmente, pero se muestran como archivo descargable.
const PREVIEWABLE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

// Formatos que el navegador NO puede mostrar de forma nativa.
const NON_PREVIEWABLE_EXTENSIONS = [
    '.heic', '.heif', '.raw', '.cr2', '.cr3', '.nef', '.arw',
    '.dng', '.orf', '.rw2', '.raf'
];

const isPreviewableImage = (url = '') => {
    if (!url) return false;

    const clean = url.split('?')[0].split('#')[0].toLowerCase();
    const extension = clean.match(/\.[a-z0-9]+$/)?.[0] || '';

    if (NON_PREVIEWABLE_EXTENSIONS.includes(extension)) return false;
    if (PREVIEWABLE_EXTENSIONS.includes(extension)) return true;

    // URLs externas sin extensión (por ejemplo, CDNs como Unsplash) sí se
    // pueden mostrar en el navegador, así que las intentamos previsualizar.
    return /^https?:\/\//i.test(url);
};

// Obtener todos los posts (o paginados).
// Si se pasa userId, cada post incluye si ese usuario le ha dado like.
const getAllPosts = async (take = 10, skip = 0, userId = null) => {
    return await prisma.post.findMany({
        take,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
            author: {
                select: { id: true, name: true, email: true }
            },
            images: {
                orderBy: { position: 'asc' }
            },
            ...(userId ? {
                likes: {
                    where: { userId: Number(userId) },
                    select: { id: true }
                }
            } : {})
        }
    });
};

// Obtener un post por el nombre de usuario del autor y el id del post.
// Si se pasa userId, incluye si ese usuario ya le dio like y los comentarios.
const getPostByUsernameAndId = async (username, id, userId = null) => {
    const post = await prisma.post.findUnique({
        where: { id: Number(id) },
        include: {
            author: {
                select: { id: true, name: true, email: true }
            },
            images: {
                orderBy: { position: 'asc' }
            },
            comments: {
                orderBy: { createdAt: 'desc' },
                include: {
                    author: {
                        select: { id: true, name: true, email: true }
                    }
                }
            }
        }
    });

    if (!post || !post.author) return null;

    // Comparar con el nombre o el prefijo del email del usuario (URL friendly)
    const authorUser = authorSlug(post.author);

    if (authorUser !== username.toLowerCase()) {
        return null;
    }

    post.likedByMe = false;
    if (userId) {
        const like = await prisma.like.findUnique({
            where: {
                postId_userId: {
                    postId: post.id,
                    userId: Number(userId)
                }
            },
            select: { id: true }
        });
        post.likedByMe = Boolean(like);
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
            },
            images: {
                orderBy: { position: 'asc' }
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

// Crear un nuevo post con generación automática de slug.
// `images` es un array de URLs ya guardadas en /public/uploads.
const createPost = async ({ title, content, image, images = [], authorId }) => {
    let baseSlug = slugify(title);
    let uniqueSlug = baseSlug;

    // Verificar si el slug ya existe para evitar colisión
    const existing = await prisma.post.findUnique({ where: { slug: uniqueSlug } });
    if (existing) {
        uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    // La primera imagen compatible con el navegador se usa como portada.
    // La fecha (createdAt) la asigna la base de datos automáticamente con now().
    const gallery = [...new Set([...(Array.isArray(images) ? images : []), image].filter(Boolean))];
    const cover = gallery.find(isPreviewableImage) || null;

    return await prisma.post.create({
        data: {
            title,
            slug: uniqueSlug,
            content,
            image: cover,
            authorId: Number(authorId),
            ...(gallery.length > 0 ? {
                images: {
                    create: gallery.map((url, index) => ({
                        url,
                        position: index
                    }))
                }
            } : {})
        },
        include: {
            author: {
                select: { id: true, name: true, email: true }
            },
            images: {
                orderBy: { position: 'asc' }
            }
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

// Alterna el "me gusta" de un usuario en un post.
// Devuelve el estado final y el contador actualizado.
const toggleLike = async (postId, userId) => {
    const id = Number(postId);
    const uid = Number(userId);

    if (!Number.isInteger(id) || !Number.isInteger(uid)) {
        return { ok: false, reason: 'invalid' };
    }

    return await prisma.$transaction(async (tx) => {
        const post = await tx.post.findUnique({
            where: { id },
            select: { id: true }
        });

        if (!post) return { ok: false, reason: 'notfound' };

        const existing = await tx.like.findUnique({
            where: { postId_userId: { postId: id, userId: uid } },
            select: { id: true }
        });

        if (existing) {
            await tx.like.delete({ where: { id: existing.id } });

            const updated = await tx.post.update({
                where: { id },
                data: { numLikes: { decrement: 1 } },
                select: { numLikes: true }
            });

            // Protección por si el contador hubiera quedado desincronizado
            const numLikes = Math.max(0, updated.numLikes);
            if (numLikes !== updated.numLikes) {
                await tx.post.update({ where: { id }, data: { numLikes } });
            }

            return { ok: true, liked: false, numLikes };
        }

        await tx.like.create({ data: { postId: id, userId: uid } });

        const updated = await tx.post.update({
            where: { id },
            data: { numLikes: { increment: 1 } },
            select: { numLikes: true }
        });

        return { ok: true, liked: true, numLikes: updated.numLikes };
    });
};

// Añade un comentario de un usuario registrado a un post
const addComment = async ({ postId, userId, content }) => {
    const id = Number(postId);
    const uid = Number(userId);
    const text = (content || '').trim();

    if (!Number.isInteger(id) || !Number.isInteger(uid)) {
        return { ok: false, reason: 'invalid' };
    }

    if (!text) return { ok: false, reason: 'empty' };
    if (text.length > 1000) return { ok: false, reason: 'toolong' };

    const post = await prisma.post.findUnique({
        where: { id },
        select: { id: true }
    });

    if (!post) return { ok: false, reason: 'notfound' };

    const [comment, updatedPost] = await prisma.$transaction([
        prisma.comment.create({
            data: { postId: id, authorId: uid, content: text },
            include: {
                author: { select: { id: true, name: true, email: true } }
            }
        }),
        prisma.post.update({
            where: { id },
            data: { numComments: { increment: 1 } }
        })
    ]);

    return { ok: true, comment, numComments: updatedPost.numComments };
};

// Ruta pública del post a partir de su id (para redirigir tras comentar)
const getPostPathById = async (id) => {
    const postId = Number(id);
    if (!Number.isInteger(postId)) return null;

    const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
            id: true,
            author: { select: { name: true, email: true } }
        }
    });

    if (!post || !post.author) return null;

    return `/posts/${authorSlug(post.author)}/${post.id}`;
};

module.exports = {
    slugify,
    authorSlug,
    isPreviewableImage,
    getAllPosts,
    getPostByUsernameAndId,
    getPostBySlug,
    getRecentPosts,
    getFeaturedPosts,
    countPosts,
    createPost,
    toggleLike,
    addComment,
    getPostPathById
};

