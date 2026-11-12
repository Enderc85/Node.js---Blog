const fs = require('fs/promises');
const path = require('path');
const prisma = require('../config/db');
const { isPreviewableImage } = require('./post.services');

const UPLOAD_URL_PREFIX = '/uploads/posts/';
const UPLOAD_DIR = path.join(__dirname, '../../public/uploads/posts');

// Convierte una URL local (/uploads/posts/archivo.jpg) en una ruta de disco segura
const localFilePath = (url) => {
    if (!url || !url.startsWith(UPLOAD_URL_PREFIX)) return null;

    const filename = path.basename(url);
    const fullPath = path.join(UPLOAD_DIR, filename);

    // Evita cualquier intento de salir de la carpeta de subidas
    if (!fullPath.startsWith(UPLOAD_DIR + path.sep)) return null;

    return fullPath;
};

const authorSlug = (author) => {
    return (author.name || author.email.split('@')[0])
        .toLowerCase()
        .replace(/\s+/g, '-');
};

// Devuelve los posts publicados y todas las imágenes que se muestran en la web:
// portadas de posts + galerías + la biblioteca Images.
const getDashboardData = async () => {
    const [posts, library, totalUsers] = await Promise.all([
        prisma.post.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, name: true, email: true } },
                images: { orderBy: { position: 'asc' } },
                _count: { select: { comments: true, likes: true } }
            }
        }),
        prisma.images.findMany({ orderBy: { id: 'desc' } }),
        prisma.user.count()
    ]);

    const postImages = [];

    // Una misma URL puede ser portada y estar también en la galería.
    // La agrupamos para que el admin la vea una sola vez.
    for (const post of posts) {
        const byUrl = new Map();

        const addEntry = (url, { isCover = false, imageId = null } = {}) => {
            if (!url) return;

            if (!byUrl.has(url)) {
                byUrl.set(url, {
                    url,
                    isCover: false,
                    inGallery: false,
                    galleryIds: [],
                    previewable: isPreviewableImage(url),
                    local: url.startsWith(UPLOAD_URL_PREFIX),
                    post,
                    postUrl: `/posts/${authorSlug(post.author)}/${post.id}`,
                    authorName: post.author.name || post.author.email.split('@')[0]
                });
            }

            const entry = byUrl.get(url);
            if (isCover) entry.isCover = true;
            if (imageId) {
                entry.inGallery = true;
                entry.galleryIds.push(imageId);
            }
        };

        if (post.image) addEntry(post.image, { isCover: true });
        for (const image of post.images) addEntry(image.url, { imageId: image.id });

        postImages.push(...byUrl.values());
    }

    const libraryImages = library.map((image) => ({
        ...image,
        previewable: isPreviewableImage(image.url)
    }));

    const postsList = posts.map((post) => ({
        id: post.id,
        title: post.title,
        image: post.image || null,
        createdAt: post.createdAt,
        postUrl: `/posts/${authorSlug(post.author)}/${post.id}`,
        authorName: post.author.name || post.author.email.split('@')[0],
        likesCount: post._count.likes,
        commentsCount: post._count.comments,
        imagesCount: post.images.length
    }));

    return {
        posts: postsList,
        postImages,
        library: libraryImages,
        stats: {
            posts: posts.length,
            postsWithImages: posts.filter((post) => post.image || post.images.length > 0).length,
            postImages: postImages.length,
            libraryImages: library.length,
            users: totalUsers
        }
    };
};

// Elimina una imagen de un post (portada y/o filas de galería con esa URL).
// Si era la portada, se elige como nueva portada la siguiente imagen compatible.
const deletePostImage = async ({ postId, url }) => {
    const id = Number(postId);
    if (!Number.isInteger(id) || typeof url !== 'string' || !url) {
        return { ok: false, reason: 'invalid' };
    }

    const post = await prisma.post.findUnique({
        where: { id },
        include: { images: true }
    });

    if (!post) return { ok: false, reason: 'notfound' };

    const belongsToPost = post.image === url || post.images.some((image) => image.url === url);
    if (!belongsToPost) return { ok: false, reason: 'notfound' };

    await prisma.$transaction(async (tx) => {
        await tx.postImage.deleteMany({ where: { postId: id, url } });

        if (post.image === url) {
            const remaining = await tx.postImage.findMany({
                where: { postId: id },
                orderBy: { position: 'asc' }
            });

            const nextCover = remaining.find((image) => isPreviewableImage(image.url))?.url || null;
            await tx.post.update({ where: { id }, data: { image: nextCover } });
        }
    });

    // Borramos el archivo físico solo si ya no lo referencia ninguna parte de la BD
    const filePath = localFilePath(url);
    if (filePath) {
        const [coverRefs, galleryRefs] = await Promise.all([
            prisma.post.count({ where: { image: url } }),
            prisma.postImage.count({ where: { url } })
        ]);

        if (coverRefs + galleryRefs === 0) {
            await fs.unlink(filePath).catch(() => {});
        }
    }

    return { ok: true };
};

// Elimina una imagen de la biblioteca Images (no hay archivo local asociado)
const deleteLibraryImage = async (id) => {
    const imageId = Number(id);
    if (!Number.isInteger(imageId)) return { ok: false, reason: 'invalid' };

    const image = await prisma.images.findUnique({ where: { id: imageId } });
    if (!image) return { ok: false, reason: 'notfound' };

    await prisma.images.delete({ where: { id: imageId } });

    const filePath = localFilePath(image.url);
    if (filePath) {
        const [coverRefs, galleryRefs, libraryRefs] = await Promise.all([
            prisma.post.count({ where: { image: image.url } }),
            prisma.postImage.count({ where: { url: image.url } }),
            prisma.images.count({ where: { url: image.url } })
        ]);

        if (coverRefs + galleryRefs + libraryRefs === 0) {
            await fs.unlink(filePath).catch(() => {});
        }
    }

    return { ok: true };
};

// Elimina un post completo (comentarios, me gusta y galería caen en cascada)
// y borra del disco las imágenes locales que ya no referencie nadie.
const deletePost = async (postId) => {
    const id = Number(postId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, reason: 'invalid' };

    const post = await prisma.post.findUnique({
        where: { id },
        select: {
            id: true,
            title: true,
            image: true,
            images: { select: { url: true } }
        }
    });

    if (!post) return { ok: false, reason: 'notfound' };

    // Reunimos todas las URLs del post antes de borrarlo.
    const urls = new Set();
    if (post.image) urls.add(post.image);
    for (const image of post.images) urls.add(image.url);

    // PostImage, Comment y Like se eliminan en cascada según el esquema.
    await prisma.post.delete({ where: { id } });

    await Promise.all([...urls].map(async (url) => {
        const filePath = localFilePath(url);
        if (!filePath) return;

        const [coverRefs, galleryRefs, libraryRefs] = await Promise.all([
            prisma.post.count({ where: { image: url } }),
            prisma.postImage.count({ where: { url } }),
            prisma.images.count({ where: { url } })
        ]);

        // Solo borramos el archivo si ninguna otra parte de la BD lo usa.
        if (coverRefs + galleryRefs + libraryRefs === 0) {
            await fs.unlink(filePath).catch(() => {});
        }
    }));

    return { ok: true, title: post.title };
};

module.exports = {
    getDashboardData,
    deletePost,
    deletePostImage,
    deleteLibraryImage
};
