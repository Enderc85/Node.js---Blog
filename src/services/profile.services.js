const prisma = require('../config/db');

const BIO_MAX = 280;
const NAME_MAX = 60;

// Nombre visible: si el usuario no tiene nombre, usamos la parte local del email.
const displayName = (user) => {
    const name = (user.name || '').trim();
    return name || user.email.split('@')[0];
};

// Mismo formato de slug de autor que usan las URLs /posts/:username/:id
const authorSlug = (user) => displayName(user).toLowerCase().replace(/\s+/g, '-');

const toFeatured = (post, user) => {
    if (!post) return null;

    return {
        id: post.id,
        title: post.title,
        image: post.image || null,
        numLikes: post.numLikes || 0,
        url: `/posts/${authorSlug(user)}/${post.id}`
    };
};

// Devuelve los perfiles ordenados por actividad.
// Actividad = posts publicados * 4 + me gusta recibidos + comentarios escritos.
const getProfiles = async ({ search = '' } = {}) => {
    const q = (search || '').trim().slice(0, 80);

    const where = q
        ? {
            OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { bio: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } }
            ]
        }
        : undefined;

    const [users, likeStats] = await Promise.all([
        prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                bio: true,
                avatar: true,
                createdAt: true,
                _count: {
                    select: { posts: true, comments: true }
                },
                featuredPost: {
                    select: { id: true, title: true, image: true, numLikes: true }
                },
                posts: {
                    orderBy: [{ numLikes: 'desc' }, { createdAt: 'desc' }],
                    take: 1,
                    select: { id: true, title: true, image: true, numLikes: true }
                }
            }
        }),
        prisma.post.groupBy({
            by: ['authorId'],
            _sum: { numLikes: true }
        })
    ]);

    const likesMap = new Map(
        likeStats.map((row) => [row.authorId, row._sum.numLikes || 0])
    );

    const profiles = users.map((user) => {
        const name = displayName(user);
        const postsCount = user._count.posts;
        const commentsCount = user._count.comments;
        const likesReceived = likesMap.get(user.id) || 0;

        return {
            id: user.id,
            name,
            handle: user.email.split('@')[0],
            bio: (user.bio || '').trim(),
            avatar: user.avatar || null,
            initial: name.charAt(0).toUpperCase(),
            joinedLabel: new Date(user.createdAt).toLocaleDateString('es-ES', {
                month: 'long',
                year: 'numeric'
            }),
            postsCount,
            commentsCount,
            likesReceived,
            activity: postsCount * 4 + likesReceived + commentsCount,
            // Si no ha elegido un post destacado, usamos su post con más me gusta.
            featured: toFeatured(user.featuredPost || user.posts[0], user),
            chosenFeatured: Boolean(user.featuredPost)
        };
    });

    profiles.sort((a, b) =>
        b.activity - a.activity ||
        b.postsCount - a.postsCount ||
        a.name.localeCompare(b.name, 'es')
    );

    return profiles.map((profile, index) => ({ ...profile, rank: index + 1 }));
};

// Posts propios para el selector "Post destacado".
const getOwnPosts = async (userId) => {
    return prisma.post.findMany({
        where: { authorId: Number(userId) },
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, image: true, numLikes: true }
    });
};

// Actualiza el perfil. Solo permite destacar un post que pertenezca al usuario.
const updateProfile = async (userId, { name, bio, avatar, featuredPostId }) => {
    let featured = null;

    if (featuredPostId) {
        const postId = Number(featuredPostId);

        if (Number.isInteger(postId)) {
            const owned = await prisma.post.findFirst({
                where: { id: postId, authorId: Number(userId) },
                select: { id: true }
            });

            featured = owned ? owned.id : null;
        }
    }

    const data = {
        name,
        bio: bio || null,
        featuredPostId: featured
    };

    // `avatar` solo se toca si el controlador quiere cambiarlo (nuevo archivo o null).
    if (avatar !== undefined) data.avatar = avatar;

    return prisma.user.update({
        where: { id: Number(userId) },
        data
    });
};

module.exports = {
    BIO_MAX,
    NAME_MAX,
    displayName,
    authorSlug,
    getProfiles,
    getOwnPosts,
    updateProfile
};
