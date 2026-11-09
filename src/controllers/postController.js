const postService = require('../services/post.services');
const realtime = require('../services/realtime.services');
const { removeUploadedFiles } = require('../middlewares/upload');

// Convierte el autor de un post en el slug que usan las URLs /posts/:username/:id
const authorSlug = (author) => {
    return (author.name || author.email.split('@')[0])
        .toLowerCase()
        .replace(/\s+/g, '-');
};

// Mensajes que se muestran tras enviar el formulario de comentarios
const COMMENT_MESSAGES = {
    ok: { type: 'success', text: 'Tu comentario se ha publicado.' },
    empty: { type: 'error', text: 'El comentario no puede estar vacío.' },
    toolong: { type: 'error', text: 'El comentario no puede superar los 1000 caracteres.' },
    invalid: { type: 'error', text: 'Los datos del comentario no son válidos.' },
    notfound: { type: 'error', text: 'El post ya no existe.' },
    server: { type: 'error', text: 'No se pudo publicar el comentario. Inténtalo de nuevo.' }
};

// Mostrar la vista de detalle de un post por /:username/:id
const getPostByUserAndId = async (req, res) => {
    try {
        const { username, id } = req.params;

        if (isNaN(id)) {
            return res.status(404).render('errors/404', {
                title: 'Artículo no encontrado',
                message: 'El identificador del post debe ser un número válido.'
            });
        }

        const post = await postService.getPostByUsernameAndId(
            username,
            id,
            req.user ? req.user.id : null
        );

        if (!post) {
            return res.status(404).render('errors/404', {
                title: 'Artículo no encontrado',
                message: `No se encontró ningún artículo con ID #${id} perteneciente al autor "${username}".`
            });
        }

        const recentPosts = await postService.getRecentPosts(4);

        res.render('posts/detail', {
            title: post.title,
            post,
            recentPosts,
            commentFeedback: COMMENT_MESSAGES[req.query.comment] || null,
            isPreviewImage: postService.isPreviewableImage
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

// GET /create-post → formulario para crear un post (solo usuarios logueados)
const showCreateForm = (req, res) => {
    res.render('posts/postCreate', {
        title: 'Crear un nuevo post',
        error: null,
        formData: { title: '', description: '' }
    });
};

// POST /posts → guarda el post y sus imágenes
const store = async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    const title = (req.body.title || '').trim();
    const description = (req.body.description || req.body.content || '').trim();

    const renderError = (message, status = 400) => {
        // Si algo falla, no dejamos archivos huérfanos en el disco
        removeUploadedFiles(files);
        return res.status(status).render('posts/postCreate', {
            title: 'Crear un nuevo post',
            error: message,
            formData: { title, description }
        });
    };

    try {
        // Errores de multer (tamaño, formato, número de archivos...)
        if (req.uploadError) {
            return renderError(req.uploadError);
        }

        if (!title || !description) {
            return renderError('El título y la descripción son obligatorios.');
        }

        if (title.length > 150) {
            return renderError('El título no puede superar los 150 caracteres.');
        }

        if (description.length > 20000) {
            return renderError('La descripción no puede superar los 20.000 caracteres.');
        }

        if (files.length === 0) {
            return renderError('Debes subir al menos una imagen (JPG, JPEG, PNG, HEIC o RAW).');
        }

        const imageUrls = files.map((file) => `/uploads/posts/${file.filename}`);

        // createdAt lo rellena Prisma/PostgreSQL con la fecha y hora actuales
        const newPost = await postService.createPost({
            title,
            content: description,
            images: imageUrls,
            authorId: req.user.id
        });

        return res.redirect(`/posts/${authorSlug(newPost.author)}/${newPost.id}`);
    } catch (error) {
        console.error('Error al crear post:', error);
        return renderError('No se pudo crear el post. Inténtalo de nuevo.', 500);
    }
};

// API JSON: crear un nuevo post sin subida de archivos
const createPost = async (req, res) => {
    try {
        const { title, content, description, image, images } = req.body;
        const authorId = req.user ? req.user.id : req.body.authorId;
        const body = (content || description || '').trim();

        if (!title || !body) {
            return res.status(400).json({ message: 'Título y contenido son obligatorios' });
        }

        const gallery = Array.isArray(images) ? images : [];
        if (image) gallery.push(image);

        const newPost = await postService.createPost({
            title: title.trim(),
            content: body,
            image,
            images: gallery,
            authorId
        });

        res.status(201).json(newPost);
    } catch (error) {
        console.error('Error al crear post:', error);
        res.status(500).json({ error: error.message });
    }
};

// POST /posts/:id/like → alterna el me gusta del usuario autenticado (JSON)
const toggleLike = async (req, res) => {
    try {
        const result = await postService.toggleLike(req.params.id, req.user.id);

        if (!result.ok) {
            const status = result.reason === 'notfound' ? 404 : 400;
            return res.status(status).json({
                message: result.reason === 'notfound'
                    ? 'El post no existe.'
                    : 'No se pudo procesar el me gusta.'
            });
        }

        // Notifica al resto de pestañas/usuarios conectados por SSE
        realtime.broadcast('like', {
            postId: Number(req.params.id),
            numLikes: result.numLikes
        });

        return res.json({ liked: result.liked, numLikes: result.numLikes });
    } catch (error) {
        console.error('Error al alternar me gusta:', error);
        return res.status(500).json({ message: 'No se pudo procesar el me gusta.' });
    }
};

// POST /posts/:id/comments → guarda un comentario del usuario autenticado
const storeComment = async (req, res) => {
    const postPath = await postService.getPostPathById(req.params.id).catch(() => null);
    const redirectBase = postPath || '/';

    try {
        const result = await postService.addComment({
            postId: req.params.id,
            userId: req.user.id,
            content: req.body.content
        });

        if (!result.ok) {
            return res.redirect(`${redirectBase}?comment=${result.reason}#comentarios`);
        }

        // Notifica al resto de pestañas/usuarios conectados por SSE
        realtime.broadcast('comment', {
            postId: Number(req.params.id),
            numComments: result.numComments,
            comment: {
                id: result.comment.id,
                content: result.comment.content,
                createdAt: result.comment.createdAt,
                author: result.comment.author
            }
        });

        return res.redirect(`${redirectBase}?comment=ok#comentarios`);
    } catch (error) {
        console.error('Error al guardar comentario:', error);
        return res.redirect(`${redirectBase}?comment=server#comentarios`);
    }
};

module.exports = {
    getPostByUserAndId,
    getPostByUserAndIdApi,
    showCreateForm,
    store,
    createPost,
    toggleLike,
    storeComment
};
