const { Router } = require('express');
const postService = require('../services/post.services');
const postController = require('../controllers/postController');
const realtime = require('../services/realtime.services');
const authRequired = require('../middlewares/authRequired');
const { authRequiredPage } = require('../middlewares/authRequired');

const authController = require('../controllers/authController');

const router = Router();

// Conexión SSE para likes y comentarios en tiempo real
router.get('/events', realtime.addClient);

// Ruta interna segura: solo permite volver a rutas del propio sitio
const safeNextPath = (value) => {
    if (typeof value !== 'string') return '/';
    if (!value.startsWith('/') || value.startsWith('//')) return '/';
    return value;
};

// Página principal (Index)
router.get('/', async (req, res) => {
    try {
        const limit = 3;
        const userId = req.user ? req.user.id : null;
        const initialPosts = await postService.getAllPosts(limit, 0, userId);
        const recentPosts = await postService.getRecentPosts(4);
        const featuredPosts = await postService.getFeaturedPosts(3);
        const totalPosts = await postService.countPosts();

        res.render('index', {
            title: 'LuminaBlog - Inicio',
            posts: initialPosts,
            recentPosts,
            featuredPosts,
            hasMore: totalPosts > limit
        });
    } catch (error) {
        console.error('Error cargando index:', error);
        res.render('index', {
            title: 'LuminaBlog - Inicio',
            posts: [],
            recentPosts: [],
            featuredPosts: [],
            hasMore: false
        });
    }
});

router.get('/login', (req, res) => {
    res.render('auth/login', {
        title: 'Iniciar Sesión',
        error: null,
        next: safeNextPath(req.query.next)
    });
});
router.post('/login', authController.login);

router.get('/register', (req, res) => {
    res.render('auth/register', {
        title: 'Registrarse',
        error: null
    });
});
router.post('/register', authController.register);

router.post('/logout', authController.logout);

router.get('/about', (req, res) => {
    res.render('index', {
        title: 'Acerca de Nosotros',
        posts: [],
        recentPosts: [],
        featuredPosts: [],
        hasMore: false
    });
});

router.get('/contact', (req, res) => {
    res.render('index', {
        title: 'Contacto',
        posts: [],
        recentPosts: [],
        featuredPosts: [],
        hasMore: false
    });
});

// Endpoint API para el infinite scroll (devuelve posts reales de la BD)
router.get('/api/posts/feed', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 3;
        const skip = (page - 1) * limit;

        const [posts, total] = await Promise.all([
            postService.getAllPosts(limit, skip, req.user ? req.user.id : null),
            postService.countPosts()
        ]);

        const formattedPosts = posts.map(post => {
            const authorSlug = (post.author.name || post.author.email.split('@')[0])
                .toLowerCase()
                .replace(/\s+/g, '-');

            return {
                id: post.id,
                title: post.title,
                slug: post.slug,
                url: `/posts/${authorSlug}/${post.id}`,
                excerpt: post.content.length > 180 ? post.content.slice(0, 180) + '...' : post.content,
                image: post.image,
                author: post.author ? post.author.name : 'Anónimo',
                authorSlug,
                date: new Date(post.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
                likes: post.numLikes || 0,
                comments: post.numComments || 0,
                liked: Array.isArray(post.likes) && post.likes.length > 0
            };
        });

        res.json({
            posts: formattedPosts,
            hasMore: skip + posts.length < total
        });
    } catch (error) {
        console.error('Error en feed API:', error);
        res.status(500).json({ posts: [], hasMore: false, error: error.message });
    }
});

router.get('/create-post', authRequiredPage, postController.showCreateForm);

// API JSON para crear posts (sin subida de archivos)
router.post('/api/posts', authRequired, postController.createPost);

module.exports = router;
