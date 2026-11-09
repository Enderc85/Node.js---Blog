const { Router } = require('express');
const postController = require('../controllers/postController');
const authRequired = require('../middlewares/authRequired');
const { authRequiredPage } = require('../middlewares/authRequired');
const { uploadPostImages } = require('../middlewares/upload');

const router = Router();

// 1. Crear nuevo post desde el formulario web: POST /posts
router.post('/', authRequiredPage, uploadPostImages, postController.store);

// 2. Dar / quitar me gusta a un post (requiere sesión, responde JSON)
router.post('/:id/like', authRequired, postController.toggleLike);

// 3. Publicar un comentario (requiere sesión)
router.post('/:id/comments', authRequiredPage, postController.storeComment);

// 4. Endpoint API JSON por autor e ID: GET /posts/api/:username/:id
router.get('/api/:username/:id', postController.getPostByUserAndIdApi);

// 5. Vista web de detalle de post: GET /posts/:username/:id
router.get('/:username/:id', postController.getPostByUserAndId);

module.exports = router;
