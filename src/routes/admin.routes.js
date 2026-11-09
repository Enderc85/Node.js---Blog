const { Router } = require('express');
const adminController = require('../controllers/adminController');
const adminRequired = require('../middlewares/adminRequired');

const router = Router();

// Todas las rutas de /admin requieren sesión y rol ADMIN
router.use(adminRequired);

router.get('/', adminController.dashboard);
router.post('/images/delete', adminController.deletePostImage);
router.post('/library/delete', adminController.deleteLibraryImage);

module.exports = router;
