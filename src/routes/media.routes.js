const { Router } = require('express');
const mediaController = require('../controllers/mediaController');

const router = Router();

// Los archivos subidos se guardan en la base de datos y se sirven desde aquí.
// La ruta admite tanto /media/12/foto.jpg como /media/12.
router.get('/:id/:filename', mediaController.show);
router.get('/:id', mediaController.show);

module.exports = router;
