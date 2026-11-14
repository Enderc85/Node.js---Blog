const prisma = require('../config/db');
const { isPreviewableImage } = require('../services/post.services');

// GET /media/:id/:archivo → sirve la imagen guardada en la base de datos.
// El nombre del archivo es decorativo (para conservar la extensión); el id es
// lo que identifica al registro.
const show = async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).type('text/plain').send('Identificador de imagen no válido.');
    }

    try {
        const media = await prisma.media.findUnique({ where: { id } });

        if (!media) {
            return res.status(404).type('text/plain').send('Imagen no encontrada.');
        }

        const buffer = Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data);

        // El contenido de un id nunca cambia, así que se puede cachear para siempre.
        res.setHeader('Content-Type', media.mimeType);
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader(
            'Content-Disposition',
            `${isPreviewableImage(media.filename) ? 'inline' : 'attachment'}; filename="${media.filename}"`
        );

        return res.send(buffer);
    } catch (error) {
        console.error('Error sirviendo la imagen', id, error);
        return res.status(500).type('text/plain').send('No se pudo cargar la imagen.');
    }
};

module.exports = { show };
