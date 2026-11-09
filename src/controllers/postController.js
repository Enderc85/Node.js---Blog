const postService = require('../services/post.services');

// Mostrar la vista de detalle de un post por /:username/:id
const getPostByUserAndId = async (req, res) => {
    try {
        const { username, id } = req.params;

        if (isNaN(id)) {
            return res.status(404).render('404', {
                title: 'Artículo no encontrado',
                message: 'El identificador del post debe ser un número válido.'
            });
        }

        const post = await postService.getPostByUsernameAndId(username, id);

        if (!post) {
            return res.status(404).render('404', {
                title: 'Artículo no encontrado',
                message: `No se encontró ningún artículo con ID #${id} perteneciente al autor "${username}".`
            });
        }

        const recentPosts = await postService.getRecentPosts(4);

        res.render('posts/detail', {
            title: post.title,
            post,
            recentPosts
        });
    } catch (error) {
        console.error('Error al cargar post:', error);
        res.status(500).send('Error interno del servidor');
    }
};

// API: Obtener post por username e id en formato JSON
const getPostByUserAndIdApi = async (req, res) => {
    try {
        const { username, id } = req.params;
        const post = await postService.getPostByUsernameAndId(username, id);

        if (!post) {
            return res.status(404).json({ message: 'Post no encontrado para ese autor' });
        }

        res.json(post);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear un nuevo post
const createPost = async (req, res) => {
    try {
        const { title, content, image } = req.body;
        const authorId = req.user ? req.user.id : req.body.authorId;

        if (!title || !content) {
            return res.status(400).json({ message: 'Título y contenido son obligatorios' });
        }

        const newPost = await postService.createPost({
            title,
            content,
            image,
            authorId
        });

        res.status(201).json(newPost);
    } catch (error) {
        console.error('Error al crear post:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getPostByUserAndId,
    getPostByUserAndIdApi,
    createPost
};

const showForm = (req, res) => {
    res.render('posts/postCreate', {
        title: 'Crear post',
        error: null
    });
};

const store = async (req, res) => {
    try {
        const { title, content, image } = req.body;
        const authorId = req.user.id;

        const newPost = await postService.createPost({
            title,
            content,
            image,
            authorId
        });

        res.redirect(`/posts/${authorId}/${newPost.id}`);
    } catch (error) {
        console.error('Error al crear post:', error);
        res.render('posts/postCreate', {
            title: 'Crear post',
            error: error.message
        });
    }
}