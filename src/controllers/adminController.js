const adminService = require('../services/admin.services');

const NOTICES = {
    'post': 'Post eliminado correctamente.',
    'image': 'Imagen del post eliminada correctamente.',
    'library': 'Imagen eliminada de la biblioteca.'
};

const ERRORS = {
    'invalid': 'Los datos de la imagen no son válidos.',
    'notfound': 'La imagen ya no existe o no pertenece a ese post.',
    'server': 'No se pudo eliminar la imagen. Inténtalo de nuevo.',
    'post_invalid': 'El post indicado no es válido.',
    'post_notfound': 'El post ya no existe o ya fue eliminado.',
    'post_server': 'No se pudo eliminar el post. Inténtalo de nuevo.'
};

// GET /admin → panel con los posts y todas las imágenes de la web
const dashboard = async (req, res) => {
    try {
        const data = await adminService.getDashboardData();

        res.render('admin/images', {
            title: 'Administración',
            ...data,
            notice: NOTICES[req.query.deleted] || null,
            error: ERRORS[req.query.error] || null
        });
    } catch (error) {
        console.error('Error cargando el panel de administración:', error);
        res.status(500).render('errors/500', {
            title: 'Error del servidor',
            message: 'No se pudo cargar el panel de administración.'
        });
    }
};

// POST /admin/posts/delete → elimina un post completo
const deletePost = async (req, res) => {
    try {
        const result = await adminService.deletePost(req.body.postId);

        if (!result.ok) {
            return res.redirect(`/admin?error=post_${result.reason}`);
        }

        return res.redirect('/admin?deleted=post');
    } catch (error) {
        console.error('Error eliminando post:', error);
        return res.redirect('/admin?error=post_server');
    }
};

// POST /admin/images/delete → elimina una imagen de un post
const deletePostImage = async (req, res) => {
    try {
        const { postId, url } = req.body;
        const result = await adminService.deletePostImage({ postId, url });

        if (!result.ok) {
            return res.redirect(`/admin?error=${result.reason}`);
        }

        return res.redirect('/admin?deleted=image');
    } catch (error) {
        console.error('Error eliminando imagen de post:', error);
        return res.redirect('/admin?error=server');
    }
};

// POST /admin/library/delete → elimina una imagen de la biblioteca
const deleteLibraryImage = async (req, res) => {
    try {
        const result = await adminService.deleteLibraryImage(req.body.id);

        if (!result.ok) {
            return res.redirect(`/admin?error=${result.reason}`);
        }

        return res.redirect('/admin?deleted=library');
    } catch (error) {
        console.error('Error eliminando imagen de biblioteca:', error);
        return res.redirect('/admin?error=server');
    }
};

module.exports = {
    dashboard,
    deletePost,
    deletePostImage,
    deleteLibraryImage
};
