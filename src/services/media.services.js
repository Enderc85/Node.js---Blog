const path = require('path');
const crypto = require('crypto');
const prisma = require('../config/db');
const { isPreviewableImage } = require('./post.services');

// Tipo MIME a partir de la extensión. No nos fiamos del que envía el cliente:
// el navegador debe recibir siempre el correcto para poder mostrar la imagen.
const MIME_BY_EXTENSION = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.raw': 'image/x-raw',
    '.cr2': 'image/x-canon-cr2',
    '.cr3': 'image/x-canon-cr3',
    '.nef': 'image/x-nikon-nef',
    '.arw': 'image/x-sony-arw',
    '.dng': 'image/x-adobe-dng',
    '.orf': 'image/x-olympus-orf',
    '.rw2': 'image/x-panasonic-rw2',
    '.raf': 'image/x-fujifilm-raf'
};

// Las URLs de los archivos guardados en la base de datos tienen la forma
// /media/<id>/<nombre>. Se incluye el nombre para que la web siga pudiendo
// deducir la extensión (vista previa, descargas, HEIC/RAW...).
const MEDIA_URL = /^\/media\/(\d+)\/([A-Za-z0-9._-]+)$/;

const buildUrl = (id, filename) => `/media/${id}/${filename}`;

// Devuelve el id del registro Media de una URL, o null si no es una URL nuestra.
const mediaIdFromUrl = (url) => {
    if (typeof url !== 'string') return null;
    const match = url.match(MEDIA_URL);
    return match ? Number(match[1]) : null;
};

// Guarda un archivo de multer (en memoria) en la base de datos.
const saveMedia = async (file) => {
    if (!file || !file.buffer) {
        throw new Error('No se ha recibido ningún archivo válido.');
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    const mimeType = MIME_BY_EXTENSION[ext] || file.mimetype || 'application/octet-stream';

    const media = await prisma.media.create({
        data: {
            filename,
            mimeType,
            size: file.buffer.length,
            data: file.buffer
        },
        select: { id: true, filename: true }
    });

    return buildUrl(media.id, media.filename);
};

// Guarda varios archivos y devuelve sus URLs en el mismo orden.
// Si uno falla, borra los que ya se habían guardado para no dejar huérfanos.
const saveManyMedia = async (files = []) => {
    const saved = [];

    try {
        for (const file of files) {
            saved.push(await saveMedia(file));
        }
        return saved;
    } catch (error) {
        await Promise.all(saved.map((url) => deleteMediaByUrl(url)));
        throw error;
    }
};

// Cuenta cuántas partes de la base de datos siguen apuntando a esa URL.
const countReferences = async (url) => {
    const [covers, gallery, library, avatars] = await Promise.all([
        prisma.post.count({ where: { image: url } }),
        prisma.postImage.count({ where: { url } }),
        prisma.images.count({ where: { url } }),
        prisma.user.count({ where: { avatar: url } })
    ]);

    return covers + gallery + library + avatars;
};

// Borra el registro Media de una URL solo si ya no lo usa nadie.
const deleteMediaByUrl = async (url) => {
    const id = mediaIdFromUrl(url);
    if (!id) return false;

    if (await countReferences(url)) return false;

    await prisma.media.delete({ where: { id } }).catch(() => {});
    return true;
};

// Comprueba si la URL corresponde a un archivo guardado en la base de datos.
const isMediaUrl = (url) => mediaIdFromUrl(url) !== null;

module.exports = {
    MIME_BY_EXTENSION,
    buildUrl,
    mediaIdFromUrl,
    isMediaUrl,
    isPreviewable: isPreviewableImage,
    saveMedia,
    saveManyMedia,
    deleteMediaByUrl
};
