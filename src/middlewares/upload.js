const multer = require('multer');
const path = require('path');

// Los archivos se reciben en memoria y se guardan en la base de datos
// (src/services/media.services.js), no en el disco local. Así una imagen
// subida desde un equipo se ve desde cualquier otro.
const storage = multer.memoryStorage();

// Formatos permitidos. Se aceptan los indicados en el requisito
// (jpg, jpeg, png, heic) más los RAW habituales de cada fabricante.
const ALLOWED_EXTENSIONS = new Set([
    '.jpg', '.jpeg', '.png', '.heic', '.heif',
    '.raw', '.cr2', '.cr3', '.nef', '.arw', '.dng', '.orf', '.rw2', '.raf'
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB por imagen
const MAX_FILES = 10;                   // Máximo de imágenes por post

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return cb(new Error(
            `Formato no permitido (${ext || 'sin extensión'}). ` +
            'Usa JPG, JPEG, PNG, HEIC o RAW.'
        ));
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES
    }
});

// ---------- Fotos de perfil ----------
// Solo formatos que el navegador puede mostrar como avatar.
const AVATAR_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const MAX_AVATAR_SIZE = 6 * 1024 * 1024; // 6 MB

const avatarUpload = multer({
    storage,
    limits: {
        fileSize: MAX_AVATAR_SIZE,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (!AVATAR_EXTENSIONS.has(ext)) {
            return cb(new Error('La foto de perfil debe ser JPG, JPEG, PNG, WEBP, GIF o AVIF.'));
        }

        cb(null, true);
    }
});

// Ejecuta multer para un único archivo "avatar" y convierte sus errores
// en un mensaje legible (req.uploadError) para volver a mostrar el formulario.
const uploadAvatar = (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                req.uploadError = `La foto de perfil debe pesar como máximo ${MAX_AVATAR_SIZE / (1024 * 1024)} MB.`;
            } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                req.uploadError = 'Solo puedes subir una foto de perfil.';
            } else {
                req.uploadError = err.message || 'No se pudo subir la foto de perfil.';
            }
        }

        next();
    });
};

// Middleware que ejecuta multer y convierte sus errores en un mensaje
// legible para volver a mostrar el formulario sin romper la petición.
const uploadPostImages = (req, res, next) => {
    upload.array('images', MAX_FILES)(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                req.uploadError = `Cada imagen debe pesar como máximo ${MAX_FILE_SIZE / (1024 * 1024)} MB.`;
            } else if (err.code === 'LIMIT_FILE_COUNT') {
                req.uploadError = `Puedes subir un máximo de ${MAX_FILES} imágenes por post.`;
            } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                req.uploadError = 'Se ha enviado un número de imágenes mayor del permitido.';
            } else {
                req.uploadError = err.message || 'No se pudieron subir las imágenes.';
            }
        }

        next();
    });
};

module.exports = {
    uploadPostImages,
    uploadAvatar,
    ALLOWED_EXTENSIONS,
    AVATAR_EXTENSIONS,
    MAX_FILE_SIZE,
    MAX_AVATAR_SIZE,
    MAX_FILES
};
