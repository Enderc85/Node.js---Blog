const { Router } = require('express');
const postController = require('../controllers/postController');
const authRequired = require('../middlewares/authRequired');

const router = Router();

// 1. Crear nuevo post: POST /posts
router.post('/', authRequired, postController.createPost);

// 2. Endpoint API JSON por autor e ID: GET /posts/api/:username/:id
router.get('/api/:username/:id', postController.getPostByUserAndIdApi);

// 3. Vista web de detalle de post: GET /posts/:username/:id
router.get('/:username/:id', postController.getPostByUserAndId);

module.exports = router;
