const fs = require('fs/promises');
const path = require('path');
const prisma = require('../config/db');
const { isPreviewableImage } = require('./post.services');
const { isMediaUrl, deleteMediaByUrl } = require('./media.services');
const { getProfileSlugMap } = require('./profile.services');

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

// Borra el archivo de una URL cuando ya no lo referencia nadie.
// Soporta las imágenes nuevas (/media/...) y las antiguas guardadas en disco
// (/uploads/posts/...), por si quedan datos de antes del cambio.
const removeUnusedFile = async (url) => {
    if (isMediaUrl(url)) {
        // deleteMediaByUrl ya comprueba que no queden referencias.
        await deleteMediaByUrl(url);
        return;
    }

    const filePath = localFilePath(url);
    if (!filePath) return;

    const [coverRefs, galleryRefs, libraryRefs, avatarRefs] = await Promise.all([
        prisma.post.count({ where: { image: url } }),
        prisma.postImage.count({ where: { url } }),
        prisma.images.count({ where: { url } }),
        prisma.user.count({ where: { avatar: url } })
    ]);

    if (coverRefs + galleryRefs + libraryRefs + avatarRefs === 0) {
        await fs.unlink(filePath).catch(() => {});
    }
};

const authorSlug = (author) => {
    return (author.name || author.email.split('@')[0])
        .toLowerCase()
        .replace(/\s+/g, '-');
};

// Devuelve los posts publicados y todas las imágenes que se muestran en la web:
// portadas de posts + galerías + la biblioteca Images.
const getDashboardData = async () => {
    const [posts, library, users, slugs] = await Promise.all([
        prisma.post.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                author: { select: { id: true, name: true, email: true } },
                images: { orderBy: { position: 'asc' } },
                _count: { select: { comments: true, likes: true } }
            }
        }),
        prisma.images.findMany({ orderBy: { id: 'desc' } }),
        prisma.user.findMany({
            orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                role: true,
                active: true,
                createdAt: true,
                _count: { select: { posts: true, comments: true, likes: true } }
            }
        }),
        getProfileSlugMap()
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
                    local: isMediaUrl(url) || url.startsWith(UPLOAD_URL_PREFIX),
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

    const usersList = users.map((user) => {
        const name = user.name || user.email.split('@')[0];

        return {
            id: user.id,
            name,
            initial: name.charAt(0).toUpperCase(),
            email: user.email,
            avatar: user.avatar || null,
            role: user.role,
            active: user.active,
            createdAt: user.createdAt,
            profileUrl: `/profiles/${slugs.get(user.id)}`,
            postsCount: user._count.posts,
            commentsCount: user._count.comments,
            likesCount: user._count.likes
        };
    });

    return {
        posts: postsList,
        postImages,
        library: libraryImages,
        users: usersList,
        stats: {
            posts: posts.length,
            postsWithImages: posts.filter((post) => post.image || post.images.length > 0).length,
            postImages: postImages.length,
            libraryImages: library.length,
            users: users.length,
            usersActive: users.filter((user) => user.active).length,
            usersInactive: users.filter((user) => !user.active).length
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

    // Borramos el archivo solo si ya no lo referencia ninguna parte de la BD
    await removeUnusedFile(url);

    return { ok: true };
};

// Elimina una imagen de la biblioteca Images (no hay archivo local asociado)
const deleteLibraryImage = async (id) => {
    const imageId = Number(id);
    if (!Number.isInteger(imageId)) return { ok: false, reason: 'invalid' };

    const image = await prisma.images.findUnique({ where: { id: imageId } });
    if (!image) return { ok: false, reason: 'notfound' };

    await prisma.images.delete({ where: { id: imageId } });

    await removeUnusedFile(image.url);

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

    await Promise.all([...urls].map((url) => removeUnusedFile(url)));

    return { ok: true, title: post.title };
};

// Activa o desactiva una cuenta. Un usuario desactivado no puede iniciar
// sesión y su sesión actual deja de ser válida en la siguiente petición.
const setUserActive = async (userId, active) => {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, reason: 'invalid' };

    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, active: true }
    });

    if (!user) return { ok: false, reason: 'notfound' };

    if (user.active !== active) {
        await prisma.user.update({ where: { id }, data: { active } });
    }

    return {
        ok: true,
        already: user.active === active,
        name: user.name || user.email.split('@')[0]
    };
};

// Elimina una cuenta por completo:
// - sus posts (con galería e imágenes) usando el mismo flujo del panel;
// - sus comentarios y me gusta caen en cascada;
// - se recalculan los contadores de los posts afectados.
// No permite que un administrador se elimine a sí mismo.
const deleteUser = async (userId, currentUserId) => {
    const id = Number(userId);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, reason: 'invalid' };
    if (Number(currentUserId) === id) return { ok: false, reason: 'self' };

    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            posts: { select: { id: true } }
        }
    });

    if (!user) return { ok: false, reason: 'notfound' };

    const ownPostIds = new Set(user.posts.map((post) => post.id));

    // Comentarios y me gusta del usuario en posts que NO se van a borrar.
    const [commentedPosts, likedPosts] = await Promise.all([
        prisma.comment.findMany({
            where: { authorId: id },
            select: { postId: true },
            distinct: ['postId']
        }),
        prisma.like.findMany({
            where: { userId: id },
            select: { postId: true },
            distinct: ['postId']
        })
    ]);

    const affectedPostIds = new Set(
        [...commentedPosts, ...likedPosts]
            .map((row) => row.postId)
            .filter((postId) => !ownPostIds.has(postId))
    );

    // Los posts se eliminan con el flujo normal (borra imágenes del disco/BD).
    for (const postId of ownPostIds) {
        await deletePost(postId);
    }

    // El usuario arrastra en cascada sus comentarios y me gusta restantes.
    await prisma.user.delete({ where: { id } });

    // Mantener numComments / numLikes correctos en los posts afectados.
    for (const postId of affectedPostIds) {
        const [numComments, numLikes] = await Promise.all([
            prisma.comment.count({ where: { postId } }),
            prisma.like.count({ where: { postId } })
        ]);

        await prisma.post.updateMany({
            where: { id: postId },
            data: { numComments, numLikes }
        });
    }

    // La foto de perfil puede ser local o de /media; se borra si ya no se usa.
    await removeUnusedFile(user.avatar);

    return {
        ok: true,
        name: user.name || user.email.split('@')[0],
        postsDeleted: ownPostIds.size
    };
};

module.exports = {
    getDashboardData,
    deletePost,
    deletePostImage,
    deleteLibraryImage,
    setUserActive,
    deleteUser
};
